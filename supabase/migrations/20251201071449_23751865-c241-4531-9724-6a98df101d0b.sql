-- Fix search_path for generate_assignment_number function
CREATE OR REPLACE FUNCTION generate_assignment_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignment_number IS NULL THEN
    NEW.assignment_number := 'ASN' || LPAD(NEXTVAL('assignment_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;