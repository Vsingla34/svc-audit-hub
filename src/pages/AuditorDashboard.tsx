import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Briefcase, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  IndianRupee, 
  MapPin, 
  Eye, 
  Building2, 
  GraduationCap, 
  ArrowRight, 
  Shield, 
  Calendar, 
  Lock, 
  PlayCircle, 
  Upload, 
  Trash2, 
  RefreshCcw, 
  FileText, 
  X, 
  FileSpreadsheet 
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AuditorAnalytics } from '@/components/AuditorAnalytics';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { useProfileValidation } from '@/hooks/useProfileValidation';
import { Separator } from '@/components/ui/separator';

export default function AuditorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  
  const [openAssignments, setOpenAssignments] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  
  // -- LIVE REPORT STATE --
  const [activeReportAssignment, setActiveReportAssignment] = useState<any>(null);
  const [trackingData, setTrackingData] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Application Dialog State
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedJobForApplication, setSelectedJobForApplication] = useState<string | null>(null);
  const [interestReason, setInterestReason] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);

  // Filters
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterAuditType, setFilterAuditType] = useState<string>('all');

  useEffect(() => { 
    if (user) {
      checkKycStatus(); 
      fetchData(); 
    }
  }, [user, refreshKey]);

  const handleTabChange = (tab: string) => { setSearchParams({ tab }); };

  const checkKycStatus = async () => {
    if (!user) return;
    const { data } = await supabase.from('auditor_profiles').select('kyc_status').eq('user_id', user.id).maybeSingle();
    setKycStatus(data?.kyc_status || null);
  };

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: profile } = await supabase.from('auditor_profiles').select('base_state, preferred_states').eq('user_id', user.id).maybeSingle();

      let query = supabase.from('assignments').select('*').eq('status', 'open').order('audit_date', { ascending: true });
      if (profile) {
        const allowedStates = [profile.base_state, ...(profile.preferred_states || [])].filter(Boolean);
        if (allowedStates.length > 0) query = query.in('state', allowedStates);
      }
      const { data: openData } = await query;
      setOpenAssignments(openData || []);

      const { data: applicationsData } = await supabase.from('applications').select(`*, assignment:assignments(*)`).eq('auditor_id', user.id).order('applied_at', { ascending: false });
      setMyApplications(applicationsData || []);

      const { data: myData } = await supabase.from('assignments').select('*').eq('allotted_to', user.id).order('audit_date', { ascending: true });
      setMyAssignments(myData || []);

      const todayAssignment = myData?.find(a => isToday(new Date(a.audit_date)) && a.status === 'allotted');
      if (todayAssignment) {
         setActiveReportAssignment(todayAssignment);
         setTrackingData(todayAssignment.tracking_details || {});
      } else {
         setActiveReportAssignment(null);
      }

    } catch (error: any) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateTrackingData = async (newData: any) => {
     if (!activeReportAssignment) return;
     const updated = { ...trackingData, ...newData };
     const { error } = await supabase.from('assignments').update({ tracking_details: updated }).eq('id', activeReportAssignment.id);
     if (error) { toast.error("Failed to update report"); } else { setTrackingData(updated); setRefreshKey(prev => prev + 1); }
  };

  const handleCheckInUpload = async (file: File) => {
     setUploading(true);
     try {
        const path = `${user?.id}/check-in/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('kyc-documents').upload(path, file);
        if (error) throw error;
        await updateTrackingData({ check_in: { url: path, status: 'pending', timestamp: new Date().toISOString() } });
        toast.success("Check-in photo uploaded!");
     } catch (e:any) { toast.error(e.message); } finally { setUploading(false); }
  };

  const handleStartAssignment = async (started: boolean) => {
     if (started) { await updateTrackingData({ is_started: true }); toast.success("Assignment started!"); }
  };

  const handleReportUpload = async (file: File, slot: number) => {
     setUploading(true);
     try {
        const path = `${user?.id}/reports/${Date.now()}-slot${slot}-${file.name}`;
        const { error } = await supabase.storage.from('kyc-documents').upload(path, file);
        if (error) {
           if (error.message.includes('mime') || error.message.includes('Type')) { toast.error("File type not allowed."); } else { throw error; }
           return;
        }
        const newReport = { id: crypto.randomUUID(), name: file.name, url: path, status: 'pending', slot: slot, type: file.type, timestamp: new Date().toISOString() };
        const currentReports = trackingData.reports || [];
        const otherReports = currentReports.filter((r: any) => r.slot !== slot);
        await updateTrackingData({ reports: [...otherReports, newReport] });
        toast.success(`Report ${slot} uploaded!`);
     } catch (e:any) { toast.error(e.message || "Upload failed"); } finally { setUploading(false); }
  };

  const deleteReportFile = async (reportId: string) => {
      if(!confirm("Delete this file?")) return;
      const currentReports = trackingData.reports || [];
      const updatedReports = currentReports.filter((r: any) => r.id !== reportId);
      await updateTrackingData({ reports: updatedReports });
      toast.success("File removed");
  };

  const handleCheckOut = async () => {
     if (!confirm("Are you sure you want to finish this assignment?")) return;
     const { error } = await supabase.from('assignments').update({ status: 'completed', completed_at: new Date().toISOString(), tracking_details: { ...trackingData, check_out: { completed: true, timestamp: new Date().toISOString() } } }).eq('id', activeReportAssignment.id);
     if (error) toast.error("Check out failed"); else { toast.success("Assignment Completed!"); fetchData(); }
  };

  const submitApplication = async () => {
    if (!selectedJobForApplication || !user || !interestReason.trim()) return;
    setSubmittingApp(true);
    try {
      const { data: job } = await supabase.from('assignments').select('applicant_count').eq('id', selectedJobForApplication).single();
      if (job && job.applicant_count >= 5) { toast.error("Maximum application limit (5) reached just now."); setApplyDialogOpen(false); fetchData(); return; }
      const { error } = await supabase.from('applications').insert({ assignment_id: selectedJobForApplication, auditor_id: user.id, interest_reason: interestReason });
      if (error) throw error;
      await supabase.from('assignment_activities').insert({ assignment_id: selectedJobForApplication, user_id: user.id, activity_type: 'application_received', description: 'New application received' });
      toast.success('Application submitted successfully!');
      setApplyDialogOpen(false); fetchData();
    } catch (error: any) { toast.error(error.message); } finally { setSubmittingApp(false); }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    if (!confirm('Are you sure you want to withdraw this application?')) return;
    try { const { error } = await supabase.from('applications').delete().eq('id', applicationId); if (error) throw error; toast.success('Application withdrawn.'); fetchData(); } catch (error: any) { toast.error(error.message); }
  };

  const filteredOpenAssignments = openAssignments.filter(a => {
    if (filterState !== 'all' && a.state !== filterState) return false;
    if (filterCity !== 'all' && a.city !== filterCity) return false;
    if (filterAuditType !== 'all' && a.audit_type !== filterAuditType) return false;
    return true;
  });
  
  const uniqueStates = [...new Set(openAssignments.map(a => a.state))].filter(Boolean);
  const uniqueCities = [...new Set(openAssignments.map(a => a.city))].filter(Boolean);
  const uniqueAuditTypes = [...new Set(openAssignments.map(a => a.audit_type))].filter(Boolean);

  const canStart = trackingData?.check_in?.url; 
  const isStarted = trackingData?.is_started;
  const reports = trackingData?.reports || [];
  const hasReports = reports.length > 0;
  const allReportsApproved = hasReports && reports.every((r: any) => r.status === 'approved');
  const canCheckOut = isStarted && allReportsApproved && trackingData?.check_in?.status === 'approved';

  const getReportBySlot = (slot: number) => reports.find((r: any) => r.slot === slot);
  const slotLabels = ["One", "Two", "Three", "Four"];

  const getFileIcon = (fileName: string) => {
     if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // CHANGED: Icon color to Indigo
        return <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#4338CA]" />;
     }
     // CHANGED: Icon color to Indigo
     return <FileText className="h-4 w-4 shrink-0 text-[#4338CA]" />;
  };

  return (
    <DashboardLayout title="Auditor Dashboard" navItems={auditorNavItems} activeTab={activeTab} onTabChange={handleTabChange}>
      
      {(!kycStatus || kycStatus === 'pending') && (
        <Alert variant={!kycStatus ? 'destructive' : 'default'} className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{!kycStatus ? 'Complete Your Profile' : 'KYC Under Review'}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{!kycStatus ? 'Complete your profile to apply for assignments' : 'Your profile is under admin review'}</span>
            {!kycStatus && <Button size="sm" onClick={() => navigate('/profile-setup')}>Complete Profile</Button>}
          </AlertDescription>
        </Alert>
      )}

      {kycStatus === 'rejected' && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>KYC Rejected</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Please update your profile and resubmit</span>
            <Button size="sm" variant="outline" onClick={() => navigate('/profile-setup')}>Update Profile</Button>
          </AlertDescription>
        </Alert>
      )}

      {activeTab === 'overview' && (
         <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription>Available Jobs</CardDescription>
                    <CardTitle className="text-3xl flex items-center gap-2"><Briefcase className="h-6 w-6 text-[#4338CA]" />{openAssignments.length}</CardTitle>
                </CardHeader>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription>Pending Applications</CardDescription>
                    {/* CHANGED: Icon color to Indigo */}
                    <CardTitle className="text-3xl flex items-center gap-2"><Clock className="h-6 w-6 text-[#4338CA]" />{myApplications.filter(app => app.status === 'pending').length}</CardTitle>
                </CardHeader>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription>Active Assignments</CardDescription>
                    {/* CHANGED: Icon color to Indigo */}
                    <CardTitle className="text-3xl flex items-center gap-2"><CheckCircle className="h-6 w-6 text-[#4338CA]" />{myAssignments.length}</CardTitle>
                </CardHeader>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'available-jobs' && (
        <div className="space-y-4">
          <Card className="bg-muted/30 border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>State</Label><Select value={filterState} onValueChange={setFilterState}><SelectTrigger><SelectValue placeholder="All States" /></SelectTrigger><SelectContent><SelectItem value="all">All States</SelectItem>{uniqueStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>City</Label><Select value={filterCity} onValueChange={setFilterCity}><SelectTrigger><SelectValue placeholder="All Cities" /></SelectTrigger><SelectContent><SelectItem value="all">All Cities</SelectItem>{uniqueCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Audit Type</Label><Select value={filterAuditType} onValueChange={setFilterAuditType}><SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem>{uniqueAuditTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </CardContent>
          </Card>

          {filteredOpenAssignments.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2"><Briefcase className="h-10 w-10 opacity-20"/>No assignments found matching your criteria.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredOpenAssignments.map(a => (
                <Card key={a.id} className="group hover:shadow-xl transition-all duration-300 border-none shadow-md bg-card overflow-hidden flex flex-col h-full relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4338CA] to-[#4338CA]/60" />
                    <CardHeader className="pb-3 pt-5">
                        <div className="flex justify-between items-start gap-2">
                            <Badge variant="outline" className="mb-2 w-fit border-[#4338CA]/20 text-[#4338CA] bg-[#4338CA]/5 uppercase text-[10px] tracking-wider font-semibold">{a.audit_type}</Badge>
                            {/* CHANGED: Fees badge to Indigo */}
                            <Badge variant="secondary" className="bg-[#4338CA]/10 text-[#4338CA] font-bold border border-[#4338CA]/20"><IndianRupee className="h-3 w-3 mr-1" />{a.fees?.toLocaleString()}/day</Badge>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-mono text-muted-foreground">#{a.assignment_number || a.id.substring(0, 6).toUpperCase()}</span></div>
                            <CardTitle className="text-lg font-bold leading-tight group-hover:text-[#4338CA] transition-colors flex items-center gap-2">{a.industry || 'Confidential Client'}{(!a.industry) && <Shield className="h-3.5 w-3.5 text-muted-foreground/60"/>}</CardTitle>
                            <div className="flex items-center text-sm text-muted-foreground pt-1"><MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />{a.city}, {a.state}</div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 pb-4">
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"><div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><GraduationCap className="h-3.5 w-3.5" /><span>Qualification</span></div><div className="text-sm font-medium truncate" title={a.qualification_required}>{a.qualification_required || 'Any'}</div></div>
                            <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"><div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Clock className="h-3.5 w-3.5" /><span>Duration</span></div><div className="text-sm font-medium">{a.duration || 'Flexible'}</div></div>
                            <div className="col-span-2 bg-muted/30 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors flex items-center justify-between"><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" /><span>Start Date</span></div><div className="text-sm font-medium">{format(new Date(a.audit_date), 'dd MMM yyyy')}</div></div>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-0 pb-5 px-6"><Button className="w-full shadow-sm hover:shadow group-hover:bg-[#4338CA] group-hover:text-white transition-all" onClick={() => navigate(`/assignment/${a.id}`)}>View Details <ArrowRight className="h-4 w-4 ml-2 opacity-70 group-hover:translate-x-1 transition-transform" /></Button></CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'live-report' && (
         <div className="space-y-6">
            {!activeReportAssignment ? (
               <Card className="border-dashed">
                  <CardContent className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-4">
                     <Calendar className="h-12 w-12 opacity-20" />
                     <div className="text-center">
                        <h3 className="text-lg font-semibold">No Active Audit Today</h3>
                        <p>Assignments only appear here on the scheduled audit date.</p>
                     </div>
                     <Button variant="outline" onClick={() => handleTabChange('my-assignments')}>View All Assignments</Button>
                  </CardContent>
               </Card>
            ) : (
               <div className="grid gap-6">
                  {/* CHANGED: Border color to Indigo */}
                  <Card className="border-l-4 border-l-[#4338CA]">
                     <CardHeader>
                        <div className="flex justify-between items-start">
                           <div>
                              <Badge variant="outline" className="mb-2">LIVE AUDIT</Badge>
                              <CardTitle>{activeReportAssignment.client_name}</CardTitle>
                              <CardDescription>{activeReportAssignment.city}, {activeReportAssignment.state}</CardDescription>
                           </div>
                           <Button variant="ghost" size="sm" onClick={() => setRefreshKey(prev => prev+1)}><RefreshCcw className="h-4 w-4"/></Button>
                        </div>
                     </CardHeader>
                     <CardContent className="space-y-8">
                        
                        {/* 1. CHECK IN */}
                        <div className="space-y-3">
                           <div className="flex items-center gap-2 font-semibold text-lg">
                              {/* CHANGED: Complete state color to Indigo */}
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm ${trackingData.check_in ? 'bg-[#4338CA]/20 text-[#4338CA]' : 'bg-[#4338CA]/10 text-[#4338CA]'}`}>1</div>
                              Check In
                              {trackingData.check_in?.status === 'approved' && <Badge className="bg-green-600">Approved</Badge>}
                              {trackingData.check_in?.status === 'rejected' && <Badge variant="destructive">Rejected</Badge>}
                           </div>
                           
                           {trackingData.check_in?.url ? (
                              <div className="ml-10 space-y-2">
                                 <img src={`https://tcmtmznnjdqjmxetqvdq.supabase.co/storage/v1/object/public/kyc-documents/${trackingData.check_in.url}`} alt="Check In" className="h-40 w-auto rounded-md border" />
                                 {trackingData.check_in.status === 'rejected' && (
                                    <div className="space-y-2">
                                       <Alert variant="destructive">
                                          <AlertCircle className="h-4 w-4"/>
                                          <AlertTitle>Upload Rejected</AlertTitle>
                                          <AlertDescription>{trackingData.check_in.feedback || "Please re-upload a clear image."}</AlertDescription>
                                       </Alert>
                                       <div className="flex gap-2">
                                          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleCheckInUpload(e.target.files[0])} className="text-sm" disabled={uploading} />
                                          {uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
                                       </div>
                                    </div>
                                 )}
                              </div>
                           ) : (
                              <div className="ml-10">
                                 <Label>Upload Selfie/Location Image</Label>
                                 <div className="flex gap-2 mt-2">
                                    <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleCheckInUpload(e.target.files[0])} disabled={uploading} className="border rounded p-1 text-sm"/>
                                 </div>
                              </div>
                           )}
                        </div>

                        <Separator />

                        {/* 2. START ASSIGNMENT */}
                        <div className={`space-y-3 ${!canStart ? 'opacity-50 pointer-events-none' : ''}`}>
                           <div className="flex items-center gap-2 font-semibold text-lg">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm ${isStarted ? 'bg-[#4338CA]/20 text-[#4338CA]' : 'bg-[#4338CA]/10 text-[#4338CA]'}`}>2</div>
                              Is Assignment Started?
                           </div>
                           <div className="ml-10">
                              <RadioGroup value={isStarted ? 'yes' : 'no'} onValueChange={(v) => v === 'yes' && handleStartAssignment(true)} disabled={isStarted}>
                                 <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="yes" id="r-yes" />
                                    <Label htmlFor="r-yes">Yes, I have started the audit</Label>
                                 </div>
                                 <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="no" id="r-no" />
                                    <Label htmlFor="r-no">No</Label>
                                 </div>
                              </RadioGroup>
                           </div>
                        </div>

                        <Separator />

                        {/* 3. REPORTS UPLOAD (4 SLOTS) */}
                        <div className={`space-y-3 ${!isStarted ? 'opacity-50 pointer-events-none' : ''}`}>
                           <div className="flex items-center gap-2 font-semibold text-lg">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm ${allReportsApproved ? 'bg-[#4338CA]/20 text-[#4338CA]' : 'bg-[#4338CA]/10 text-[#4338CA]'}`}>3</div>
                              Reports Upload
                           </div>
                           
                           <div className="ml-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                             {[1, 2, 3, 4].map((slot) => {
                               const report = getReportBySlot(slot);
                               
                               return (
                                 <div key={slot} className="border rounded-lg p-4 bg-muted/5 flex flex-col gap-3">
                                   <div className="flex justify-between items-center">
                                      <span className="font-semibold text-sm">Report {slotLabels[slot-1]}</span>
                                      {report && (
                                         <Badge variant={report.status === 'approved' ? 'default' : report.status === 'rejected' ? 'destructive' : 'secondary'} className={report.status === 'approved' ? 'bg-green-600' : ''}>
                                            {report.status}
                                         </Badge>
                                      )}
                                   </div>

                                   {report ? (
                                      <div className="space-y-2">
                                         <div className="flex items-center gap-2 text-sm text-[#4338CA] bg-[#4338CA]/10 p-2 rounded truncate" title={report.name}>
                                            {getFileIcon(report.name)}
                                            <span className="truncate">{report.name}</span>
                                         </div>
                                         
                                         {report.feedback && (
                                            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                               Reason: {report.feedback}
                                            </div>
                                         )}

                                         {(report.status === 'pending' || report.status === 'rejected') && (
                                            <Button variant="destructive" size="sm" className="w-full h-8" onClick={() => deleteReportFile(report.id)}>
                                               {report.status === 'rejected' ? 'Remove & Re-upload' : 'Remove'}
                                            </Button>
                                         )}
                                      </div>
                                   ) : (
                                      <div className="mt-auto">
                                         <Label htmlFor={`upload-${slot}`} className="cursor-pointer">
                                            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg h-20 flex flex-col items-center justify-center hover:bg-muted/10 transition-colors">
                                               <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                                               <span className="text-xs text-muted-foreground">Click to Upload</span>
                                               <span className="text-[10px] text-muted-foreground/50">PDF, Excel, CSV</span>
                                            </div>
                                         </Label>
                                         <input 
                                            id={`upload-${slot}`} 
                                            type="file" 
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                                            className="hidden" 
                                            onChange={(e) => e.target.files?.[0] && handleReportUpload(e.target.files[0], slot)}
                                            disabled={uploading}
                                         />
                                      </div>
                                   )}
                                 </div>
                               );
                             })}
                           </div>
                        </div>

                        <Separator />

                        {/* 4. CHECK OUT */}
                        <div className={`space-y-3 ${!canCheckOut ? 'opacity-50' : ''}`}>
                           <div className="flex items-center gap-2 font-semibold text-lg">
                              <div className="h-8 w-8 rounded-full bg-[#4338CA]/10 text-[#4338CA] flex items-center justify-center text-sm">4</div>
                              Check Out
                           </div>
                           <div className="ml-10">
                              {!canCheckOut ? (
                                 <p className="text-sm text-muted-foreground mb-2">
                                    Locked. Requires: Started + Check-in Approved + All Uploaded Reports Approved.
                                 </p>
                              ) : (
                                 // CHANGED: Text to Indigo
                                 <p className="text-sm text-[#4338CA] mb-2 font-medium">All steps approved. You can now complete the assignment.</p>
                              )}
                              <Button className="w-full sm:w-auto bg-[#4338CA] hover:bg-[#4338CA]/90" disabled={!canCheckOut} onClick={handleCheckOut}>
                                 Complete & Check Out
                              </Button>
                           </div>
                        </div>

                     </CardContent>
                  </Card>
               </div>
            )}
         </div>
      )}

      {/* MY APPLICATIONS */}
      {activeTab === 'my-applications' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold tracking-tight">Your Applications</h2><Badge variant="outline">{myApplications.length} Total</Badge></div>
          {myApplications.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">You haven't applied to any assignments yet.</CardContent></Card> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {myApplications.map(app => (
                <Card key={app.id} className="hover:shadow-md transition-shadow border-none shadow-sm ring-1 ring-border group flex flex-col bg-card">
                  <CardHeader className="pb-3 bg-muted/10">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="outline" className="mb-2 text-[10px] uppercase">{app.assignment?.audit_type}</Badge>
                        <div className="flex items-center gap-2"><CardTitle className="text-lg font-bold text-[#4338CA]">{app.status === 'accepted' ? app.assignment?.client_name : (app.assignment?.industry || 'Confidential Client')}</CardTitle></div>
                        <div className="text-sm font-medium text-muted-foreground mt-1">{app.status === 'accepted' ? app.assignment?.branch_name : 'Branch Hidden'}</div>
                      </div>
                      <StatusBadge status={app.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="py-4 flex-1">
                     <div className="grid grid-cols-2 gap-y-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground col-span-2"><MapPin className="h-4 w-4 text-[#4338CA]/70" /> {app.assignment?.city}, {app.assignment?.state}</div>
                        <div className="flex items-center gap-2 text-muted-foreground col-span-2"><Calendar className="h-4 w-4 text-[#4338CA]/70" /> Start: {app.assignment?.audit_date ? format(new Date(app.assignment.audit_date), 'dd MMM yyyy') : 'TBD'}</div>
                        {app.status !== 'accepted' && (<div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit text-xs col-span-2"><Shield className="h-3 w-3" /> Client details hidden</div>)}
                     </div>
                  </CardContent>
                  <CardFooter className="pt-3 border-t bg-muted/5 flex justify-between items-center mt-auto">
                     <div className="text-xs text-muted-foreground flex flex-col"><span>Applied on</span><span className="font-medium">{format(new Date(app.applied_at), 'dd MMM yyyy')}</span></div>
                     <div className="flex gap-2">
                        {app.status === 'pending' && (<Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2" onClick={(e) => { e.stopPropagation(); handleDeleteApplication(app.id); }}>Withdraw</Button>)}
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => navigate(`/assignment/${app.assignment_id}`)}>View <ArrowRight className="h-3 w-3 ml-1" /></Button>
                     </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MY ASSIGNMENTS */}
      {activeTab === 'my-assignments' && (
        <div className="space-y-4">
          {myAssignments.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No assignments yet</CardContent></Card> : (
            <div className="grid gap-4">
              {myAssignments.map(a => {
                const auditDate = new Date(a.audit_date);
                const isActive = isToday(auditDate) || isPast(auditDate);
                return (
                  // CHANGED: Border color to Indigo if Active
                  <Card key={a.id} className={`hover:shadow-md transition-shadow cursor-pointer border-l-4 ${isActive ? 'border-l-[#4338CA]' : 'border-l-muted-foreground/50'}`} onClick={() => navigate(`/assignment/${a.id}`)}>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                   <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{a.audit_type}</Badge>
                                   {!isActive && <Badge variant="secondary" className="text-[10px] flex gap-1"><Lock className="h-3 w-3"/> Scheduled</Badge>}
                                   {/* CHANGED: Badge color to Indigo */}
                                   {isActive && <Badge className="text-[10px] bg-[#4338CA] flex gap-1"><PlayCircle className="h-3 w-3"/> Active</Badge>}
                                </div>
                                <CardTitle className={`text-lg ${!isActive && 'text-muted-foreground'}`}>{a.client_name}</CardTitle>
                                <CardDescription>{a.city}, {a.state}</CardDescription>
                            </div>
                            <div className="flex gap-2"><StatusBadge status={a.status} /></div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-4 text-sm bg-muted/20 p-3 rounded-md">
                          <div><span className="text-muted-foreground text-xs uppercase font-bold">Audit Date</span><div className="font-medium">{format(auditDate, 'dd MMM yyyy')}</div></div>
                          <div><span className="text-muted-foreground text-xs uppercase font-bold">Deadline</span><div className="font-medium">{format(new Date(a.deadline_date), 'dd MMM yyyy')}</div></div>
                      </div>
                      <div className="flex gap-2 pt-2 justify-end">
                        {a.status === 'allotted' && (
                           isActive ? (
                              <Button variant="outline" size="sm" className="border-[#4338CA] text-[#4338CA] hover:bg-[#4338CA]/10" onClick={(e) => { e.stopPropagation(); navigate('/dashboard?tab=live-report'); }}>Go to Live Report</Button>
                           ) : (
                              <Button variant="ghost" size="sm" disabled className="opacity-50 cursor-not-allowed"><Lock className="h-3 w-3 mr-1" /> Starts {format(auditDate, 'dd MMM')}</Button>
                           )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && <AuditorAnalytics userId={user?.id || ''} />}

      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Apply for Assignment</DialogTitle><DialogDescription>Why are you the right fit for this audit?</DialogDescription></DialogHeader>
          <Textarea value={interestReason} onChange={(e) => setInterestReason(e.target.value)} placeholder="e.g. I have 3 years of experience in similar stock audits..." className="min-h-[120px]" />
          <DialogFooter><Button variant="outline" onClick={() => setApplyDialogOpen(false)}>Cancel</Button><Button className="bg-[#4338CA] hover:bg-[#4338CA]/90" onClick={submitApplication} disabled={submittingApp || !interestReason.trim()}>{submittingApp ? 'Submitting...' : 'Submit Application'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}