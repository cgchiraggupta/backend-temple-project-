-- PayPal Backend Migration - Pending Donations Table
-- Purpose: Server-side storage for pending donations during PayPal redirect flow
-- This eliminates the sessionStorage vulnerability where payment is captured but no record is saved

-- ============================================================================
-- PENDING PAYPAL DONATIONS TABLE
-- ============================================================================
-- Stores donation data BEFORE user is redirected to PayPal
-- Links back via paypal_order_id after order is created

CREATE TABLE IF NOT EXISTS pending_paypal_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- PayPal linkage
    paypal_order_id VARCHAR(50),
    
    -- Donor information
    donor_name VARCHAR(255) NOT NULL,
    donor_email VARCHAR(255) NOT NULL,
    donor_phone VARCHAR(50),
    
    -- Donation details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    campaign_name VARCHAR(255),
    donation_type VARCHAR(50) DEFAULT 'general',
    message TEXT,
    
    -- Additional data
    metadata JSONB DEFAULT '{}',
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    
    -- Auto-expiry for cleanup
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookup when PayPal returns with order ID
CREATE INDEX IF NOT EXISTS idx_pending_paypal_order_id 
    ON pending_paypal_donations(paypal_order_id);

-- Cleanup query for expired pending donations
CREATE INDEX IF NOT EXISTS idx_pending_paypal_expires 
    ON pending_paypal_donations(expires_at) 
    WHERE status = 'pending';

-- Status-based queries
CREATE INDEX IF NOT EXISTS idx_pending_paypal_status 
    ON pending_paypal_donations(status);

-- ============================================================================
-- TRIGGER FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_pending_donation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pending_donation_timestamp ON pending_paypal_donations;
CREATE TRIGGER trigger_update_pending_donation_timestamp
    BEFORE UPDATE ON pending_paypal_donations
    FOR EACH ROW
    EXECUTE FUNCTION update_pending_donation_timestamp();

-- ============================================================================
-- CLEANUP FUNCTION (Optional - run periodically)
-- ============================================================================
-- Marks expired pending donations
-- Can be called via cron job or scheduled task

CREATE OR REPLACE FUNCTION cleanup_expired_pending_donations()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE pending_paypal_donations 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- This table works alongside the existing 'donations' table:
-- 1. User submits form → insert into pending_paypal_donations (status: pending)
-- 2. Create PayPal order → update with paypal_order_id
-- 3. User returns/webhook fires → find by paypal_order_id
-- 4. Payment captured → create record in 'donations' table, update pending status to 'completed'
--
-- The 'donations' table payment_method constraint includes 'online' which we'll use for PayPal.
-- Actual provider ('paypal') is stored in the metadata JSONB field.
