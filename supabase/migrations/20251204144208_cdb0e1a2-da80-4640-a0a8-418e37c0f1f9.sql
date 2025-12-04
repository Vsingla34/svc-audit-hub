-- Create a trigger function to automatically assign 'auditor' role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default 'auditor' role for new user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'auditor')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Also create an auditor profile for the new user
  INSERT INTO public.auditor_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run after profile is created (which happens after auth.users insert)
DROP TRIGGER IF EXISTS on_profile_created_assign_role ON public.profiles;
CREATE TRIGGER on_profile_created_assign_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Fix: Assign auditor role to Naina who is missing a role
INSERT INTO public.user_roles (user_id, role)
VALUES ('eaae438f-d106-4175-a682-ffe895f563bb', 'auditor')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create auditor profile for Naina if not exists
INSERT INTO public.auditor_profiles (user_id)
VALUES ('eaae438f-d106-4175-a682-ffe895f563bb')
ON CONFLICT (user_id) DO NOTHING;