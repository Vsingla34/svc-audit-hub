-- Add unique assignment number, rating, and completion tracking fields
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS assignment_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS auditor_rating NUMERIC CHECK (auditor_rating >= 1 AND auditor_rating <= 5),
ADD COLUMN IF NOT EXISTS completion_status TEXT DEFAULT 'not_started' CHECK (completion_status IN ('not_started', 'completed', 'incomplete')),
ADD COLUMN IF NOT EXISTS incomplete_reason TEXT;

-- Create sequence for assignment numbers
CREATE SEQUENCE IF NOT EXISTS assignment_number_seq START WITH 1;

-- Generate assignment numbers for existing assignments using a better approach
WITH numbered_assignments AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS row_num
  FROM public.assignments
  WHERE assignment_number IS NULL
)
UPDATE public.assignments a
SET assignment_number = 'ASN' || LPAD(n.row_num::TEXT, 6, '0')
FROM numbered_assignments n
WHERE a.id = n.id;

-- Set sequence to continue from current max
SELECT setval('assignment_number_seq', 
  COALESCE((SELECT MAX(CAST(SUBSTRING(assignment_number FROM 4) AS INTEGER)) FROM public.assignments WHERE assignment_number IS NOT NULL), 0) + 1,
  false
);

-- Create function to auto-generate assignment numbers for new assignments
CREATE OR REPLACE FUNCTION generate_assignment_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignment_number IS NULL THEN
    NEW.assignment_number := 'ASN' || LPAD(NEXTVAL('assignment_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate assignment numbers
DROP TRIGGER IF EXISTS set_assignment_number ON public.assignments;
CREATE TRIGGER set_assignment_number
BEFORE INSERT ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION generate_assignment_number();

-- Remove bid_amount from applications table (drop it, not needed anymore)
ALTER TABLE public.applications DROP COLUMN IF EXISTS bid_amount;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  related_assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can create notifications for any user
CREATE POLICY "Admins can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Update trigger for notifications
DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_assignments_assignment_number ON public.assignments(assignment_number);