-- Drop the buggy policy
DROP POLICY IF EXISTS "Auditors can view applied or assigned assignments" ON assignments;

-- Create corrected policy - auditors can view:
-- 1. Open assignments (status = 'open') for applying
-- 2. Assignments they have applied for
-- 3. Assignments allotted to them
CREATE POLICY "Auditors can view open applied or assigned assignments" ON assignments
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR status = 'open' 
  OR allotted_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM applications 
    WHERE applications.assignment_id = assignments.id 
    AND applications.auditor_id = auth.uid()
  )
);

-- Also ensure auditors can view the public view
DROP POLICY IF EXISTS "Everyone can view open assignments" ON assignments_public_view;

-- Recreate the public view with security invoker for proper RLS
DROP VIEW IF EXISTS assignments_public_view;
CREATE VIEW assignments_public_view WITH (security_invoker=on) AS
SELECT 
  id,
  state,
  city,
  pincode,
  audit_type,
  audit_date,
  deadline_date,
  status,
  latitude,
  longitude,
  created_at
FROM assignments
WHERE status = 'open';