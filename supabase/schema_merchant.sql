-- =============================================
-- PayStables Business — Merchant Mode Migration
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add account_type to profiles (user vs merchant)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'user' 
  CHECK (account_type IN ('user', 'merchant'));

-- 2. Add business_name for merchant profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS business_name TEXT;

-- 3. Merchant payments tracking table
CREATE TABLE IF NOT EXISTS merchant_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_address TEXT NOT NULL,
  payer_address TEXT,
  payer_username TEXT,
  amount DECIMAL(18,6) NOT NULL,
  tx_hash TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE merchant_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant payments are publicly readable"
  ON merchant_payments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert merchant payments"
  ON merchant_payments FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_merchant_payments_merchant ON merchant_payments(merchant_address);
CREATE INDEX IF NOT EXISTS idx_merchant_payments_created ON merchant_payments(created_at DESC);
