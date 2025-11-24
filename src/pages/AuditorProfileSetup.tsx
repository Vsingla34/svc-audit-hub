import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, MapPin, FileText, Briefcase } from 'lucide-react';

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
  const [uploading, setUploading] = useState({ pan: false, gst: false, resume: false });
  
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
      description: 'Your KYC is under review by admin',
    });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Complete Your Auditor Profile
            </CardTitle>
            <CardDescription>
              Fill in your details and upload required documents for KYC verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Qualifications */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Qualifications (CA/CS/CMA/MBA etc.)
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={qualificationInput}
                    onChange={(e) => setQualificationInput(e.target.value)}
                    placeholder="Enter qualification"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addQualification())}
                  />
                  <Button type="button" onClick={addQualification}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.qualifications.map((qual) => (
                    <span
                      key={qual}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm cursor-pointer hover:bg-primary/20"
                      onClick={() => removeQualification(qual)}
                    >
                      {qual} ×
                    </span>
                  ))}
                </div>
              </div>

              {/* Experience */}
              <div className="space-y-2">
                <Label>Years of Experience</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.experience_years}
                  onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>

              {/* PAN Card */}
              <div className="space-y-2">
                <Label>PAN Card Number</Label>
                <Input
                  value={formData.pan_card}
                  onChange={(e) => setFormData({ ...formData, pan_card: e.target.value.toUpperCase() })}
                  placeholder="ABCDE1234F"
                  pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                  required
                />
              </div>

              {/* GST Number */}
              <div className="space-y-2">
                <Label>GST Number (Optional)</Label>
                <Input
                  value={formData.gst_number}
                  onChange={(e) => setFormData({ ...formData, gst_number: e.target.value.toUpperCase() })}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>

              {/* Resume Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Resume Upload
                </Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileUpload(e, 'resume')}
                  disabled={uploading.resume}
                />
                {formData.resume_url && (
                  <p className="text-sm text-muted-foreground">✓ Resume uploaded</p>
                )}
              </div>

              {/* Base Location */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Base City
                  </Label>
                  <Input
                    value={formData.base_city}
                    onChange={(e) => setFormData({ ...formData, base_city: e.target.value })}
                    placeholder="Mumbai"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Base State</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={formData.base_state}
                    onChange={(e) => setFormData({ ...formData, base_state: e.target.value })}
                    required
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Travel Radius */}
              <div className="space-y-2">
                <Label>Willing to Travel (km radius)</Label>
                <Input
                  type="number"
                  min="0"
                  max="1000"
                  value={formData.willing_to_travel_radius}
                  onChange={(e) => setFormData({ ...formData, willing_to_travel_radius: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>

              {/* Preferred States */}
              <div className="space-y-2">
                <Label>Preferred States for Work</Label>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                  {INDIAN_STATES.map((state) => (
                    <label key={state} className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded">
                      <input
                        type="checkbox"
                        checked={formData.preferred_states.includes(state)}
                        onChange={() => toggleState(state)}
                        className="accent-primary"
                      />
                      <span className="text-sm">{state}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading || Object.values(uploading).some(v => v)}>
                {loading ? 'Submitting...' : 'Submit for KYC Approval'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}