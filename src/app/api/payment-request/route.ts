import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyMessage } from 'viem'

// Server-side Supabase client — can use service role key in the future
// For now uses the same anon key but with server-side ownership verification
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * PATCH /api/payment-request
 * Body: { requestId, status, txHash, callerAddress }
 *
 * Verifies ownership server-side before allowing status changes.
 * - Only the `to_address` (recipient) can mark a request as 'paid'
 * - Only the `from_address` (sender) can mark a request as 'declined'
 */
export async function PATCH(req: NextRequest) {
  try {
    const { requestId, status, txHash, callerAddress, signature } = await req.json()

    if (!requestId || !status || !callerAddress || !signature) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (!['paid', 'declined'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // ── Cryptographic Signature Verification ───────────────────────────────
    const message = `Authorize ArcPay to mark Payment Request ${requestId} as ${status}`
    
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

    // Fetch the request from DB to verify ownership
    const { data: req_, error: fetchError } = await supabase
      .from('payment_requests')
      .select('from_address, to_address, status')
      .eq('id', requestId)
      .single()

    if (fetchError || !req_) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Only allow updates on pending requests
    if (req_.status !== 'pending') {
      return NextResponse.json({ error: 'Request is no longer pending' }, { status: 409 })
    }

    const caller = callerAddress.toLowerCase()

    // 'paid' can only be set by the recipient (to_address)
    if (status === 'paid' && req_.to_address !== caller) {
      return NextResponse.json({ error: 'Unauthorized: only the recipient can mark as paid' }, { status: 403 })
    }

    // 'declined' can only be set by the recipient (to_address)
    if (status === 'declined' && req_.to_address !== caller) {
      return NextResponse.json({ error: 'Unauthorized: only the recipient can decline' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('payment_requests')
      .update({ status, tx_hash: txHash, updated_at: new Date().toISOString() })
      .eq('id', requestId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('payment-request PATCH error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
