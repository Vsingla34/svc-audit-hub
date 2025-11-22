-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'auditor', 'client');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- User roles policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create auditor profiles table
CREATE TABLE public.auditor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  qualifications TEXT[], -- CA, CS, CMA, etc.
  pan_card TEXT,
  gst_number TEXT,
  resume_url TEXT,
  experience_years INTEGER,
  preferred_states TEXT[],
  preferred_cities TEXT[],
  base_city TEXT,
  base_state TEXT,
  willing_to_travel_radius INTEGER, -- in km
  kyc_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  rating DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.auditor_profiles ENABLE ROW LEVEL SECURITY;

-- Auditor profiles policies
CREATE POLICY "Auditors can view own profile"
  ON public.auditor_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Auditors can update own profile"
  ON public.auditor_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all auditor profiles"
  ON public.auditor_profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update auditor profiles"
  ON public.auditor_profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create assignments table
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  audit_type TEXT NOT NULL, -- Stock, Concurrent, Credit, etc.
  audit_date DATE NOT NULL,
  deadline_date DATE NOT NULL,
  fees DECIMAL(10,2) NOT NULL,
  ope DECIMAL(10,2) DEFAULT 0, -- Out of Pocket Expenses
  status TEXT DEFAULT 'open', -- open, applied, allotted, in_progress, completed, paid
  allotted_to UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Assignments policies
CREATE POLICY "Anyone authenticated can view open assignments"
  ON public.assignments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can create assignments"
  ON public.assignments FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update assignments"
  ON public.assignments FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create applications table
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
  auditor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (assignment_id, auditor_id)
);

-- Enable RLS
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Applications policies
CREATE POLICY "Auditors can view own applications"
  ON public.applications FOR SELECT
  USING (auth.uid() = auditor_id);

CREATE POLICY "Auditors can create applications"
  ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = auditor_id);

CREATE POLICY "Admins can view all applications"
  ON public.applications FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update applications"
  ON public.applications FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_auditor_profiles_updated_at
  BEFORE UPDATE ON public.auditor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();