-- Create assignment_activities table for timeline tracking
CREATE TABLE public.assignment_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create assignment_documents table for multiple document uploads
CREATE TABLE public.assignment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  document_type TEXT NOT NULL DEFAULT 'supporting',
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on both tables
ALTER TABLE public.assignment_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for assignment_activities
CREATE POLICY "Admins can view all activities"
ON public.assignment_activities FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auditors can view activities for their assignments"
ON public.assignment_activities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.assignments a 
    WHERE a.id = assignment_id 
    AND a.allotted_to = auth.uid()
  )
);

CREATE POLICY "System can insert activities"
ON public.assignment_activities FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- RLS policies for assignment_documents
CREATE POLICY "Admins can view all documents"
ON public.assignment_documents FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auditors can view documents for their assignments"
ON public.assignment_documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.assignments a 
    WHERE a.id = assignment_id 
    AND a.allotted_to = auth.uid()
  )
);

CREATE POLICY "Auditors can upload documents for their assignments"
ON public.assignment_documents FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by AND
  EXISTS (
    SELECT 1 FROM public.assignments a 
    WHERE a.id = assignment_id 
    AND a.allotted_to = auth.uid()
  )
);

CREATE POLICY "Auditors can delete their own documents"
ON public.assignment_documents FOR DELETE
USING (auth.uid() = uploaded_by);

CREATE POLICY "Admins can delete any document"
ON public.assignment_documents FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_assignment_activities_assignment ON public.assignment_activities(assignment_id);
CREATE INDEX idx_assignment_activities_created ON public.assignment_activities(created_at DESC);
CREATE INDEX idx_assignment_documents_assignment ON public.assignment_documents(assignment_id);

-- Enable realtime for activities (for live timeline updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignment_activities;