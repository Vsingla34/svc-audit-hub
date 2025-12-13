-- Add rejection_reason column to auditor_profiles
ALTER TABLE public.auditor_profiles 
ADD COLUMN IF NOT EXISTS rejection_reason text;