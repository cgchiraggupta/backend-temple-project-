-- Migration: Add password_changed_at column to users table
-- Purpose: Track when password was last changed for session invalidation
-- Date: 2024-12-13

-- Add the column (nullable for backward compatibility)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NULL;

-- Set initial value for existing users (current timestamp or created_at)
UPDATE users 
SET password_changed_at = COALESCE(created_at, NOW())
WHERE password_changed_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.password_changed_at IS 'Timestamp of last password change. Used for JWT token invalidation - tokens issued before this time are invalid.';
