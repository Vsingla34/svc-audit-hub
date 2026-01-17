import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Briefcase, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GPSCheckInOut } from '@/components/GPSCheckInOut';
import { AuditorAnalytics } from '@/components/AuditorAnalytics';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays, isPast, isToday } from 'date-fns';

export default function AuditorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openAssignments, setOpenAssignments] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [uploadingReport, setUploadingReport] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Filters
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterAuditType, setFilterAuditType] = useState<string>('all');
  
  // Report submission
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedAssignmentForReport, setSelectedAssignmentForReport] = useState<any>(null);
  const [completionStatus, setCompletionStatus] = useState<string>('completed');
  const [incompleteReason, setIncompleteReason] = useState<string>('');
  const [selectedReportFile, setSelectedReportFile] = useState<File | null>(null);

  useEffect(() => { checkKycStatus(); fetchData(); }, [user]);

  const checkKycStatus = async () => {
    if (!user) return;
    const { data } = await supabase.from('auditor_profiles').select('kyc_status').eq('user_id', user.id).maybeSingle();
    setKycStatus(data?.kyc_status || null);
  };

  const fetchData = async () => {
    try {
      // Fetch open assignments directly from assignments table (RLS policy allows this now)
      const { data: openData } = await supabase.from('assignments').select('id, state, city, pincode, audit_type, audit_date, deadline_date, status, latitude, longitude, created_at').eq('status', 'open').order('audit_date', { ascending: true });
      setOpenAssignments(openData || []);

      const { data: applicationsData } = await supabase.from('applications').select(`*, assignment:assignments(*)`).eq('auditor_id', user?.id).order('applied_at', { ascending: false });
      setMyApplications(applicationsData || []);

      const { data: myData } = await supabase.from('assignments').select('*').eq('allotted_to', user?.id).order('audit_date', { ascending: true });
      setMyAssignments(myData || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (assignmentId: string) => {
    if (kycStatus !== 'approved') { toast.error('Please complete KYC verification first'); return; }
    if (myApplications.find(app => app.assignment_id === assignmentId)) { toast.error('Already applied'); return; }
    try {
      const { error } = await supabase.from('applications').insert({ assignment_id: assignmentId, auditor_id: user?.id });
      if (error) throw error;
      toast.success('Application submitted!');
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
    if (!selectedAssignmentForReport || !selectedReportFile) { toast.error('Please select a file'); return; }
    if (completionStatus === 'incomplete' && !incompleteReason.trim()) { toast.error('Please provide reason'); return; }
    
    setUploadingReport(selectedAssignmentForReport.id);
    try {
      const fileExt = selectedReportFile.name.split('.').pop();
      const fileName = `report-${selectedAssignmentForReport.id}-${Date.now()}.${fileExt}`;
      // Store in user's folder to comply with RLS policy: (auth.uid())::text = (storage.foldername(name))[1]
      const filePath = `${user?.id}/reports/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('kyc-documents').upload(filePath, selectedReportFile);
      if (uploadError) throw uploadError;

      // Store the file path (not URL) in database - we'll generate signed URLs when viewing
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

  const handleDeleteApplication = async (applicationId: string) => {
    if (!confirm('Delete this application?')) return;
    try {
      const { error } = await supabase.from('applications').delete().eq('id', applicationId);
      if (error) throw error;
      toast.success('Application deleted!');
      fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const getDeadlineStatus = (deadline: string) => {
    const d = new Date(deadline);
    const days = differenceInDays(d, new Date());
    if (isPast(d) && !isToday(d)) return { label: 'Overdue', color: 'destructive' as const };
    if (isToday(d)) return { label: 'Due Today', color: 'destructive' as const };
    if (days <= 3) return { label: `${days}d left`, color: 'secondary' as const };
    return { label: `${days}d left`, color: 'outline' as const };
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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <DashboardLayout title="Auditor Dashboard" navItems={auditorNavItems} activeTab={activeTab} onTabChange={setActiveTab}>
      {/* KYC Alerts */}
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

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Available Jobs</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2"><Briefcase className="h-6 w-6 text-primary" />{openAssignments.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Applications</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2"><Clock className="h-6 w-6 text-amber-500" />{myApplications.filter(app => app.status === 'pending').length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active Assignments</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2"><CheckCircle className="h-6 w-6 text-green-500" />{myAssignments.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Upcoming Deadlines */}
          {myAssignments.filter(a => a.status === 'allotted').length > 0 && (
            <Card>
              <CardHeader><CardTitle>Upcoming Deadlines</CardTitle><CardDescription>Your active assignments</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {myAssignments.filter(a => a.status === 'allotted').slice(0, 5).map(a => {
                    const status = getDeadlineStatus(a.deadline_date);
                    return (
                      <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{a.client_name} - {a.branch_name}</p>
                          <p className="text-sm text-muted-foreground">{a.city}, {a.state}</p>
                        </div>
                        <Badge variant={status.color}>{status.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Available Jobs */}
      {activeTab === 'available-jobs' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>State</Label>
                  <Select value={filterState} onValueChange={setFilterState}>
                    <SelectTrigger><SelectValue placeholder="All States" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All States</SelectItem>
                      {uniqueStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>City</Label>
                  <Select value={filterCity} onValueChange={setFilterCity}>
                    <SelectTrigger><SelectValue placeholder="All Cities" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {uniqueCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Audit Type</Label>
                  <Select value={filterAuditType} onValueChange={setFilterAuditType}>
                    <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {uniqueAuditTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {filteredOpenAssignments.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No open assignments available</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOpenAssignments.map(a => {
                const hasApplied = myApplications.some(app => app.assignment_id === a.id);
                return (
                  <Card key={a.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{a.audit_type}</CardTitle>
                          <CardDescription>{a.city}, {a.state}</CardDescription>
                        </div>
                        <span className="text-xs text-muted-foreground">#{a.id?.substring(0, 8)}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm">
                        <div>Audit Date: {a.audit_date ? format(new Date(a.audit_date), 'dd MMM yyyy') : 'N/A'}</div>
                        <div className="text-xs text-muted-foreground mt-1">Apply to view full details</div>
                      </div>
                      {!hasApplied ? (
                        <Button className="w-full" onClick={() => handleApply(a.id)}>Apply</Button>
                      ) : (
                        <div className="text-center text-sm py-2 bg-muted rounded">Applied</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* My Applications */}
      {activeTab === 'my-applications' && (
        <div className="space-y-4">
          {myApplications.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No applications yet</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {myApplications.map(app => (
                <Card key={app.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{app.assignment?.client_name} - {app.assignment?.branch_name}</CardTitle>
                        <CardDescription>{app.assignment?.city}, {app.assignment?.state}</CardDescription>
                      </div>
                      <StatusBadge status={app.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        Applied: {format(new Date(app.applied_at), 'dd MMM yyyy')}
                      </div>
                      {app.status === 'pending' && (
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteApplication(app.id)}>Withdraw</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Assignments */}
      {activeTab === 'my-assignments' && (
        <div className="space-y-4">
          {myAssignments.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No assignments yet</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {myAssignments.map(a => {
                const deadlineStatus = getDeadlineStatus(a.deadline_date);
                return (
                  <Card key={a.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/assignment/${a.id}`)}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{a.client_name} - {a.branch_name}</CardTitle>
                          <CardDescription>{a.city}, {a.state} • {a.address}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={deadlineStatus.color}>{deadlineStatus.label}</Badge>
                          <StatusBadge status={a.status} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span className="text-muted-foreground">Audit Date:</span><br />{format(new Date(a.audit_date), 'dd MMM yyyy')}</div>
                        <div><span className="text-muted-foreground">Deadline:</span><br />{format(new Date(a.deadline_date), 'dd MMM yyyy')}</div>
                        <div><span className="text-muted-foreground">Fees:</span><br />₹{a.fees?.toLocaleString('en-IN')}</div>
                        <div><span className="text-muted-foreground">OPE:</span><br />₹{a.ope?.toLocaleString('en-IN') || 0}</div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button variant="default" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/assignment/${a.id}`); }}>
                          View Details
                        </Button>
                        {a.status === 'allotted' && (
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openReportDialog(a); }}>
                            Submit Report
                          </Button>
                        )}
                        {a.report_url && (
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); window.open(a.report_url, '_blank'); }}>
                            View Report
                          </Button>
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

      {/* Analytics */}
      {activeTab === 'analytics' && <AuditorAnalytics userId={user?.id || ''} />}

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Report</DialogTitle>
            <DialogDescription>Upload your audit report for {selectedAssignmentForReport?.client_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Completion Status</Label>
              <RadioGroup value={completionStatus} onValueChange={setCompletionStatus} className="mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="completed" id="completed" />
                  <Label htmlFor="completed">Completed</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="incomplete" id="incomplete" />
                  <Label htmlFor="incomplete">Incomplete</Label>
                </div>
              </RadioGroup>
            </div>

            {completionStatus === 'incomplete' && (
              <div>
                <Label>Reason for Incomplete</Label>
                <Textarea value={incompleteReason} onChange={(e) => setIncompleteReason(e.target.value)} placeholder="Explain why the audit is incomplete..." className="mt-2" />
              </div>
            )}

            <div>
              <Label>Upload Report</Label>
              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setSelectedReportFile(e.target.files?.[0] || null)} className="mt-2 w-full text-sm" />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleReportSubmit} disabled={!!uploadingReport}>
                {uploadingReport ? 'Uploading...' : 'Submit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
