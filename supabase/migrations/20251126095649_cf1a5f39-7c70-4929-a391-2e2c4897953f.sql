-- Create a limited view for auditors to see only basic assignment info
CREATE OR REPLACE VIEW public.assignments_public_view AS
SELECT 
  id,
  audit_type,
  city,
  state,
  pincode,
  audit_date,
  deadline_date,
  status,
  latitude,
  longitude,
  created_at
FROM public.assignments
WHERE status IN ('open', 'in_progress');

-- Grant select permission on the view
GRANT SELECT ON public.assignments_public_view TO authenticated;

-- Create a view for assignments that auditors have applied to or are assigned
CREATE OR REPLACE VIEW public.assignments_auditor_detailed_view AS
SELECT 
  a.*,
  CASE 
    WHEN a.allotted_to = auth.uid() THEN TRUE
    WHEN EXISTS (
      SELECT 1 FROM public.applications app 
      WHERE app.assignment_id = a.id 
      AND app.auditor_id = auth.uid()
    ) THEN TRUE
    ELSE FALSE
  END as can_view_details
FROM public.assignments a;

-- Grant select permission on the detailed view
GRANT SELECT ON public.assignments_auditor_detailed_view TO authenticated;

-- Update RLS policy for assignments to be more restrictive for auditors
DROP POLICY IF EXISTS "Anyone authenticated can view open assignments" ON public.assignments;

-- Auditors can only see full details if they applied or are assigned
CREATE POLICY "Auditors can view applied or assigned assignments"
ON public.assignments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR allotted_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.applications 
    WHERE assignment_id = id 
    AND auditor_id = auth.uid()
  )
);

-- Auditors can see limited public info through the view
-- This is handled by the view permissions above

-- Add default role as 'auditor' for new signups (admin must be assigned manually)
-- This will be enforced in the application code