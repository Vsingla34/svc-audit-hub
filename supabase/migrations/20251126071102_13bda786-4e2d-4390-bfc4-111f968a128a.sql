-- Add bid_amount to applications table
ALTER TABLE public.applications
ADD COLUMN bid_amount numeric DEFAULT 0;

-- Add report submission and completion fields to assignments
ALTER TABLE public.assignments
ADD COLUMN report_url text,
ADD COLUMN completed_at timestamp with time zone,
ADD COLUMN completion_remarks text;

-- Update assignment status to include 'completed'
-- (status is already text, so no constraint needed)

-- Add policy for auditors to update their assigned assignments (for report upload)
CREATE POLICY "Auditors can update assigned assignments"
ON public.assignments
FOR UPDATE
USING (auth.uid() = allotted_to);

-- Add policy for admins to reject KYC
CREATE POLICY "Admins can reject KYC"
ON public.auditor_profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));