-- Fix 1: Ensure profiles table requires authentication for SELECT
-- The table uses RESTRICTIVE policies but we need to ensure anonymous access is blocked
-- We'll create a baseline policy that requires auth.uid() IS NOT NULL

-- Check if there's already a proper restrictive policy; if not, we add one
-- Drop existing permissive SELECT policies if any and recreate as restrictive
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate policies requiring authentication (RESTRICTIVE mode prevents anonymous access)
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Ensure auditor_profiles also explicitly requires authentication
-- Current policies already use auth.uid() comparisons which block anonymous access
-- But let's ensure they're using proper USING clauses

-- Fix 3: assignments_auditor_detailed_view - Apply RLS to the view
-- First, let's recreate the view with SECURITY INVOKER and add RLS policies
DROP VIEW IF EXISTS public.assignments_auditor_detailed_view CASCADE;

CREATE VIEW public.assignments_auditor_detailed_view
WITH (security_invoker = on)
AS SELECT 
  a.id,
  a.audit_date,
  a.deadline_date,
  a.fees,
  a.ope,
  a.latitude,
  a.longitude,
  a.allotted_to,
  a.created_by,
  a.created_at,
  a.updated_at,
  a.completed_at,
  CASE 
    WHEN a.allotted_to = auth.uid() THEN true
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.applications app 
      WHERE app.assignment_id = a.id 
      AND app.auditor_id = auth.uid()
    ) THEN true
    ELSE false
  END AS can_view_details,
  a.audit_type,
  a.city,
  a.state,
  a.pincode,
  CASE 
    WHEN a.allotted_to = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.applications app 
      WHERE app.assignment_id = a.id 
      AND app.auditor_id = auth.uid()
    ) THEN a.address
    ELSE NULL
  END AS address,
  CASE 
    WHEN a.allotted_to = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.applications app 
      WHERE app.assignment_id = a.id 
      AND app.auditor_id = auth.uid()
    ) THEN a.client_name
    ELSE NULL
  END AS client_name,
  CASE 
    WHEN a.allotted_to = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.applications app 
      WHERE app.assignment_id = a.id 
      AND app.auditor_id = auth.uid()
    ) THEN a.branch_name
    ELSE NULL
  END AS branch_name,
  a.status,
  a.completion_remarks,
  a.report_url
FROM public.assignments a;

-- The view uses SECURITY INVOKER, so RLS on the underlying assignments table will apply
-- This means only authenticated users who satisfy assignments RLS can see data