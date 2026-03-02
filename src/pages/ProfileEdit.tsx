import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Upload, User, Briefcase, MapPin, CheckCircle2, FileText, Image as ImageIcon, Users, AlertCircle, Clock } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function ProfileEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<string>('unverified');
  const [originalSensitiveData, setOriginalSensitiveData] = useState<any>({});

  const [formData, setFormData] = useState({
    full_name: '', phone: '', qualifications: '', pan_card: '', gst_number: '',
    experience_years: 0, preferred_states: '', preferred_cities: '', 
    base_city: '', base_state: '', willing_to_travel_radius: 0,
    has_manpower: false, manpower_count: 0, competencies: '', core_competency: '',
    address: '', resume_url: '', profile_photo_url: ''
  });

  useEffect(() => {
    if (user) fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
      const { data: audProfile } = await supabase.from('auditor_profiles').select('*').eq('user_id', user?.id).maybeSingle();

      setProfileStatus(audProfile?.profile_status || 'unverified');

      // Store a snapshot of ONLY the live fields that require approval for comparison
      setOriginalSensitiveData({
        qualifications: audProfile?.qualifications?.join(', ') || '',
        resume_url: audProfile?.resume_url || '',
        has_manpower: audProfile?.has_manpower || false,
        manpower_count: audProfile?.manpower_count || 0,
        competencies: audProfile?.competencies?.join(', ') || '',
        core_competency: audProfile?.core_competency || '',
        address: audProfile?.address || '',
      });

      // If they have a pending draft, load the drafted changes. Otherwise, load live data.
      const isPending = audProfile?.profile_status === 'pending';
      const draft = audProfile?.pending_profile_data || {};
      const getValue = (key: string, isArray = false) => {
        if (isPending && draft[key] !== undefined && draft[key] !== null) {
          return isArray && Array.isArray(draft[key]) ? draft[key].join(', ') : draft[key];
        }
        const val = audProfile?.[key];
        return isArray && Array.isArray(val) ? val.join(', ') : (val || '');
      };

      setFormData({
        full_name: profile?.full_name || '',
        phone: profile?.phone || '',
        qualifications: getValue('qualifications', true),
        pan_card: getValue('pan_card'),
        gst_number: getValue('gst_number'),
        experience_years: getValue('experience_years'),
        preferred_states: getValue('preferred_states', true),
        preferred_cities: getValue('preferred_cities', true),
        base_city: getValue('base_city'),
        base_state: getValue('base_state'),
        willing_to_travel_radius: getValue('willing_to_travel_radius'),
        has_manpower: getValue('has_manpower'),
        manpower_count: getValue('manpower_count'),
        competencies: getValue('competencies', true),
        core_competency: getValue('core_competency'),
        address: getValue('address'),
        resume_url: getValue('resume_url'),
        profile_photo_url: getValue('profile_photo_url')
      });
    } catch (error: any) {
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingField(fieldName);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/profile/${fieldName}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('kyc-documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      setFormData(prev => ({ ...prev, [fieldName]: filePath }));
      toast.success('File uploaded successfully!');
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
      let requiresReapproval = false;
      const currentManpowerCount = formData.has_manpower ? Number(formData.manpower_count) : 0;
      
      if (
        formData.qualifications !== originalSensitiveData.qualifications ||
        formData.resume_url !== originalSensitiveData.resume_url ||
        formData.has_manpower !== originalSensitiveData.has_manpower ||
        currentManpowerCount !== originalSensitiveData.manpower_count ||
        formData.competencies !== originalSensitiveData.competencies ||
        formData.core_competency !== originalSensitiveData.core_competency ||
        formData.address !== originalSensitiveData.address
      ) {
        requiresReapproval = true;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: formData.full_name, phone: formData.phone })
        .eq('id', user.id);
      if (profileError) throw profileError;

      // Split into instant vs draft fields
      const instantPayload = {
        experience_years: Number(formData.experience_years) || 0,
        pan_card: formData.pan_card || null,
        gst_number: formData.gst_number || null,
        preferred_states: formData.preferred_states.split(',').map(s => s.trim()).filter(Boolean),
        preferred_cities: formData.preferred_cities.split(',').map(s => s.trim()).filter(Boolean),
        base_city: formData.base_city || null,
        base_state: formData.base_state || null,
        willing_to_travel_radius: Number(formData.willing_to_travel_radius) || 0,
        profile_photo_url: formData.profile_photo_url || null,
      };

      const draftPayload = {
        qualifications: formData.qualifications.split(',').map(s => s.trim()).filter(Boolean),
        resume_url: formData.resume_url || null,
        has_manpower: formData.has_manpower,
        manpower_count: currentManpowerCount,
        competencies: formData.competencies.split(',').map(s => s.trim()).filter(Boolean),
        core_competency: formData.core_competency || null,
        address: formData.address || null,
      };

      const updatePayload: any = { ...instantPayload };
      
      if (requiresReapproval) {
        updatePayload.profile_status = 'pending';
        updatePayload.pending_profile_data = draftPayload; // Put sensitive data in draft
      } else {
        Object.assign(updatePayload, draftPayload); // No approval needed, merge into live
      }

      const { data: existing } = await supabase.from('auditor_profiles').select('id').eq('user_id', user.id).maybeSingle();
      
      if (existing) {
        const { error } = await supabase.from('auditor_profiles').update(updatePayload).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('auditor_profiles').insert([{ user_id: user.id, ...updatePayload }]);
        if (error) throw error;
      }

      if (requiresReapproval) {
        setProfileStatus('pending');
        toast.success('Profile saved! Submitted for Admin Approval.');
      } else {
        toast.success('Profile updated instantly!');
      }
      
      navigate('/dashboard'); 
    } catch (error: any) {
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DashboardLayout title="Edit Profile" navItems={auditorNavItems} activeTab="my-profile"><div className="flex items-center justify-center py-20 text-muted-foreground animate-pulse">Loading profile...</div></DashboardLayout>;

  return (
    <DashboardLayout title="Edit Profile" navItems={auditorNavItems} activeTab="my-profile">
      <div className="max-w-5xl mx-auto py-6 space-y-6">

        {profileStatus === 'pending' ? (
           <Alert className="bg-blue-50 border-blue-200 text-blue-800">
             <Clock className="h-4 w-4 text-blue-600" />
             <AlertTitle>Profile Updates Pending Review</AlertTitle>
             <AlertDescription>You have pending profile changes awaiting admin approval. The form below shows your drafted changes.</AlertDescription>
          </Alert>
        ) : (
          <Alert className="bg-amber-50 border-amber-200 text-amber-800">
             <AlertCircle className="h-4 w-4 text-amber-600" />
             <AlertTitle>Approval Requirements</AlertTitle>
             <AlertDescription>Changes to <strong>Qualifications, Resume, Manpower, Competencies, and Address</strong> require Admin Re-approval. Other fields update instantly.</AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-md">
          <CardHeader className="bg-muted/10 border-b pb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#4338CA]/10 rounded-xl"><User className="h-6 w-6 text-[#4338CA]" /></div>
              <div>
                <CardTitle className="text-2xl">Professional Profile</CardTitle>
                <CardDescription>Update your personal, professional, and location details.</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-8 pt-8">
            {/* PERSONAL DETAILS */}
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><User className="h-5 w-5 text-[#4338CA]"/> Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Full Name</Label><Input name="full_name" value={formData.full_name} onChange={handleChange} /></div>
                <div className="space-y-2"><Label>Phone Number</Label><Input name="phone" value={formData.phone} onChange={handleChange} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Full Address <span className="text-xs text-amber-600">(Requires Approval)</span></Label><Textarea name="address" value={formData.address} onChange={handleChange} /></div>
              </div>
            </div>

            {/* PROFESSIONAL DETAILS */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Briefcase className="h-5 w-5 text-[#4338CA]"/> Professional Background</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Core Competency <span className="text-xs text-amber-600">(Requires Approval)</span></Label><Input name="core_competency" value={formData.core_competency} onChange={handleChange} placeholder="e.g. Statutory Audit, Stock Audit" /></div>
                <div className="space-y-2"><Label>Years of Experience</Label><Input type="number" name="experience_years" value={formData.experience_years} onChange={handleChange} /></div>
                <div className="space-y-2"><Label>PAN Number</Label><Input name="pan_card" value={formData.pan_card} onChange={handleChange} className="uppercase" /></div>
                <div className="space-y-2"><Label>GST Number <span className="text-xs text-muted-foreground">(Optional)</span></Label><Input name="gst_number" value={formData.gst_number} onChange={handleChange} className="uppercase" /></div>
                <div className="space-y-2 md:col-span-2"><Label>Qualifications <span className="text-xs text-amber-600">(Comma separated - Requires Approval)</span></Label><Input name="qualifications" value={formData.qualifications} onChange={handleChange} placeholder="e.g. CA, B.Com, MBA" /></div>
                <div className="space-y-2 md:col-span-2"><Label>Other Competencies <span className="text-xs text-amber-600">(Comma separated - Requires Approval)</span></Label><Input name="competencies" value={formData.competencies} onChange={handleChange} placeholder="e.g. Tax Audit, Forensic Audit" /></div>
              </div>
            </div>

            {/* LOCATION & TRAVEL */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><MapPin className="h-5 w-5 text-[#4338CA]"/> Location & Travel</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Base State</Label><Input name="base_state" value={formData.base_state} onChange={handleChange} /></div>
                <div className="space-y-2"><Label>Base City</Label><Input name="base_city" value={formData.base_city} onChange={handleChange} /></div>
                <div className="space-y-2"><Label>Travel Radius (in KM)</Label><Input type="number" name="willing_to_travel_radius" value={formData.willing_to_travel_radius} onChange={handleChange} /></div>
                <div className="space-y-2"><Label>Preferred States <span className="text-xs text-muted-foreground">(Comma separated)</span></Label><Input name="preferred_states" value={formData.preferred_states} onChange={handleChange} placeholder="e.g. Delhi, Haryana" /></div>
                <div className="space-y-2 md:col-span-2"><Label>Preferred Cities <span className="text-xs text-muted-foreground">(Comma separated)</span></Label><Input name="preferred_cities" value={formData.preferred_cities} onChange={handleChange} placeholder="e.g. New Delhi, Gurgaon" /></div>
              </div>
            </div>

            {/* TEAM AVAILABILITY */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Users className="h-5 w-5 text-[#4338CA]"/> Team & Manpower <span className="text-xs font-normal text-amber-600">(Requires Approval)</span></h3>
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox id="has_manpower" name="has_manpower" checked={formData.has_manpower} onCheckedChange={(c) => setFormData(prev => ({...prev, has_manpower: !!c}))} />
                <Label htmlFor="has_manpower">I have a team / additional manpower available for large audits</Label>
              </div>
              {formData.has_manpower && (
                <div className="space-y-2 max-w-sm"><Label>Team Size (Number of people)</Label><Input type="number" name="manpower_count" value={formData.manpower_count} onChange={handleChange} /></div>
              )}
            </div>

            {/* DOCUMENTS */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><FileText className="h-5 w-5 text-[#4338CA]"/> Profile Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Profile Photo */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium"><ImageIcon className="h-4 w-4" /> Profile Photo</Label>
                  <label className="cursor-pointer border-2 border-dashed rounded-xl h-32 flex flex-col items-center justify-center bg-white hover:bg-muted/5 transition-colors">
                    {uploadingField === 'profile_photo_url' ? <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span> : formData.profile_photo_url ? <><CheckCircle2 className="h-8 w-8 text-green-500 mb-2" /><span className="text-sm font-medium text-green-700">Uploaded</span></> : <><Upload className="h-6 w-6 text-muted-foreground mb-2" /><span className="text-sm font-medium">Upload Image</span></>}
                  </label>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'profile_photo_url')} disabled={uploadingField !== null} />
                </div>

                {/* Resume */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4" /> Professional Resume <span className="text-xs text-amber-600">(Requires Approval)</span></Label>
                  <label className="cursor-pointer border-2 border-dashed rounded-xl h-32 flex flex-col items-center justify-center bg-white hover:bg-muted/5 transition-colors">
                    {uploadingField === 'resume_url' ? <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span> : formData.resume_url ? <><CheckCircle2 className="h-8 w-8 text-green-500 mb-2" /><span className="text-sm font-medium text-green-700">Uploaded</span></> : <><Upload className="h-6 w-6 text-muted-foreground mb-2" /><span className="text-sm font-medium">Upload PDF/Doc</span></>}
                  </label>
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => handleFileUpload(e, 'resume_url')} disabled={uploadingField !== null} />
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="bg-muted/5 border-t px-6 py-4 flex justify-end">
            <Button size="lg" className="bg-[#4338CA] hover:bg-[#4338CA]/90 font-semibold px-8" onClick={handleSave} disabled={saving || uploadingField !== null}>
              {saving ? 'Saving Profile...' : profileStatus === 'pending' ? 'Update Draft Changes' : 'Save Profile'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
}