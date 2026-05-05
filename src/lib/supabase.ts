import { createClient } from '@supabase/supabase-js'
import type { Profile, PaymentRequest, BillSplit, BillSplitParticipant, RecentContact } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Profile helpers ──────────────────────────────────────────────────────────

export async function getProfileByAddress(walletAddress: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .maybeSingle()

  if (error) console.error(error)
  return data as Profile | null
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .maybeSingle()

  if (error) console.error(error)
  return data as Profile | null
}

/**
 * Batch-fetch multiple profiles by wallet address in a single query.
 * Replaces the N+1 pattern of calling getProfileByAddress() in a loop.
 */
export async function getProfilesByAddresses(addresses: string[]): Promise<Profile[]> {
  if (addresses.length === 0) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('wallet_address', addresses.map((a) => a.toLowerCase()))

  if (error) console.error(error)
  return (data as Profile[]) || []
}

export async function createProfile(
  walletAddress: string,
  username: string,
  displayName: string,
  avatarEmoji: string
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      wallet_address: walletAddress.toLowerCase(),
      username: username.toLowerCase(),
      display_name: displayName,
      avatar_emoji: avatarEmoji,
    })
    .select()
    .single()

  if (error) throw error
  return data as Profile
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle()

  return !data
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  // Escape special ILIKE wildcard characters to prevent full table scans
  const sanitizedQuery = query.replace(/[%_]/g, '\\$&')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${sanitizedQuery}%,display_name.ilike.%${sanitizedQuery}%`)
    .limit(10)

  if (error) console.error(error)
  return (data as Profile[]) || []
}

export async function updateProfile(
  walletAddress: string,
  displayName: string,
  avatarEmoji: string
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName,
      avatar_emoji: avatarEmoji,
    })
    .eq('wallet_address', walletAddress.toLowerCase())
    .select()
    .single()

  if (error) throw error
  return data as Profile
}

// ── Recent Contacts ──────────────────────────────────────────────────────────

export async function getRecentContacts(userAddress: string): Promise<{ contact: RecentContact, profile: Profile | null }[]> {
  // Fetch contacts
  const { data: contacts, error } = await supabase
    .from('recent_contacts')
    .select('*')
    .eq('user_address', userAddress.toLowerCase())
    .order('last_interacted_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching recent contacts:', error)
    return []
  }

  if (!contacts || contacts.length === 0) return []

  // Fetch profiles for these contacts
  const addresses = contacts.map(c => c.contact_address)
  const profiles = await getProfilesByAddresses(addresses)

  // Join them
  return contacts.map(contact => ({
    contact: contact as RecentContact,
    profile: profiles.find(p => p.wallet_address.toLowerCase() === contact.contact_address.toLowerCase()) || null
  }))
}

export async function upsertRecentContact(userAddress: string, contactAddress: string): Promise<void> {
  if (!userAddress || !contactAddress || userAddress.toLowerCase() === contactAddress.toLowerCase()) return

  const { error } = await supabase
    .from('recent_contacts')
    .upsert({
      user_address: userAddress.toLowerCase(),
      contact_address: contactAddress.toLowerCase(),
      last_interacted_at: new Date().toISOString()
    }, {
      onConflict: 'user_address,contact_address'
    })

  if (error) {
    console.error('Failed to upsert recent contact:', error)
  }
}

// ── Payment Request helpers ──────────────────────────────────────────────────

export async function createPaymentRequest(
  fromAddress: string,
  toAddress: string,
  amount: number,
  note: string
): Promise<PaymentRequest> {
  const { data, error } = await supabase
    .from('payment_requests')
    .insert({
      from_address: fromAddress.toLowerCase(),
      to_address: toAddress.toLowerCase(),
      amount,
      note,
    })
    .select()
    .single()

  if (error) throw error
  return data as PaymentRequest
}

export async function getPaymentRequestsForUser(walletAddress: string): Promise<PaymentRequest[]> {
  const addr = walletAddress.toLowerCase()
  const { data, error } = await supabase
    .from('payment_requests')
    .select('*')
    .or(`from_address.eq.${addr},to_address.eq.${addr}`)
    .order('created_at', { ascending: false })

  if (error) console.error(error)

  const rawReqs = (data as PaymentRequest[]) || []
  
  // Auto-expire pending requests older than 24 hours
  const now = new Date().getTime()
  return rawReqs.map(req => {
    if (req.status === 'pending') {
      const createdAt = new Date(req.created_at).getTime()
      if ((now - createdAt) > 24 * 60 * 60 * 1000) {
        return { ...req, status: 'expired' as const }
      }
    }
    return req
  })
}

export async function updatePaymentRequestStatus(
  requestId: string,
  status: 'paid' | 'declined',
  callerAddress: string,
  signature: string,
  txHash?: string
): Promise<void> {
  const res = await fetch('/api/payment-request', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, status, callerAddress, signature, txHash }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to update payment request')
  }
}

// ── Bill Split helpers ───────────────────────────────────────────────────────

export async function createBillSplit(
  creatorAddress: string,
  title: string,
  totalAmount: number,
  participants: { address: string; amount: number }[]
): Promise<BillSplit> {
  const { data: split, error: splitError } = await supabase
    .from('bill_splits')
    .insert({
      creator_address: creatorAddress.toLowerCase(),
      title,
      total_amount: totalAmount,
    })
    .select()
    .single()

  if (splitError) throw splitError

  const participantRows = participants.map((p) => ({
    bill_split_id: split.id,
    participant_address: p.address.toLowerCase(),
    amount: p.amount,
  }))

  const { error: partError } = await supabase
    .from('bill_split_participants')
    .insert(participantRows)

  if (partError) throw partError

  return split as BillSplit
}

export async function getBillSplitsForUser(walletAddress: string): Promise<BillSplit[]> {
  const addr = walletAddress.toLowerCase()

  const { data: createdSplits } = await supabase
    .from('bill_splits')
    .select('*, bill_split_participants(*)')
    .eq('creator_address', addr)
    .order('created_at', { ascending: false })

  const { data: participantEntries } = await supabase
    .from('bill_split_participants')
    .select('bill_split_id')
    .eq('participant_address', addr)

  const participantSplitIds = (participantEntries || []).map((e) => e.bill_split_id)

  let participantSplits: BillSplit[] = []
  if (participantSplitIds.length > 0) {
    const { data } = await supabase
      .from('bill_splits')
      .select('*, bill_split_participants(*)')
      .in('id', participantSplitIds)
      .order('created_at', { ascending: false })
    participantSplits = (data as BillSplit[]) || []
  }

  const allSplits = [...((createdSplits as BillSplit[]) || []), ...participantSplits]
  const uniqueSplits = allSplits.filter(
    (split, index, self) => index === self.findIndex((s) => s.id === split.id)
  )

  return uniqueSplits
}

export async function updateBillSplitParticipantStatus(
  participantId: string,
  txHash: string
): Promise<void> {
  const { error } = await supabase
    .from('bill_split_participants')
    .update({ status: 'paid', tx_hash: txHash })
    .eq('id', participantId)

  if (error) throw error
}

// ── Smart Vaults (AI Escrow) helpers ─────────────────────────────────────────

export async function createSmartVault(
  creatorAddress: string,
  recipientAddress: string,
  amount: number,
  targetUrl: string,
  conditionPrompt: string
) {
  const { data, error } = await supabase
    .from('smart_vaults')
    .insert({
      creator_address: creatorAddress.toLowerCase(),
      recipient_address: recipientAddress.toLowerCase(),
      amount,
      target_url: targetUrl,
      condition_prompt: conditionPrompt,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getSmartVaultsForUser(walletAddress: string) {
  const addr = walletAddress.toLowerCase()
  const { data, error } = await supabase
    .from('smart_vaults')
    .select('*')
    .or(`creator_address.eq.${addr},recipient_address.eq.${addr}`)
    .order('created_at', { ascending: false })

  if (error) console.error(error)
  return data || []
}

export async function updateSmartVaultStatus(
  vaultId: string,
  status: 'locked' | 'evaluating' | 'released' | 'failed',
  txHash?: string
) {
  const { error } = await supabase
    .from('smart_vaults')
    .update({ status, tx_hash: txHash })
    .eq('id', vaultId)

  if (error) throw error
}
