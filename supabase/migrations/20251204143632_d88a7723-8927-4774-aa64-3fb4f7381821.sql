-- Drop the overly permissive storage policy
DROP POLICY IF EXISTS "Authenticated users can read reports" ON storage.objects;

-- Create owner-scoped read policy - users can only read files in their own folder
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-documents' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- Also add admin access to view all files for KYC review purposes
CREATE POLICY "Admins can read all kyc documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-documents' AND
  public.has_role(auth.uid(), 'admin'::app_role)
);