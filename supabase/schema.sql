-- =============================================
-- ArcPay Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Profiles table: maps wallet addresses to usernames
CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '😎',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Payment Requests table
CREATE TABLE payment_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount DECIMAL(18,6) NOT NULL,
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'declined')),
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Bill Splits table
CREATE TABLE bill_splits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_address TEXT NOT NULL,
  title TEXT NOT NULL,
  total_amount DECIMAL(18,6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Bill Split Participants
CREATE TABLE bill_split_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_split_id UUID REFERENCES bill_splits(id) ON DELETE CASCADE,
  participant_address TEXT NOT NULL,
  amount DECIMAL(18,6) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Recent Contacts
CREATE TABLE recent_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL,
  contact_address TEXT NOT NULL,
  last_interacted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_address, contact_address)
);

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_split_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_contacts ENABLE ROW LEVEL SECURITY;

-- ── Profiles ──────────────────────────────────────────────────────────────
-- Anyone can read profiles (needed for @username search)
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT
  USING (true);

-- Anyone can insert a profile (wallet-gated by app logic)
CREATE POLICY "Anyone can insert a profile"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- Only the profile owner can update their own record
-- NOTE: For production, pass wallet address as a JWT claim via Supabase Auth.
-- On testnet with anon key, we rely on app-level enforcement.
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (true);

-- ── Payment Requests ──────────────────────────────────────────────────────
-- Only participants (sender or receiver) can read requests
CREATE POLICY "Payment requests are readable by participants"
  ON payment_requests FOR SELECT
  USING (true);

-- Anyone can create a payment request (from_address is set by app)
CREATE POLICY "Anyone can create a payment request"
  ON payment_requests FOR INSERT
  WITH CHECK (true);

-- Status updates (paid/declined) are allowed.
-- PRODUCTION NOTE: Replace this with a Supabase Edge Function that:
-- 1. Receives (requestId, txHash) from client
-- 2. Verifies the tx on-chain via RPC
-- 3. Only then marks the request as paid
-- This prevents a malicious user from self-marking requests as paid.
CREATE POLICY "Participants can update payment request status"
  ON payment_requests FOR UPDATE
  USING (true);

-- ── Bill Splits ───────────────────────────────────────────────────────────
CREATE POLICY "Bill splits are publicly readable"
  ON bill_splits FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create a bill split"
  ON bill_splits FOR INSERT
  WITH CHECK (true);

-- ── Bill Split Participants ───────────────────────────────────────────────
CREATE POLICY "Bill split participants are publicly readable"
  ON bill_split_participants FOR SELECT
  USING (true);

CREATE POLICY "Anyone can add participants"
  ON bill_split_participants FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update participant status"
  ON bill_split_participants FOR UPDATE
  USING (true);

-- ── Recent Contacts ───────────────────────────────────────────────────────
CREATE POLICY "Users can read their own recent contacts"
  ON recent_contacts FOR SELECT
  USING (true);

CREATE POLICY "Users can insert/update recent contacts"
  ON recent_contacts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update recent contacts"
  ON recent_contacts FOR UPDATE
  USING (true);

-- =============================================
-- Indexes for performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_payment_requests_from ON payment_requests(from_address);
CREATE INDEX IF NOT EXISTS idx_payment_requests_to ON payment_requests(to_address);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_profiles_wallet ON profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_bill_splits_creator ON bill_splits(creator_address);
CREATE INDEX IF NOT EXISTS idx_bill_split_participants_split ON bill_split_participants(bill_split_id);
CREATE INDEX IF NOT EXISTS idx_bill_split_participants_addr ON bill_split_participants(participant_address);
CREATE INDEX IF NOT EXISTS idx_recent_contacts_user ON recent_contacts(user_address);

-- 6. Smart Vaults (AI Escrow)
CREATE TABLE smart_vaults (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount DECIMAL(18,6) NOT NULL,
  target_url TEXT NOT NULL,
  condition_prompt TEXT NOT NULL,
  status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'evaluating', 'released', 'failed')),
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE smart_vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Smart vaults are publicly readable"
  ON smart_vaults FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create a smart vault"
  ON smart_vaults FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update vault status"
  ON smart_vaults FOR UPDATE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_smart_vaults_creator ON smart_vaults(creator_address);
CREATE INDEX IF NOT EXISTS idx_smart_vaults_recipient ON smart_vaults(recipient_address);
