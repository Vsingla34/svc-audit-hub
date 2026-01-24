import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Briefcase, Clock, CheckCircle, AlertCircle, IndianRupee, MapPin } from 'lucide-react';
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
  // loading kept for state, but removed from UI return
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedJobForApplication, setSelectedJobForApplication] = useState<string | null>(null);
  const [interestReason, setInterestReason] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);

  const [uploadingReport, setUploadingReport] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedAssignmentForReport, setSelectedAssignmentForReport] = useState<any>(null);
  const [completionStatus, setCompletionStatus] = useState<string>('completed');
  const [incompleteReason, setIncompleteReason] = useState<string>('');
  const [selectedReportFile, setSelectedReportFile] = useState<File | null>(null);
  
  const { isComplete: profileComplete, missingFields, canApply } = useProfileValidation();
  
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

      const { data: profile } = await supabase
        .from('auditor_profiles')
        .select('base_state, preferred_states')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: openData } = await supabase
        .from('assignments')
        .select('id, state, city, pincode, audit_type, audit_date, deadline_date, status, fees, client_name, branch_name, applicant_count')
        .eq('status', 'open')
        .order('audit_date', { ascending: true });

      let relevantJobs = openData || [];
      
      if (profile) {
        relevantJobs = relevantJobs.filter(job => {
          const isBaseMatch = job.state === profile.base_state;
          const isPreferredMatch = profile.preferred_states?.includes(job.state);
          const isBelowLimit = (job.applicant_count || 0) < 5;
          return (isBaseMatch || isPreferredMatch) && isBelowLimit;
        });
      }

      setOpenAssignments(relevantJobs);

      const { data: applicationsData } = await supabase.from('applications').select(`*, assignment:assignments(*)`).eq('auditor_id', user.id).order('applied_at', { ascending: false });
      setMyApplications(applicationsData || []);

      const { data: myData } = await supabase.from('assignments').select('*').eq('allotted_to', user.id).order('audit_date', { ascending: true });
      setMyAssignments(myData || []);
    } catch (error: any) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClick = (assignmentId: string) => {
    if (!profileComplete) {
      toast.error(`Please complete your profile first. Missing: ${missingFields.join(', ')}`);
      return;
    }
    if (kycStatus !== 'approved') { 
      toast.error('Your profile must be approved by admin before applying.'); 
      return; 
    }
    if (myApplications.find(app => app.assignment_id === assignmentId)) { 
      toast.error('Already applied'); 
      return; 
    }

    setSelectedJobForApplication(assignmentId);
    setInterestReason('');
    setApplyDialogOpen(true);
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOpenAssignments.map(a => {
                const hasApplied = myApplications.some(app => app.assignment_id === a.id);
                const applicantCount = a.applicant_count || 0;
                
                return (
                  <Card key={a.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{a.audit_type}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1"><MapPin className="h-3 w-3" /> {a.city}, {a.state}</CardDescription>
                          <div className="text-xs text-muted-foreground mt-1">{a.client_name}</div>
                        </div>
                        <span className="text-xs text-muted-foreground">#{a.id?.substring(0, 8)}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm space-y-1">
                        <div>Audit Date: {a.audit_date ? format(new Date(a.audit_date), 'dd MMM yyyy') : 'N/A'}</div>
                        <div className="flex justify-between items-center mt-2">
                          <div className="flex items-center gap-1 font-semibold text-primary"><IndianRupee className="h-4 w-4" /><span>{a.fees?.toLocaleString('en-IN')}</span></div>
                          <Badge variant={applicantCount >= 4 ? "destructive" : "secondary"} className="text-xs">{applicantCount}/5 Applicants</Badge>
                        </div>
                      </div>
                      {!hasApplied ? (
                        <Button className="w-full mt-2" onClick={() => handleApplyClick(a.id)} disabled={!canApply}>{canApply ? 'Apply Now' : 'Complete Profile'}</Button>
                      ) : (
                        <div className="text-center text-sm py-2 bg-muted rounded mt-2">Applied</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'my-applications' && (
        <div className="space-y-4">
          {myApplications.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No applications yet</CardContent></Card> : (
            <div className="grid gap-4">
              {myApplications.map(app => (
                <Card key={app.id}>
                  <CardHeader><div className="flex justify-between items-start"><div><CardTitle className="text-lg">{app.assignment?.client_name}</CardTitle><CardDescription>{app.assignment?.city}, {app.assignment?.state}</CardDescription></div><StatusBadge status={app.status} /></div></CardHeader>
                  <CardContent><div className="flex justify-between items-center"><div className="text-sm text-muted-foreground">Applied: {format(new Date(app.applied_at), 'dd MMM yyyy')}</div>{app.status === 'pending' && <Button size="sm" variant="destructive" onClick={() => handleDeleteApplication(app.id)}>Withdraw</Button>}</div></CardContent>
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