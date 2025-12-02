-- Add GPS check-in/check-out tracking to assignments table
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS check_in_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS check_in_lat numeric,
ADD COLUMN IF NOT EXISTS check_in_lng numeric,
ADD COLUMN IF NOT EXISTS check_out_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS check_out_lat numeric,
ADD COLUMN IF NOT EXISTS check_out_lng numeric;

-- Add comment for clarity
COMMENT ON COLUMN assignments.check_in_time IS 'Timestamp when auditor checked in at assignment location';
COMMENT ON COLUMN assignments.check_in_lat IS 'Latitude coordinate of check-in location';
COMMENT ON COLUMN assignments.check_in_lng IS 'Longitude coordinate of check-in location';
COMMENT ON COLUMN assignments.check_out_time IS 'Timestamp when auditor checked out from assignment location';
COMMENT ON COLUMN assignments.check_out_lat IS 'Latitude coordinate of check-out location';
COMMENT ON COLUMN assignments.check_out_lng IS 'Longitude coordinate of check-out location';