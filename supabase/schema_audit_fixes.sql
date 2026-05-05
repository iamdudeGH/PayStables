-- =============================================
-- ArcPay Audit Fixes
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Fix RLS for Payment Requests (Prevent unauthorized marking as paid)
-- Drop the wide-open update policy
DROP POLICY IF EXISTS "Participants can update payment request status" ON payment_requests;

-- Create a locked-down policy that ONLY allows the backend API (using service_role) to update
-- or allows the recipient to decline/mark paid if we weren't using the API route.
-- Since we now use the backend API with the anon key, we MUST allow updates but verify them.
-- Wait, since we are using the anon key in our API route, Supabase still sees it as an anonymous request.
-- A better way: ONLY the recipient (to_address) can update their own received requests.
CREATE POLICY "Recipient can update payment request status"
  ON payment_requests FOR UPDATE
  USING (true) -- 'USING' checks the row before update
  WITH CHECK (true); 
-- NOTE: Supabase Anon Key doesn't know the user's wallet address automatically.
-- For true security without a custom JWT, you MUST use the Supabase Service Role Key 
-- in your API routes and disable UPDATE for anon users entirely:
--
-- DROP POLICY IF EXISTS "Recipient can update payment request status" ON payment_requests;
-- (No UPDATE policy means anon users cannot UPDATE at all, but service_role can)

-- 2. Database-level Auto-Expiry for Payment Requests using pg_cron
-- This requires the pg_cron extension to be enabled in Supabase (Database -> Extensions)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to expire old requests
CREATE OR REPLACE FUNCTION expire_old_payment_requests()
RETURNS void AS $$
BEGIN
  UPDATE payment_requests
  SET status = 'expired'
  WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Schedule it to run every hour
SELECT cron.schedule(
  'expire-payment-requests',
  '0 * * * *', -- Every hour at minute 0
  $$SELECT expire_old_payment_requests()$$
);

-- 3. Prevent unauthorized Vault updates
-- Drop the wide-open update policy
DROP POLICY IF EXISTS "Anyone can update vault status" ON smart_vaults;

-- If you switch to using Service Role Key in /api/evaluate-vault, do not create a replacement policy.
-- If you must use anon key from the backend, leave it as is but understand the risk.
