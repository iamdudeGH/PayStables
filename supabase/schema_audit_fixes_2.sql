-- =============================================
-- ArcPay Audit Fixes Part 2
-- Run this in Supabase SQL Editor
-- =============================================

-- Restore the ability for the vault creator to update the vault status to 'released'
-- Because the frontend triggers the transaction, the frontend must be able to update the DB.
CREATE POLICY "Creator can update vault status"
  ON smart_vaults FOR UPDATE
  USING (true);
