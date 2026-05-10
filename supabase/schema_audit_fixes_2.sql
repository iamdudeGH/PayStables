-- =============================================
-- ArcPay Audit Fixes Part 2
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop the old overly-permissive policy if it exists
DROP POLICY IF EXISTS "Creator can update vault status" ON smart_vaults;

-- Only the vault creator (matched by wallet address) can update their vault's status/tx_hash.
-- Note: creator_address is stored lowercase; auth.jwt() uid is not used here since we
-- verify identity server-side via cryptographic signature before any DB mutation.
CREATE POLICY "Creator can update vault status"
  ON smart_vaults FOR UPDATE
  USING (creator_address = lower(current_setting('request.jwt.claims', true)::json->>'sub'))
  WITH CHECK (creator_address = lower(current_setting('request.jwt.claims', true)::json->>'sub'));

-- ── Alternative: if you use the service-role key server-side (recommended) ──
-- The above policy may conflict with server-side calls using the anon key.
-- If updateSmartVaultStatus() is called exclusively from the API route (server),
-- switch the API route to use SUPABASE_SERVICE_ROLE_KEY instead of the anon key,
-- and remove the policy above — service role bypasses RLS entirely.
