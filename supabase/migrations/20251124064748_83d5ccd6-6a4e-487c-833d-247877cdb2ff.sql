-- Create invoices/payments table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  auditor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Financial details
  base_amount NUMERIC NOT NULL,
  ope_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  tds_rate NUMERIC DEFAULT 10,
  tds_amount NUMERIC NOT NULL,
  net_payable NUMERIC NOT NULL,
  
  -- Payment tracking
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'approved', 'processing', 'paid', 'rejected')),
  payment_date DATE,
  payment_reference TEXT,
  payment_remarks TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Auditors can view their own invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (auth.uid() = auditor_id);

CREATE POLICY "Auditors can create their own invoices"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auditor_id);

CREATE POLICY "Admins can view all invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update invoices"
ON public.invoices
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_invoices_auditor_id ON public.invoices(auditor_id);
CREATE INDEX idx_invoices_assignment_id ON public.invoices(assignment_id);
CREATE INDEX idx_invoices_payment_status ON public.invoices(payment_status);