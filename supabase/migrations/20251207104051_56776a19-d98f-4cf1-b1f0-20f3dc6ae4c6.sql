-- Fix 1: Add missing RLS policies for user_roles table to allow admin management
CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Recreate views with SECURITY INVOKER to respect RLS policies

-- Drop and recreate assignments_public_view with SECURITY INVOKER
DROP VIEW IF EXISTS public.assignments_public_view;
CREATE VIEW public.assignments_public_view
WITH (security_invoker = on) AS
SELECT 
  id,
  audit_type,
  city,
  state,
  pincode,
  audit_date,
  deadline_date,
  latitude,
  longitude,
  status,
  created_at
FROM public.assignments
WHERE status = 'open';

-- Drop and recreate assignments_auditor_detailed_view with SECURITY INVOKER
DROP VIEW IF EXISTS public.assignments_auditor_detailed_view;
CREATE VIEW public.assignments_auditor_detailed_view
WITH (security_invoker = on) AS
SELECT 
  id,
  audit_type,
  city,
  state,
  pincode,
  address,
  client_name,
  branch_name,
  audit_date,
  deadline_date,
  fees,
  ope,
  latitude,
  longitude,
  status,
  allotted_to,
  created_by,
  created_at,
  updated_at,
  completed_at,
  completion_remarks,
  report_url,
  CASE 
    WHEN allotted_to = auth.uid() THEN true
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN true
    ELSE false
  END as can_view_details
FROM public.assignments;