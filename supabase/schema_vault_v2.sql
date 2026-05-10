-- =============================================
-- Smart Vaults V2 Migration
-- Adds: bilateral approval, real escrow tracking
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Drop old status constraint and add new one with pending_approval
ALTER TABLE smart_vaults 
  DROP CONSTRAINT IF EXISTS smart_vaults_status_check;

ALTER TABLE smart_vaults 
  ADD CONSTRAINT smart_vaults_status_check 
  CHECK (status IN ('pending_approval', 'locked', 'evaluating', 'released', 'failed'));

-- 2. Add bilateral approval column
ALTER TABLE smart_vaults 
  ADD COLUMN IF NOT EXISTS recipient_approved_at TIMESTAMPTZ;

-- 3. Add escrow tracking columns
ALTER TABLE smart_vaults 
  ADD COLUMN IF NOT EXISTS deposit_tx_hash TEXT;

ALTER TABLE smart_vaults 
  ADD COLUMN IF NOT EXISTS release_tx_hash TEXT;

ALTER TABLE smart_vaults 
  ADD COLUMN IF NOT EXISTS escrow_address TEXT;

-- 4. Change default status for new vaults to pending_approval
ALTER TABLE smart_vaults 
  ALTER COLUMN status SET DEFAULT 'pending_approval';

-- 5. Update any existing 'locked' vaults without approval to keep working
-- (Existing vaults are grandfathered in as already approved)
UPDATE smart_vaults 
  SET recipient_approved_at = created_at 
  WHERE status = 'locked' AND recipient_approved_at IS NULL;
