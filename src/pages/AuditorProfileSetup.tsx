import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, MapPin, FileText, Briefcase, ArrowLeft, Save, Send, AlertCircle, GraduationCap, Hash, Building2, Navigation, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

export default function AuditorProfileSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [uploading, setUploading] = useState({ pan: false, gst: false, resume: false });
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    qualifications: [] as string[],
    pan_card: '',
    gst_number: '',
    resume_url: '',
    experience_years: 0,
    base_city: '',
    base_state: '',
    preferred_states: [] as string[],
    willing_to_travel_radius: 50,
  });

  const [qualificationInput, setQualificationInput] = useState('');

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('auditor_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setKycStatus(data.kyc_status);
      setRejectionReason(data.rejection_reason);
      setFormData({
        qualifications: data.qualifications || [],
        pan_card: data.pan_card || '',
        gst_number: data.gst_number || '',
        resume_url: data.resume_url || '',
        experience_years: data.experience_years || 0,
        base_city: data.base_city || '',
        base_state: data.base_state || '',
        preferred_states: data.preferred_states || [],
        willing_to_travel_radius: data.willing_to_travel_radius || 50,
      });
    }
  };

  const uploadFile = async (file: File, type: 'pan' | 'gst' | 'resume') => {
    if (!user) return null;

    setUploading({ ...uploading, [type]: true });
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${type}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file);

    setUploading({ ...uploading, [type]: false });

    if (uploadError) {
      toast({
        title: 'Upload failed',
        description: uploadError.message,
        variant: 'destructive',
      });
      return null;
    }

    const { data } = supabase.storage
      .from('kyc-documents')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'pan' | 'gst' | 'resume') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadFile(file, type);
    if (url) {
      if (type === 'resume') {
        setFormData({ ...formData, resume_url: url });
      }
      toast({
        title: 'File uploaded',
        description: 'Document uploaded successfully',
      });
    }
  };

  const addQualification = () => {
    if (qualificationInput.trim() && !formData.qualifications.includes(qualificationInput.trim())) {
      setFormData({
        ...formData,
        qualifications: [...formData.qualifications, qualificationInput.trim()],
      });
      setQualificationInput('');
    }
  };

  const removeQualification = (qual: string) => {
    setFormData({
      ...formData,
      qualifications: formData.qualifications.filter(q => q !== qual),
    });
  };

  const toggleState = (state: string) => {
    setFormData({
      ...formData,
      preferred_states: formData.preferred_states.includes(state)
        ? formData.preferred_states.filter(s => s !== state)
        : [...formData.preferred_states, state],
    });
  };

  const handleSaveDraft = async () => {
    if (!user) return;

    setSavingDraft(true);

    const { error } = await supabase
      .from('auditor_profiles')
      .upsert({
        user_id: user.id,
        ...formData,
        kyc_status: kycStatus || 'draft',
      });

    setSavingDraft(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Draft saved',
      description: 'Your profile has been saved as draft',
    });
    setKycStatus('draft');
  };

  const handleSubmitForApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!formData.pan_card || !formData.base_city || !formData.base_state) {
      toast({
        title: 'Incomplete profile',
        description: 'Please fill in all required fields (PAN, Base City, Base State)',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('auditor_profiles')
      .upsert({
        user_id: user.id,
        ...formData,
        kyc_status: 'pending',
      });

    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Profile submitted',
      description: 'Your profile has been submitted for admin approval',
    });
    setKycStatus('pending');
  };

  const getStatusBadge = () => {
    switch (kycStatus) {
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">Approved</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20">Pending Approval</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20">Rejected - Please Update</Badge>;
      case 'draft':
        return <Badge variant="outline" className="border-muted-foreground/30">Draft</Badge>;
      default:
        return <Badge variant="outline" className="border-muted-foreground/30">Not Submitted</Badge>;
    }
  };

  const isEditable = kycStatus !== 'approved' && kycStatus !== 'pending';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')} 
            className="mb-4 gap-2 hover:bg-primary/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/50 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">My Auditor Profile</CardTitle>
                  <CardDescription className="mt-1">
                    {isEditable 
                      ? 'Fill in your details and upload required documents for KYC verification'
                      : kycStatus === 'pending' 
                        ? 'Your profile is under review. You cannot make changes until it is processed.'
                        : 'Your profile has been approved.'}
                  </CardDescription>
                </div>
              </div>
              {getStatusBadge()}
            </div>
          </CardHeader>
          
          <CardContent className="p-6 sm:p-8">
            {/* Rejection Reason Alert */}
            {kycStatus === 'rejected' && rejectionReason && (
              <Alert variant="destructive" className="mb-8 border-red-500/30 bg-red-500/5">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="font-semibold">Your KYC was rejected</AlertTitle>
                <AlertDescription className="mt-2">
                  <strong>Reason:</strong> {rejectionReason}
                  <p className="mt-2 text-sm opacity-80">Please update your profile and resubmit for approval.</p>
                </AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmitForApproval} className="space-y-8">
              {/* Qualifications Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">Qualifications</h3>
                </div>
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Add your qualifications (CA/CS/CMA/MBA etc.)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={qualificationInput}
                      onChange={(e) => setQualificationInput(e.target.value)}
                      placeholder="Enter qualification"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addQualification())}
                      disabled={!isEditable}
                      className="flex-1"
                    />
                    <Button type="button" onClick={addQualification} disabled={!isEditable} size="icon" className="shrink-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[40px]">
                    {formData.qualifications.map((qual) => (
                      <Badge
                        key={qual}
                        variant="secondary"
                        className={`px-3 py-1.5 gap-1 ${isEditable ? 'cursor-pointer hover:bg-destructive/10 hover:text-destructive' : ''}`}
                        onClick={() => isEditable && removeQualification(qual)}
                      >
                        {qual}
                        {isEditable && <X className="h-3 w-3 ml-1" />}
                      </Badge>
                    ))}
                    {formData.qualifications.length === 0 && (
                      <span className="text-sm text-muted-foreground italic">No qualifications added yet</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Experience & Documents Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">Experience & Documents</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Years of Experience</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.experience_years}
                      onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
                      disabled={!isEditable}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">PAN Card Number <span className="text-destructive">*</span></Label>
                    <Input
                      value={formData.pan_card}
                      onChange={(e) => setFormData({ ...formData, pan_card: e.target.value.toUpperCase() })}
                      placeholder="ABCDE1234F"
                      pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                      disabled={!isEditable}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">GST Number (Optional)</Label>
                    <Input
                      value={formData.gst_number}
                      onChange={(e) => setFormData({ ...formData, gst_number: e.target.value.toUpperCase() })}
                      placeholder="22AAAAA0000A1Z5"
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Resume Upload (PDF)
                    </Label>
                    <div className="relative">
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleFileUpload(e, 'resume')}
                        disabled={uploading.resume || !isEditable}
                        className="cursor-pointer"
                      />
                    </div>
                    {formData.resume_url && (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <span className="text-lg">✓</span> Resume uploaded successfully
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Location Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">Location & Preferences</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Base City <span className="text-destructive">*</span></Label>
                    <Input
                      value={formData.base_city}
                      onChange={(e) => setFormData({ ...formData, base_city: e.target.value })}
                      placeholder="Mumbai"
                      disabled={!isEditable}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Base State <span className="text-destructive">*</span></Label>
                    <select
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.base_state}
                      onChange={(e) => setFormData({ ...formData, base_state: e.target.value })}
                      disabled={!isEditable}
                      required
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Navigation className="h-4 w-4" />
                    Willing to Travel (km radius)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="1000"
                    value={formData.willing_to_travel_radius}
                    onChange={(e) => setFormData({ ...formData, willing_to_travel_radius: parseInt(e.target.value) || 0 })}
                    disabled={!isEditable}
                    className="max-w-xs"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Preferred States for Work</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-4 border rounded-xl bg-muted/30">
                    {INDIAN_STATES.map((state) => (
                      <label key={state} className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors ${isEditable ? 'cursor-pointer hover:bg-primary/5' : 'opacity-60'} ${formData.preferred_states.includes(state) ? 'bg-primary/10 border border-primary/20' : 'bg-background border border-transparent'}`}>
                        <input
                          type="checkbox"
                          checked={formData.preferred_states.includes(state)}
                          onChange={() => isEditable && toggleState(state)}
                          disabled={!isEditable}
                          className="accent-primary h-4 w-4 rounded"
                        />
                        <span className="text-sm">{state}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {isEditable && (
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-border/50">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1 h-12"
                    onClick={handleSaveDraft}
                    disabled={savingDraft || loading || Object.values(uploading).some(v => v)}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {savingDraft ? 'Saving...' : 'Save as Draft'}
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 h-12"
                    disabled={loading || savingDraft || Object.values(uploading).some(v => v)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {loading ? 'Submitting...' : 'Submit for Approval'}
                  </Button>
                </div>
              )}

              {kycStatus === 'pending' && (
                <div className="text-center py-6 bg-amber-500/5 rounded-xl border border-amber-500/20">
                  <p className="text-muted-foreground">Your profile is under review. You will be notified once it is approved.</p>
                </div>
              )}
              
              {kycStatus === 'approved' && (
                <div className="text-center py-6 bg-green-500/5 rounded-xl border border-green-500/20">
                  <p className="text-green-600 font-medium">✓ Your profile has been approved. You can now apply for assignments.</p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}