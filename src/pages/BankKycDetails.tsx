import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, CheckCircle2, AlertCircle, Landmark, CreditCard, QrCode, FileSignature, Fingerprint, Clock, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function BankKycDetails() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [bankStatus, setBankStatus] = useState<string>('unverified');

  const [formData, setFormData] = useState({
    bank_account_no: '',
    ifsc_code: '',
    pan_number: '',
    aadhaar_number: '',
    pan_card_url: '',
    cancelled_cheque_url: '',
    upi_qr_url: '',
    aadhaar_front_url: '',
    aadhaar_back_url: ''
  });

  useEffect(() => {
    if (user) fetchBankDetails();
  }, [user]);

  const fetchBankDetails = async () => {
    setLoading(true);
    try {
    
      const { data: bankData } = await supabase
        .from('bank_kyc_details')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      const { data: audProfile } = await supabase
        .from('auditor_profiles')
        .select('bank_status, pending_bank_data')
        .eq('user_id', user?.id)
        .maybeSingle();

      setBankStatus(audProfile?.bank_status || 'unverified');

      const isPending = audProfile?.bank_status === 'pending';
      const draft = audProfile?.pending_bank_data || {};

      // If they have a pending draft, load that into the form. Otherwise, load live data.
      const getValue = (key: string) => {
        if (isPending && draft[key] !== undefined && draft[key] !== null) return draft[key];
        return bankData?.[key] || '';
      };

      setFormData({
        bank_account_no: getValue('bank_account_no'),
        ifsc_code: getValue('ifsc_code'),
        pan_number: getValue('pan_number'),
        aadhaar_number: getValue('aadhaar_number'),
        pan_card_url: getValue('pan_card_url'),
        cancelled_cheque_url: getValue('cancelled_cheque_url'),
        upi_qr_url: getValue('upi_qr_url'),
        aadhaar_front_url: getValue('aadhaar_front_url'),
        aadhaar_back_url: getValue('aadhaar_back_url')
      });
      
    } catch (error: any) {
      toast.error('Failed to load banking details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingField(fieldName);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/bank-kyc/${fieldName}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setFormData(prev => ({ ...prev, [fieldName]: filePath }));
      toast.success(`${fieldName.replace(/_/g, ' ')} uploaded successfully!`);
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploadingField(null);
      e.target.value = ''; 
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    
    try {
      if (
        !formData.bank_account_no || 
        !formData.ifsc_code || 
        !formData.pan_number || 
        !formData.aadhaar_number ||
        !formData.pan_card_url || 
        !formData.cancelled_cheque_url ||
        !formData.aadhaar_front_url ||
        !formData.aadhaar_back_url
      ) {
        throw new Error("Please fill in all required text fields and upload all mandatory documents.");
      }

      // NEW LOGIC: Save the form strictly into the pending_bank_data draft column
      const draftPayload = { ...formData };

      // Ensure an auditor_profile exists first, if not, create it
      const { data: existingProfile } = await supabase.from('auditor_profiles').select('id').eq('user_id', user.id).maybeSingle();

      if (existingProfile) {
        const { error } = await supabase.from('auditor_profiles').update({
          bank_status: 'pending',
          pending_bank_data: draftPayload
        }).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('auditor_profiles').insert([{
          user_id: user.id,
          bank_status: 'pending',
          pending_bank_data: draftPayload
        }]);
        if (error) throw error;
      }

      setBankStatus('pending');
      toast.success('Details saved! Submitted for Admin Approval.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Bank & KYC Details" navItems={auditorNavItems} activeTab="bank-kyc">
        <div className="flex items-center justify-center py-20 text-muted-foreground animate-pulse">Loading your details...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Bank & KYC Details" navItems={auditorNavItems} activeTab="bank-kyc">
      <div className="max-w-5xl mx-auto py-6 space-y-6">
        
        {bankStatus === 'pending' ? (
           <Alert className="bg-blue-50 border-blue-200 text-blue-800 border-l-4 border-l-blue-500">
             <Clock className="h-4 w-4 text-blue-600" />
             <AlertTitle>Bank Updates Pending Review</AlertTitle>
             <AlertDescription className="font-medium">
               You have pending banking/KYC changes awaiting admin approval. The form below shows your drafted changes. You can modify and resubmit if needed.
             </AlertDescription>
          </Alert>
        ) : (
          <Alert className="bg-muted/50 border-muted text-muted-foreground border-l-4 border-l-gray-400">
             <Info className="h-4 w-4 text-gray-500" />
             <AlertTitle>Information</AlertTitle>
             <AlertDescription className="font-medium">
               Your bank details are currently live. Note: If you edit and save changes here, your payout profile will temporarily require Admin re-approval.
             </AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-md">
          <CardHeader className="bg-muted/10 border-b pb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#4338CA]/10 rounded-xl"><Landmark className="h-6 w-6 text-[#4338CA]" /></div>
              <div>
                <CardTitle className="text-2xl">Payout Details & KYC</CardTitle>
                <CardDescription className="text-base mt-1">Securely provide your banking information to receive audit payouts.</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-8 pt-8">
            {/* TEXT FIELDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label htmlFor="bank_account_no">Bank Account Number <span className="text-red-500">*</span></Label><Input id="bank_account_no" name="bank_account_no" value={formData.bank_account_no} onChange={handleChange} type="password" placeholder="Enter Account Number" /></div>
              <div className="space-y-2"><Label htmlFor="ifsc_code">IFSC Code <span className="text-red-500">*</span></Label><Input id="ifsc_code" name="ifsc_code" value={formData.ifsc_code} onChange={handleChange} placeholder="e.g. HDFC0001234" className="uppercase" /></div>
              <div className="space-y-2 border-t pt-4"><Label htmlFor="pan_number" className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground" /> PAN Number <span className="text-red-500">*</span></Label><Input id="pan_number" name="pan_number" value={formData.pan_number} onChange={handleChange} placeholder="ABCDE1234F" className="uppercase" maxLength={10} /></div>
              <div className="space-y-2 border-t pt-4"><Label htmlFor="aadhaar_number" className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-muted-foreground" /> Aadhaar Number <span className="text-red-500">*</span></Label><Input id="aadhaar_number" name="aadhaar_number" value={formData.aadhaar_number} onChange={handleChange} placeholder="1234 5678 9012" maxLength={14} /></div>
            </div>

            {/* DOCUMENT UPLOADS */}
            <div className="bg-muted/10 p-6 rounded-xl border space-y-6">
              <h3 className="font-semibold text-lg border-b pb-2">Document Verification</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* AADHAAR FRONT */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium"><Fingerprint className="h-4 w-4" /> Aadhaar Front <span className="text-red-500">*</span></Label>
                  <label htmlFor="aadhaar_front_url" className={`cursor-pointer border-2 border-dashed rounded-xl h-32 flex flex-col items-center justify-center transition-colors ${formData.aadhaar_front_url ? 'border-green-500 bg-green-50/50 hover:bg-green-50' : 'border-[#4338CA]/30 hover:bg-[#4338CA]/5 hover:border-[#4338CA]/50 bg-white'}`}>
                    {uploadingField === 'aadhaar_front_url' ? <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span> : formData.aadhaar_front_url ? <><CheckCircle2 className="h-8 w-8 text-green-500 mb-2" /><span className="text-sm font-medium text-green-700">Uploaded</span></> : <><Upload className="h-6 w-6 text-muted-foreground mb-2" /><span className="text-sm font-medium">Upload Image/PDF</span></>}
                  </label>
                  <input id="aadhaar_front_url" type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'aadhaar_front_url')} disabled={uploadingField !== null} />
                </div>

                {/* AADHAAR BACK */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium"><Fingerprint className="h-4 w-4" /> Aadhaar Back <span className="text-red-500">*</span></Label>
                  <label htmlFor="aadhaar_back_url" className={`cursor-pointer border-2 border-dashed rounded-xl h-32 flex flex-col items-center justify-center transition-colors ${formData.aadhaar_back_url ? 'border-green-500 bg-green-50/50 hover:bg-green-50' : 'border-[#4338CA]/30 hover:bg-[#4338CA]/5 hover:border-[#4338CA]/50 bg-white'}`}>
                    {uploadingField === 'aadhaar_back_url' ? <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span> : formData.aadhaar_back_url ? <><CheckCircle2 className="h-8 w-8 text-green-500 mb-2" /><span className="text-sm font-medium text-green-700">Uploaded</span></> : <><Upload className="h-6 w-6 text-muted-foreground mb-2" /><span className="text-sm font-medium">Upload Image/PDF</span></>}
                  </label>
                  <input id="aadhaar_back_url" type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'aadhaar_back_url')} disabled={uploadingField !== null} />
                </div>

                {/* PAN CARD UPLOAD */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium"><CreditCard className="h-4 w-4" /> PAN Card <span className="text-red-500">*</span></Label>
                  <label htmlFor="pan_card_url" className={`cursor-pointer border-2 border-dashed rounded-xl h-32 flex flex-col items-center justify-center transition-colors ${formData.pan_card_url ? 'border-green-500 bg-green-50/50 hover:bg-green-50' : 'border-[#4338CA]/30 hover:bg-[#4338CA]/5 hover:border-[#4338CA]/50 bg-white'}`}>
                    {uploadingField === 'pan_card_url' ? <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span> : formData.pan_card_url ? <><CheckCircle2 className="h-8 w-8 text-green-500 mb-2" /><span className="text-sm font-medium text-green-700">Uploaded</span></> : <><Upload className="h-6 w-6 text-muted-foreground mb-2" /><span className="text-sm font-medium">Upload Image/PDF</span></>}
                  </label>
                  <input id="pan_card_url" type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'pan_card_url')} disabled={uploadingField !== null} />
                </div>

                {/* CANCELLED CHEQUE UPLOAD */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium"><FileSignature className="h-4 w-4" /> Cancelled Cheque <span className="text-red-500">*</span></Label>
                  <label htmlFor="cancelled_cheque_url" className={`cursor-pointer border-2 border-dashed rounded-xl h-32 flex flex-col items-center justify-center transition-colors ${formData.cancelled_cheque_url ? 'border-green-500 bg-green-50/50 hover:bg-green-50' : 'border-[#4338CA]/30 hover:bg-[#4338CA]/5 hover:border-[#4338CA]/50 bg-white'}`}>
                    {uploadingField === 'cancelled_cheque_url' ? <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span> : formData.cancelled_cheque_url ? <><CheckCircle2 className="h-8 w-8 text-green-500 mb-2" /><span className="text-sm font-medium text-green-700">Uploaded</span></> : <><Upload className="h-6 w-6 text-muted-foreground mb-2" /><span className="text-sm font-medium">Upload Image/PDF</span></>}
                  </label>
                  <input id="cancelled_cheque_url" type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'cancelled_cheque_url')} disabled={uploadingField !== null} />
                </div>

                {/* UPI QR CODE UPLOAD */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium"><QrCode className="h-4 w-4" /> UPI QR Code <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
                  <label htmlFor="upi_qr_url" className={`cursor-pointer border-2 border-dashed rounded-xl h-32 flex flex-col items-center justify-center transition-colors ${formData.upi_qr_url ? 'border-green-500 bg-green-50/50 hover:bg-green-50' : 'border-[#4338CA]/30 hover:bg-[#4338CA]/5 hover:border-[#4338CA]/50 bg-white'}`}>
                    {uploadingField === 'upi_qr_url' ? <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span> : formData.upi_qr_url ? <><CheckCircle2 className="h-8 w-8 text-green-500 mb-2" /><span className="text-sm font-medium text-green-700">Uploaded</span></> : <><Upload className="h-6 w-6 text-muted-foreground mb-2" /><span className="text-sm font-medium">Upload QR Image</span></>}
                  </label>
                  <input id="upi_qr_url" type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'upi_qr_url')} disabled={uploadingField !== null} />
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="bg-muted/5 border-t px-6 py-4 flex justify-end">
            <Button size="lg" className="bg-[#4338CA] hover:bg-[#4338CA]/90 font-semibold px-8" onClick={handleSave} disabled={saving || uploadingField !== null}>
              {saving ? 'Drafting Details...' : bankStatus === 'pending' ? 'Update Draft Changes' : 'Submit Changes for Approval'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
}