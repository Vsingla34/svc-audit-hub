import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, MapPin, FileText, Briefcase, ArrowLeft, Save, Send, AlertCircle, GraduationCap, Navigation, Plus, X, Pencil, Users, Smartphone, Laptop, Bike } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';

const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

const COMPETENCIES_LIST = [
  "Assets Verification", "Stock Audits", // <-- NEWLY ADDED COMPETENCIES
  "Accounting & Bookkeeping", "Financial Reporting & Finalization", "MIS Reporting & Dashboards",
  "Accounts Payable (AP) Management", "Accounts Receivable (AR) Management", "Bank Reconciliation & Cash Management",
  "Fixed Assets Accounting & FAR Management", "Inventory Accounting & Valuation", "Costing & Management Accounting",
  "Budgeting, Forecasting & FP&A", "Virtual CFO / Finance Leadership", "Working Capital & Cashflow Optimization",
  "Taxation – GST Compliance & Advisory", "Taxation – TDS/TCS Compliance & Advisory", "Direct Tax Compliance & Tax Audit Support",
  "Bank Audits – Stock, Receivables & DP Assessment", "Concurrent Audit (Banking Operations)", "Statutory Audit Support & Audit Readiness",
  "Internal Audit, IFC & Risk Management", "SOP Drafting, Process Mapping & Controls Design", "Compliance Management & Regulatory Reporting",
  "Payroll Processing & Statutory Payroll Compliance (PF/ESI/PT)", "Treasury & Fund Management", "ERP/Accounting Software Implementation & Support",
  "Data Analytics & Automation (Excel/VBA/Power Query/Power BI)", "Fraud Risk Assessment & Investigations Support", "Due Diligence & Transaction Advisory",
  "Business Process Improvement & Lean Finance", "Governance, Documentation & Policy Frameworks", "Client Relationship & Engagement Management"
];

