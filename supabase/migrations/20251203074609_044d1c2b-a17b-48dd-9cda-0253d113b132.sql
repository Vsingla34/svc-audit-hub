-- Create storage policy to allow auditors to upload reports
CREATE POLICY "Auditors can upload reports" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = 'reports');

-- Create storage policy to allow reading reports
CREATE POLICY "Authenticated users can read reports" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'kyc-documents');

-- Create storage policy to allow updating own uploads
CREATE POLICY "Auditors can update own reports" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = owner::text);