-- Fix: Allow auditors to create their own profiles
CREATE POLICY "Auditors can create own profile"
ON public.auditor_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add policy to allow admins to delete assignments
CREATE POLICY "Admins can delete assignments"
ON public.assignments
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add policy to allow auditors to delete their own applications
CREATE POLICY "Auditors can delete own applications"
ON public.applications
FOR DELETE
USING (auth.uid() = auditor_id);

-- Add policy to allow admins to delete applications
CREATE POLICY "Admins can delete applications"
ON public.applications
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add OPE field to assignments if not already added (for Out of Pocket Expenses)
-- This field already exists, so no need to add it