export default function AuditorProfileSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [uploading, setUploading] = useState({ gst: false, resume: false, profilePhoto: false });
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    profile_photo_url: '',
    qualifications: [] as string[],
    gst_number: '',
    resume_url: '',
    experience_years: 0,
    address: '',
    base_city: '',
    base_state: '',
    preferred_states: [] as string[],
    preferred_cities: [] as string[], 
    willing_to_travel_radius: 50,
    has_manpower: false,
    manpower_count: 0,
    competencies: [] as string[],
    core_competency: '',
    has_smartphone: false, // <-- NEW
    has_laptop: false,     // <-- NEW
    has_bike: false        // <-- NEW
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
        profile_photo_url: data.profile_photo_url || '',
        qualifications: data.qualifications || [],
        gst_number: data.gst_number || '',
        resume_url: data.resume_url || '',
        experience_years: data.experience_years || 0,
        address: data.address || '',
        base_city: data.base_city || '',
        base_state: data.base_state || '',
        preferred_states: data.preferred_states || [],
        preferred_cities: data.preferred_cities || [],
        willing_to_travel_radius: data.willing_to_travel_radius || 50,
        has_manpower: data.has_manpower || false,
        manpower_count: data.manpower_count || 0,
        competencies: data.competencies || [],
        core_competency: data.core_competency || '',
        has_smartphone: data.has_smartphone || false,
        has_laptop: data.has_laptop || false,
        has_bike: data.has_bike || false
      });
    }
  };

  const uploadFile = async (file: File, type: string) => {
    if (!user) return null;
    const key = type as keyof typeof uploading;
    setUploading({ ...uploading, [key]: true });
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${type}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file, { upsert: true });

    setUploading({ ...uploading, [key]: false });

    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      return null;
    }
    return fileName;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'gst' | 'resume' | 'profilePhoto') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const path = await uploadFile(file, type);
    if (path) {
      if (type === 'resume') setFormData({ ...formData, resume_url: path });
      else if (type === 'profilePhoto') setFormData({ ...formData, profile_photo_url: path });
      
      toast({ title: 'File uploaded', description: 'Document uploaded successfully' });
    }
  };

  const addQualification = () => {
    if (qualificationInput.trim() && !formData.qualifications.includes(qualificationInput.trim())) {
      setFormData({ ...formData, qualifications: [...formData.qualifications, qualificationInput.trim()] });
      setQualificationInput('');
    }
  };

  const removeQualification = (qual: string) => {
    setFormData({ ...formData, qualifications: formData.qualifications.filter(q => q !== qual) });
  };

  const toggleState = (state: string) => {
    setFormData({
      ...formData,
      preferred_states: formData.preferred_states.includes(state)
        ? formData.preferred_states.filter(s => s !== state)
        : [...formData.preferred_states, state],
    });
  };

  const handleCompetencyToggle = (comp: string) => {
    if (formData.competencies.includes(comp)) {
      setFormData(prev => ({ 
        ...prev, 
        competencies: prev.competencies.filter(c => c !== comp),
        core_competency: prev.core_competency === comp ? '' : prev.core_competency
      }));
    } else {
      if (formData.competencies.length >= 5) {
        toast({ title: 'Limit Reached', description: 'Maximum 5 competencies allowed.', variant: 'destructive' });
        return;
      }
      setFormData(prev => ({ ...prev, competencies: [...prev.competencies, comp] }));
    }
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    setSavingDraft(true);
    
    const { error } = await supabase.from('auditor_profiles').upsert({
      user_id: user.id,
      ...formData,
      kyc_status: kycStatus === 'approved' || kycStatus === 'pending' ? 'pending' : 'draft', 
    }, { onConflict: 'user_id' });
    
    setSavingDraft(false);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Draft saved', description: 'Your profile has been saved' });
      if (kycStatus === 'approved') { setKycStatus('pending'); setIsEditing(false); }
    }
  };

  const handleSubmitForApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // --- Validation ---
    if (!formData.resume_url) {
      toast({ title: 'Resume Required', description: 'You must upload a resume before submitting.', variant: 'destructive' });
      return;
    }
    if (!formData.base_city || !formData.base_state || !formData.address) {
      toast({ title: 'Incomplete profile', description: 'Fill all required location fields (Address, City, State)', variant: 'destructive' });
      return;
    }
    if (formData.competencies.length === 0 || !formData.core_competency) {
      toast({ title: 'Incomplete competencies', description: 'Select at least 1 competency and a core competency.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    
    const { error } = await supabase.from('auditor_profiles').upsert({
      user_id: user.id,
      ...formData,
      kyc_status: 'pending',
    }, { onConflict: 'user_id' });
    
    setLoading(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile submitted', description: 'Submitted for approval' });
      setKycStatus('pending');
      setIsEditing(false);
    }
  };

  const getStatusBadge = () => {
    switch (kycStatus) {
      case 'approved': return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Approved</Badge>;
      case 'pending': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pending Approval</Badge>;
      case 'rejected': return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Rejected</Badge>;
      default: return <Badge variant="outline">Draft</Badge>;
    }
  };

  const isEditable = (kycStatus !== 'approved' && kycStatus !== 'pending') || (kycStatus === 'approved' && isEditing);

  return (
    <DashboardLayout title="My Profile" navItems={auditorNavItems} activeTab="my-profile">
      <div className="max-w-4xl mx-auto py-8">
        <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/50 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">My Auditor Profile</CardTitle>
                  <CardDescription>Manage your professional details</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge()}
                {kycStatus === 'approved' && !isEditing && (
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="gap-2">
                        <Pencil className="h-3 w-3" /> Edit Profile
                    </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 sm:p-8">
            {kycStatus === 'rejected' && rejectionReason && (
              <Alert variant="destructive" className="mb-8"><AlertTitle>KYC Rejected</AlertTitle><AlertDescription>{rejectionReason}</AlertDescription></Alert>
            )}

            <form onSubmit={handleSubmitForApproval} className="space-y-8">
              
              {/* Profile Photo */}
              <div className="space-y-4">
                 <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2"><Users className="h-5 w-5 text-primary" /> Profile Photo (Optional)</h3>
                 <div className="flex items-center gap-4">
                    <Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'profilePhoto')} disabled={!isEditable} className="max-w-xs" />
                    {formData.profile_photo_url && <span className="text-sm text-green-600">✓ Uploaded</span>}
                 </div>
              </div>

              {/* Qualifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50"><GraduationCap className="h-5 w-5 text-primary" /><h3 className="font-semibold text-lg">Qualifications</h3></div>
                <div className="flex gap-2">
                  <Input value={qualificationInput} onChange={(e) => setQualificationInput(e.target.value)} placeholder="Add qualification (e.g. CA)" disabled={!isEditable} />
                  <Button type="button" onClick={addQualification} disabled={!isEditable} size="icon"><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.qualifications.map(q => (
                    <Badge key={q} variant="secondary" className="cursor-pointer" onClick={() => isEditable && removeQualification(q)}>{q} {isEditable && <X className="h-3 w-3 ml-1" />}</Badge>
                  ))}
                </div>
              </div>

              {/* Experience & Docs */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50"><Briefcase className="h-5 w-5 text-primary" /><h3 className="font-semibold text-lg">Professional Info</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Experience (Years) *</Label>
                    <Input type="text" inputMode="numeric" value={formData.experience_years} onChange={e => setFormData({...formData, experience_years: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0})} disabled={!isEditable} required />
                  </div>
                  <div>
                    <Label>GST Number</Label>
                    <Input value={formData.gst_number} onChange={e => setFormData({...formData, gst_number: e.target.value.toUpperCase()})} disabled={!isEditable} />
                  </div>
                  <div>
                    <Label className="font-bold">Resume (PDF) *</Label>
                    <Input type="file" accept=".pdf" onChange={e => handleFileUpload(e, 'resume')} disabled={!isEditable} />
                    {formData.resume_url ? 
                        <span className="text-xs text-green-600">✓ Resume Uploaded</span> 
                        : <span className="text-xs text-destructive">Required for approval</span>
                    }
                  </div>
                </div>
              </div>

              {/* Manpower, Assets & Competencies */}
              <div className="space-y-4">
                 <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2"><Users className="h-5 w-5 text-primary" /> Capabilities & Assets</h3>
                 
                 {/* Asset Checkboxes */}
                 <div className="p-4 border rounded bg-muted/10">
                    <Label className="text-base mb-3 block">Assets Availability</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                       <div className="flex items-center space-x-2">
                         <Checkbox id="smartphone" checked={formData.has_smartphone} onCheckedChange={(c) => isEditable && setFormData({...formData, has_smartphone: !!c})} disabled={!isEditable} />
                         <label htmlFor="smartphone" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"><Smartphone className="h-4 w-4 text-muted-foreground"/> Smartphone</label>
                       </div>
                       <div className="flex items-center space-x-2">
                         <Checkbox id="laptop" checked={formData.has_laptop} onCheckedChange={(c) => isEditable && setFormData({...formData, has_laptop: !!c})} disabled={!isEditable} />
                         <label htmlFor="laptop" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"><Laptop className="h-4 w-4 text-muted-foreground"/> Laptop</label>
                       </div>
                       <div className="flex items-center space-x-2">
                         <Checkbox id="bike" checked={formData.has_bike} onCheckedChange={(c) => isEditable && setFormData({...formData, has_bike: !!c})} disabled={!isEditable} />
                         <label htmlFor="bike" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"><Bike className="h-4 w-4 text-muted-foreground"/> Two-Wheeler (Bike)</label>
                       </div>
                    </div>
                 </div>

                 <div className="flex items-center gap-4 p-4 border rounded bg-muted/20 mt-2">
                    <Label>Manpower Availability?</Label>
                    <Switch checked={formData.has_manpower} onCheckedChange={c => isEditable && setFormData({...formData, has_manpower: c})} disabled={!isEditable} />
                    {formData.has_manpower && (
                      <Input type="number" min="1" className="w-24 ml-4" placeholder="Count" value={formData.manpower_count} onChange={e => setFormData({...formData, manpower_count: parseInt(e.target.value) || 0})} disabled={!isEditable} />
                    )}
                 </div>

                 <div>
                    <Label className="mb-2 block">Competencies (Max 5) *</Label>
                    <div className="h-48 overflow-y-auto border rounded p-4 grid grid-cols-1 md:grid-cols-2 gap-2 bg-muted/5">
                      {COMPETENCIES_LIST.map(comp => (
                        <div key={comp} className="flex items-start gap-2">
                          <Checkbox className="mt-1" id={comp} checked={formData.competencies.includes(comp)} onCheckedChange={() => isEditable && handleCompetencyToggle(comp)} disabled={!isEditable} />
                          <label htmlFor={comp} className="text-sm cursor-pointer leading-tight">{comp}</label>
                        </div>
                      ))}
                    </div>
                 </div>

                 {formData.competencies.length > 0 && (
                   <div>
                     <Label>Core Competency *</Label>
                     <Select value={formData.core_competency || ''} onValueChange={v => setFormData({...formData, core_competency: v})} disabled={!isEditable}>
                       <SelectTrigger><SelectValue placeholder="Select primary skill" /></SelectTrigger>
                       <SelectContent>{formData.competencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                     </Select>
                   </div>
                 )}
              </div>

              {/* Location */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50"><MapPin className="h-5 w-5 text-primary" /><h3 className="font-semibold text-lg">Location</h3></div>
                
                <div className="space-y-2">
                  <Label>Full Address *</Label>
                  <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Full street address" disabled={!isEditable} required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                     <Label>Base State *</Label>
                     <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.base_state} onChange={e => setFormData({...formData, base_state: e.target.value})} disabled={!isEditable} required>
                       <option value="">Select State</option>
                       {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                  </div>
                  <div>
                    <Label>Base City *</Label>
                    <Input value={formData.base_city} onChange={e => setFormData({...formData, base_city: e.target.value})} disabled={!isEditable} required />
                  </div>
                </div>
                
                <div>
                  <Label>Willing to Travel (km radius) *</Label>
                  <Input type="text" inputMode="numeric" className="max-w-xs" value={formData.willing_to_travel_radius} onChange={e => setFormData({...formData, willing_to_travel_radius: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0})} disabled={!isEditable} required />
                </div>

                <div className="space-y-2">
                  <Label>Preferred States</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 h-40 overflow-y-auto border rounded p-2">
                    {INDIAN_STATES.map(state => (
                      <div key={state} className="flex items-center gap-2">
                        <Checkbox checked={formData.preferred_states.includes(state)} onCheckedChange={() => isEditable && toggleState(state)} disabled={!isEditable} />
                        <span className="text-xs">{state}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {isEditable && (
                <div className="flex gap-4 pt-4">
                  {isEditing && <Button type="button" variant="ghost" className="flex-1" onClick={() => {setIsEditing(false); loadProfile();}}>Cancel</Button>}
                  <Button type="button" variant="outline" className="flex-1" onClick={handleSaveDraft} disabled={savingDraft || loading}>Save Draft</Button>
                  <Button type="submit" className="flex-1 bg-primary" disabled={loading}>Submit for KYC</Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}