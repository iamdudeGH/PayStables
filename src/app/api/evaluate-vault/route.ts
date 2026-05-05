import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyMessage } from 'viem'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Simple in-memory rate limiter ─────────────────────────────────────────────
// For production, replace with Redis (Upstash) for multi-instance safety
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5       // max requests
const WINDOW_MS = 60 * 60 * 1000  // per 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ── URL validation (basic SSRF protection) ───────────────────────────────────
const PRIVATE_IP_REGEX =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|0\.0\.0\.0)/i

function isSafeUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    if (PRIVATE_IP_REGEX.test(url.hostname)) return false
    return true
  } catch {
    return false
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429 }
    )
  }

  try {
    const { vaultId, callerAddress, signature } = await req.json()

    if (!vaultId || !callerAddress || !signature) {
      return NextResponse.json({ error: 'Missing vaultId, callerAddress, or signature' }, { status: 400 })
    }

    // ── Cryptographic Signature Verification ───────────────────────────────
    const message = `Authorize ArcPay to evaluate Smart Vault: ${vaultId}`
    
    try {
      const isValid = await verifyMessage({
        address: callerAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      })
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid cryptographic signature' }, { status: 403 })
      }
    } catch (e) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 })
    }

    // ── Server-side ownership verification ─────────────────────────────────
    const { data: vault, error: vaultError } = await supabase
      .from('smart_vaults')
      .select('creator_address, recipient_address, target_url, condition_prompt, status, amount')
      .eq('id', vaultId)
      .single()

    if (vaultError || !vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
    }

    if (vault.status !== 'locked') {
      return NextResponse.json(
        { error: `Vault is not locked (current status: ${vault.status})` },
        { status: 409 }
      )
    }

    if (vault.creator_address !== callerAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Unauthorized: only the vault creator can trigger evaluation' },
        { status: 403 }
      )
    }

    // ── URL Safety check ────────────────────────────────────────────────────
    if (!isSafeUrl(vault.target_url)) {
      return NextResponse.json({ error: 'Invalid or unsafe target URL' }, { status: 400 })
    }

    // ── GenLayer AI Evaluation ──────────────────────────────────────────────
    const { createClient: createGLClient, chains, createAccount } = await import('genlayer-js')

    const GL_CONTRACT_ADDRESS = '0x835eA2A0f74AA25f8B88cBb072bBcab0E16dD2e5'
    const GL_PRIVATE_KEY = process.env.GL_PRIVATE_KEY as `0x${string}`

    if (!GL_PRIVATE_KEY) {
      return NextResponse.json({ error: 'Server misconfigured: GL_PRIVATE_KEY not set' }, { status: 500 })
    }

    const account = createAccount(GL_PRIVATE_KEY)
    const client = createGLClient({
      chain: chains.studionet,
      endpoint: 'https://studio.genlayer.com:7183',
      account,
    })

    const txHash = await client.writeContract({
      address: GL_CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'evaluate_condition',
      args: [vault.target_url, vault.condition_prompt],
      value: BigInt(0),
    })

    console.log('GenLayer tx submitted:', txHash)

    await client.waitForTransactionReceipt({ hash: txHash })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullTx = await client.getTransaction({ hash: txHash }) as any
    const readable: string =
      fullTx?.consensus_data?.leader_receipt?.[0]?.result?.payload?.readable ?? '"FALSE"'

    console.log('GenLayer readable result:', readable)

    const isConditionMet = readable.toUpperCase().includes('TRUE')

    return NextResponse.json({
      result: isConditionMet ? 'TRUE' : 'FALSE',
      raw: readable,
      txHash,
    })
  } catch (error: unknown) {
    console.error('GenLayer evaluation error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
