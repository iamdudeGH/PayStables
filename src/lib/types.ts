// ── ArcPay Shared Types ────────────────────────────────────────────────────

export interface Profile {
  id: string
  wallet_address: string
  username: string
  display_name: string
  avatar_emoji: string
  created_at: string
}

export interface PaymentRequest {
  id: string
  from_address: string
  to_address: string
  amount: number
  note: string
  status: 'pending' | 'paid' | 'declined' | 'expired'
  tx_hash?: string
  created_at: string
  updated_at: string
}

export interface BillSplitParticipant {
  id: string
  bill_split_id: string
  participant_address: string
  amount: number
  status: 'pending' | 'paid'
  tx_hash?: string
  created_at: string
}

export interface RecentContact {
  id: string
  user_address: string
  contact_address: string
  last_interacted_at: string
}

export interface BillSplit {
  id: string
  creator_address: string
  title: string
  total_amount: number
  created_at: string
  bill_split_participants?: BillSplitParticipant[]
}

export interface SmartVault {
  id: string
  creator_address: string
  recipient_address: string
  amount: number
  target_url: string
  condition_prompt: string
  status: 'pending_approval' | 'locked' | 'evaluating' | 'released' | 'failed'
  tx_hash?: string
  deposit_tx_hash?: string
  release_tx_hash?: string
  escrow_address?: string
  recipient_approved_at?: string
  created_at: string
}

export type ProfileCache = Record<string, Profile>
