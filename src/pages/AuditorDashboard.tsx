import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
// FIXED: Added 'Calendar' to the imports
import { Briefcase, Clock, CheckCircle, AlertCircle, IndianRupee, MapPin, Eye, Building2, GraduationCap, ArrowRight, Shield, Calendar } from 'lucide-react';
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
  
  // Application Dialog State
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedJobForApplication, setSelectedJobForApplication] = useState<string | null>(null);
  const [interestReason, setInterestReason] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);

  // Report Submission State
  const [uploadingReport, setUploadingReport] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedAssignmentForReport, setSelectedAssignmentForReport] = useState<any>(null);
  const [completionStatus, setCompletionStatus] = useState<string>('completed');
  const [incompleteReason, setIncompleteReason] = useState<string>('');
  const [selectedReportFile, setSelectedReportFile] = useState<File | null>(null);
  
  const { isComplete: profileComplete, missingFields } = useProfileValidation();
  
  // Local Filters
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterAuditType, setFilterAuditType] = useState<string>('all');

  useEffect(() => { 
    if (user) {
      checkKycStatus(); 
      fetchData(); 
    }
  }, [user]);

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

      // 1. Fetch Profile Preferences to filter jobs server-side
      const { data: profile } = await supabase
        .from('auditor_profiles')
        .select('base_state, preferred_states')
        .eq('user_id', user.id)
        .maybeSingle();

      // 2. Build Query for Open Assignments
      let query = supabase
        .from('assignments')
        .select('*')
        .eq('status', 'open')
        .order('audit_date', { ascending: true });

      // 3. Apply Location Filter (Server-Side)
      if (profile) {
        const allowedStates = [
          profile.base_state,
          ...(profile.preferred_states || [])
        ].filter(Boolean);
        
        if (allowedStates.length > 0) {
           query = query.in('state', allowedStates);
        }
      }

      const { data: openData, error: openError } = await query;
      if (openError) throw openError;
      setOpenAssignments(openData || []);

      // 4. Fetch Applications
      const { data: applicationsData } = await supabase
        .from('applications')
        .select(`*, assignment:assignments(*)`)
        .eq('auditor_id', user.id)
        .order('applied_at', { ascending: false });
      setMyApplications(applicationsData || []);

      // 5. Fetch My Assignments (Allotted)
      const { data: myData } = await supabase
        .from('assignments')
        .select('*')
        .eq('allotted_to', user.id)
        .order('audit_date', { ascending: true });
      setMyAssignments(myData || []);

    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const submitApplication = async () => {
    if (!selectedJobForApplication || !user) return;
    if (!interestReason.trim()) {
      toast.error("Please explain why you are interested in this assignment.");
      return;
    }

    setSubmittingApp(true);
    try {
      const { data: job } = await supabase.from('assignments').select('applicant_count').eq('id', selectedJobForApplication).single();
      
      if (job && job.applicant_count >= 5) {
        toast.error("Maximum application limit (5) reached just now.");
        setApplyDialogOpen(false);
        fetchData(); 
        return;
      }

      const { error } = await supabase.from('applications').insert({ 
        assignment_id: selectedJobForApplication, 
        auditor_id: user.id,
        interest_reason: interestReason 
      });

      if (error) throw error;
      
      await supabase.from('assignment_activities').insert({
        assignment_id: selectedJobForApplication,
        user_id: user.id,
        activity_type: 'application_received',
        description: 'New application received',
      });
      
      toast.success('Application submitted successfully!');
      setApplyDialogOpen(false);
      fetchData();
    } catch (error: any) { 
      toast.error(error.message); 
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    if (!confirm('Are you sure you want to withdraw this application?')) return;
    try {
      const { error } = await supabase.from('applications').delete().eq('id', applicationId);
      if (error) throw error;
      toast.success('Application withdrawn.');
      fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const openReportDialog = (assignment: any) => {
    setSelectedAssignmentForReport(assignment);
    setCompletionStatus('completed');
    setIncompleteReason('');
    setSelectedReportFile(null);
    setReportDialogOpen(true);
  };

  const handleReportSubmit = async () => {
    if (!selectedAssignmentForReport || !selectedReportFile || !user) { toast.error('Please select a file'); return; }
    if (completionStatus === 'incomplete' && !incompleteReason.trim()) { toast.error('Please provide reason'); return; }
    
    setUploadingReport(selectedAssignmentForReport.id);
    try {
      const fileExt = selectedReportFile.name.split('.').pop();
      const fileName = `report-${selectedAssignmentForReport.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/reports/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('kyc-documents').upload(filePath, selectedReportFile);
      if (uploadError) throw uploadError;

      const updateData: any = { report_url: filePath, completion_status: completionStatus };
      if (completionStatus === 'completed') { updateData.status = 'completed'; updateData.completed_at = new Date().toISOString(); }
      else { updateData.incomplete_reason = incompleteReason; }

      const { error: updateError } = await supabase.from('assignments').update(updateData).eq('id', selectedAssignmentForReport.id);
      if (updateError) throw updateError;

      toast.success('Report uploaded!');
      setReportDialogOpen(false);
      fetchData();
    } catch (error: any) { toast.error(error.message); }
    finally { setUploadingReport(null); }
  };

  const getDeadlineStatus = (deadline: string) => {
    const d = new Date(deadline);
    if (isPast(d) && !isToday(d)) return { label: 'Overdue', color: 'destructive' as const };
    if (isToday(d)) return { label: 'Due Today', color: 'destructive' as const };
    if (differenceInDays(d, new Date()) <= 3) return { label: `${differenceInDays(d, new Date())}d left`, color: 'secondary' as const };
    return { label: `${differenceInDays(d, new Date())}d left`, color: 'outline' as const };
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
            <Card><CardHeader className="pb-2"><CardDescription>Available Jobs</CardDescription><CardTitle className="text-3xl flex items-center gap-2"><Briefcase className="h-6 w-6 text-primary" />{openAssignments.length}</CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Pending Applications</CardDescription><CardTitle className="text-3xl flex items-center gap-2"><Clock className="h-6 w-6 text-amber-500" />{myApplications.filter(app => app.status === 'pending').length}</CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Active Assignments</CardDescription><CardTitle className="text-3xl flex items-center gap-2"><CheckCircle className="h-6 w-6 text-green-500" />{myAssignments.length}</CardTitle></CardHeader></Card>
          </div>
        </div>
      )}

      {activeTab === 'available-jobs' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>State</Label><Select value={filterState} onValueChange={setFilterState}><SelectTrigger><SelectValue placeholder="All States" /></SelectTrigger><SelectContent><SelectItem value="all">All States</SelectItem>{uniqueStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>City</Label><Select value={filterCity} onValueChange={setFilterCity}><SelectTrigger><SelectValue placeholder="All Cities" /></SelectTrigger><SelectContent><SelectItem value="all">All Cities</SelectItem>{uniqueCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Audit Type</Label><Select value={filterAuditType} onValueChange={setFilterAuditType}><SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem>{uniqueAuditTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </CardContent>
          </Card>

          {filteredOpenAssignments.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No open assignments available in your area matching criteria.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredOpenAssignments.map(a => (
                <Card key={a.id} className="flex flex-col hover:shadow-lg transition-shadow border-l-4 border-l-primary h-full">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
                          #{a.assignment_number || a.id.substring(0, 6).toUpperCase()}
                        </CardTitle>
                        {/* CONFIDENTIALITY: Show Industry or "Confidential" instead of Client Name */}
                        <div className="text-sm text-muted-foreground mt-1 font-medium flex items-center gap-1">
                          {a.industry || 'Confidential Client'}
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                        <IndianRupee className="h-3 w-3 mr-1" />
                        {a.fees?.toLocaleString()}/day
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4 flex-1">
                    <div className="grid grid-cols-2 gap-y-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span className="truncate">{a.industry || 'General Industry'}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span>{a.city}, {a.state}</span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                        <GraduationCap className="h-4 w-4 shrink-0" />
                        <span className="truncate">{a.qualification_required || 'Any Qualified'}</span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>{a.duration || 'Flexible'}</span>
                      </div>
                    </div>
                  </CardContent>

                  <div className="p-6 pt-0 mt-auto">
                    {/* BUTTON: Navigates to Details Page */}
                    <Button 
                      className="w-full" 
                      onClick={() => navigate(`/assignment/${a.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'my-applications' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Your Applications</h2>
            <Badge variant="outline">{myApplications.length} Total</Badge>
          </div>

          {myApplications.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">You haven't applied to any assignments yet.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {myApplications.map(app => (
                <Card key={app.id} className="hover:shadow-md transition-shadow border-l-4 border-l-primary group flex flex-col">
                  <CardHeader className="pb-3 bg-muted/5">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                           {/* CONFIDENTIALITY: Only show Name if Accepted (Allotted) */}
                           <CardTitle className="text-lg font-bold text-primary">
                             {app.status === 'accepted' ? app.assignment?.client_name : (app.assignment?.industry || 'Confidential Client')}
                           </CardTitle>
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mt-1">
                           {app.status === 'accepted' ? app.assignment?.branch_name : 'Branch Hidden'}
                        </div>
                      </div>
                      <StatusBadge status={app.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="py-4 flex-1">
                     <div className="grid grid-cols-2 gap-y-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                           <MapPin className="h-4 w-4 text-primary/70" /> 
                           {app.assignment?.city}, {app.assignment?.state}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                           <Calendar className="h-4 w-4 text-primary/70" /> 
                           Start: {app.assignment?.audit_date ? format(new Date(app.assignment.audit_date), 'dd MMM yyyy') : 'TBD'}
                        </div>
                        {app.status !== 'accepted' && (
                           <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit text-xs col-span-2">
                              <Shield className="h-3 w-3" /> Client details hidden
                           </div>
                        )}
                     </div>
                  </CardContent>
                  <CardFooter className="pt-3 border-t bg-muted/10 flex justify-between items-center mt-auto">
                     <div className="text-xs text-muted-foreground flex flex-col">
                        <span>Applied on</span>
                        <span className="font-medium">{format(new Date(app.applied_at), 'dd MMM yyyy')}</span>
                     </div>
                     <div className="flex gap-2">
                        {app.status === 'pending' && (
                           <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2" 
                              onClick={(e) => { e.stopPropagation(); handleDeleteApplication(app.id); }}
                           >
                              Withdraw
                           </Button>
                        )}
                        <Button 
                           size="sm" 
                           variant="outline" 
                           className="h-8 gap-1 border-primary/20 hover:border-primary/50 text-primary" 
                           onClick={() => navigate(`/assignment/${app.assignment_id}`)}
                        >
                           View Details <ArrowRight className="h-3 w-3" />
                        </Button>
                     </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'my-assignments' && (
        <div className="space-y-4">
          {myAssignments.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No assignments yet</CardContent></Card> : (
            <div className="grid gap-4">
              {myAssignments.map(a => {
                const deadlineStatus = getDeadlineStatus(a.deadline_date);
                return (
                  <Card key={a.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/assignment/${a.id}`)}>
                    <CardHeader><div className="flex justify-between items-start"><div><CardTitle className="text-lg">{a.client_name}</CardTitle><CardDescription>{a.city}, {a.state}</CardDescription></div><div className="flex gap-2"><Badge variant={deadlineStatus.color}>{deadlineStatus.label}</Badge><StatusBadge status={a.status} /></div></div></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm"><div><span className="text-muted-foreground">Audit Date:</span><br />{format(new Date(a.audit_date), 'dd MMM yyyy')}</div><div><span className="text-muted-foreground">Deadline:</span><br />{format(new Date(a.deadline_date), 'dd MMM yyyy')}</div></div>
                      <div className="flex gap-2 pt-2 border-t">
                        {a.status === 'allotted' && <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openReportDialog(a); }}>Submit Report</Button>}
                        {a.report_url && <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); window.open(a.report_url, '_blank'); }}>View Report</Button>}
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

      {/* Apply Dialog (triggered via button inside details page mainly, but keeping here for fallback) */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Apply for Assignment</DialogTitle><DialogDescription>Why are you the right fit for this audit?</DialogDescription></DialogHeader>
          <Textarea value={interestReason} onChange={(e) => setInterestReason(e.target.value)} placeholder="e.g. I have 3 years of experience in similar stock audits..." className="min-h-[120px]" />
          <DialogFooter><Button variant="outline" onClick={() => setApplyDialogOpen(false)}>Cancel</Button><Button onClick={submitApplication} disabled={submittingApp || !interestReason.trim()}>{submittingApp ? 'Submitting...' : 'Submit Application'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Submit Report</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={completionStatus} onValueChange={setCompletionStatus}><div className="flex items-center space-x-2"><RadioGroupItem value="completed" id="completed" /><Label htmlFor="completed">Completed</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="incomplete" id="incomplete" /><Label htmlFor="incomplete">Incomplete</Label></div></RadioGroup>
            {completionStatus === 'incomplete' && <Textarea value={incompleteReason} onChange={(e) => setIncompleteReason(e.target.value)} placeholder="Reason..." />}
            <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setSelectedReportFile(e.target.files?.[0] || null)} className="w-full" />
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button><Button onClick={handleReportSubmit} disabled={!!uploadingReport}>{uploadingReport ? 'Uploading...' : 'Submit'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}