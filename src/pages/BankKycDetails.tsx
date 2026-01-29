import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, Landmark, CreditCard, FileCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';

export default function BankKycDetails() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({ aadhaarFront: false, aadhaarBack: false });
  const [consent, setConsent] = useState(false);
  
  const [formData, setFormData] = useState({
    bank_account_no: '',
    ifsc_code: '',
    pan_number: '',
    aadhaar_front_url: '',
    aadhaar_back_url: ''
  });

  useEffect(() => {
    if (user) {
      loadBankDetails();
    }
  }, [user]);

  const loadBankDetails = async () => {
    try {
      const { data } = await supabase
        .from('bank_kyc_details')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (data) {
        setFormData({
          bank_account_no: data.bank_account_no || '',
          ifsc_code: data.ifsc_code || '',
          pan_number: data.pan_number || '',
          aadhaar_front_url: data.aadhaar_front_url || '',
          aadhaar_back_url: data.aadhaar_back_url || ''
        });
        setConsent(true);
      }
    } catch (error) {
      console.error('Error loading bank details:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'aadhaarFront' | 'aadhaarBack') => {
    if (!user || !e.target.files?.[0]) return;

    const file = e.target.files[0];
    setUploading(prev => ({ ...prev, [type]: true }));
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/aadhaar_${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const fieldName = type === 'aadhaarFront' ? 'aadhaar_front_url' : 'aadhaar_back_url';
      setFormData(prev => ({ ...prev, [fieldName]: fileName }));
      
      toast({ title: 'Upload successful', description: 'Document uploaded successfully' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      toast({ title: 'Consent Required', description: 'Please agree to the terms before submitting.', variant: 'destructive' });
      return;
    }
    if (!formData.bank_account_no || !formData.ifsc_code || !formData.pan_number) {
       toast({ title: 'Missing Fields', description: 'Please fill in all text fields.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bank_kyc_details')
        .upsert({ user_id: user?.id, ...formData, updated_at: new Date().toISOString() });

      if (error) throw error;
      toast({ title: 'Saved Successfully', description: 'Your bank and KYC details have been updated.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Bank & KYC Details" navItems={auditorNavItems} activeTab="bank-kyc">
      <div className="max-w-4xl mx-auto py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Landmark className="h-6 w-6 text-primary" />
              <CardTitle>Banking & Identity Information</CardTitle>
            </div>
            <CardDescription>
              Provide your bank account details for payouts and upload KYC documents for verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
                  <CreditCard className="h-5 w-5" /> Bank Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="bank_account">Bank Account Number</Label>
                    <Input id="bank_account" value={formData.bank_account_no} onChange={(e) => setFormData({...formData, bank_account_no: e.target.value})} type="text" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ifsc">IFSC Code</Label>
                    <Input id="ifsc" value={formData.ifsc_code} onChange={(e) => setFormData({...formData, ifsc_code: e.target.value.toUpperCase()})} maxLength={11} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
                  <FileCheck className="h-5 w-5" /> Identity & KYC
                </h3>
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="pan">PAN Number</Label>
                  <Input id="pan" value={formData.pan_number} onChange={(e) => setFormData({...formData, pan_number: e.target.value.toUpperCase()})} maxLength={10} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <Label>Aadhaar Card (Front)</Label>
                    <Input type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'aadhaarFront')} disabled={uploading.aadhaarFront} />
                    {formData.aadhaar_front_url && <p className="text-sm text-green-600">✓ Front image uploaded</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Aadhaar Card (Back)</Label>
                    <Input type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'aadhaarBack')} disabled={uploading.aadhaarBack} />
                    {formData.aadhaar_back_url && <p className="text-sm text-green-600">✓ Back image uploaded</p>}
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <div className="flex items-start space-x-2 p-4 border rounded-lg bg-muted/30">
                  <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked as boolean)} />
                  <div className="grid gap-1.5">
                    <Label htmlFor="consent">I hereby declare that the details furnished above are true and correct.</Label>
                    <p className="text-xs text-muted-foreground">I consent to AuditHub using this information for verification.</p>
                  </div>
                </div>
                <Button type="submit" disabled={loading || !consent}>
                  {loading ? 'Saving...' : 'Save & Update Details'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}