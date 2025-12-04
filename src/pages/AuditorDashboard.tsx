import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { AssignmentCard } from '@/components/AssignmentCard';
import { LogOut, Briefcase, Clock, CheckCircle, AlertCircle, DollarSign, ArrowLeft, BarChart3 } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NotificationBell } from '@/components/NotificationBell';
import { GPSCheckInOut } from '@/components/GPSCheckInOut';
import { AuditorAnalytics } from '@/components/AuditorAnalytics';

export default function AuditorDashboard() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [openAssignments, setOpenAssignments] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [uploadingReport, setUploadingReport] = useState<string | null>(null);
  
  // Filters
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterAuditType, setFilterAuditType] = useState<string>('all');
  
  // Report submission dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedAssignmentForReport, setSelectedAssignmentForReport] = useState<any>(null);
  const [completionStatus, setCompletionStatus] = useState<string>('completed');
  const [incompleteReason, setIncompleteReason] = useState<string>('');
  const [selectedReportFile, setSelectedReportFile] = useState<File | null>(null);

  useEffect(() => {
    checkKycStatus();
    fetchData();
  }, [user]);

  const checkKycStatus = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('auditor_profiles')
      .select('kyc_status')
      .eq('user_id', user.id)
      .maybeSingle();

    setKycStatus(data?.kyc_status || null);
  };

  const fetchData = async () => {
    try {
      // Fetch open assignments using the limited public view
      const { data: openData, error: openError } = await supabase
        .from('assignments_public_view')
        .select('*')
        .order('audit_date', { ascending: true });

      if (openError) throw openError;
      setOpenAssignments(openData || []);

      // Fetch my applications
      const { data: applicationsData, error: applicationsError } = await supabase
        .from('applications')
        .select(`
          *,
          assignment:assignments(*)
        `)
        .eq('auditor_id', user?.id)
        .order('applied_at', { ascending: false });

      if (applicationsError) throw applicationsError;
      setMyApplications(applicationsData || []);

      // Fetch my allotted assignments
      const { data: myData, error: myError } = await supabase
        .from('assignments')
        .select('*')
        .eq('allotted_to', user?.id)
        .order('audit_date', { ascending: true });

      if (myError) throw myError;
      setMyAssignments(myData || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (assignmentId: string) => {
    // Check KYC status before allowing application
    if (kycStatus !== 'approved') {
      toast.error('Please complete KYC verification before applying');
      return;
    }

    try {
      // Check if already applied
      const existingApplication = myApplications.find(
        app => app.assignment_id === assignmentId
      );

      if (existingApplication) {
        toast.error('You have already applied for this assignment');
        return;
      }

      const { error } = await supabase.from('applications').insert({
        assignment_id: assignmentId,
        auditor_id: user?.id,
      });

      if (error) throw error;

      toast.success('Application submitted successfully!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openReportDialog = (assignment: any) => {
    setSelectedAssignmentForReport(assignment);
    setCompletionStatus('completed');
    setIncompleteReason('');
    setSelectedReportFile(null);
    setReportDialogOpen(true);
  };

  const handleReportSubmit = async () => {
    if (!selectedAssignmentForReport || !selectedReportFile) {
      toast.error('Please select a file to upload');
      return;
    }

    if (completionStatus === 'incomplete' && !incompleteReason.trim()) {
      toast.error('Please provide a reason for incomplete audit');
      return;
    }
    
    setUploadingReport(selectedAssignmentForReport.id);
    try {
      const fileExt = selectedReportFile.name.split('.').pop();
      const fileName = `${selectedAssignmentForReport.id}-${Date.now()}.${fileExt}`;
      const filePath = `reports/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(filePath, selectedReportFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(filePath);

      const updateData: any = { 
        report_url: publicUrl,
        completion_status: completionStatus,
      };

      if (completionStatus === 'completed') {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.incomplete_reason = incompleteReason;
      }

      const { error: updateError } = await supabase
        .from('assignments')
        .update(updateData)
        .eq('id', selectedAssignmentForReport.id);

      if (updateError) throw updateError;

      toast.success('Report uploaded successfully!');
      setReportDialogOpen(false);
      setSelectedAssignmentForReport(null);
      setSelectedReportFile(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploadingReport(null);
    }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;
    
    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', applicationId);

      if (error) throw error;
      toast.success('Application deleted successfully!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredOpenAssignments = openAssignments.filter(assignment => {
    if (filterState !== 'all' && assignment.state !== filterState) return false;
    if (filterCity !== 'all' && assignment.city !== filterCity) return false;
    if (filterAuditType !== 'all' && assignment.audit_type !== filterAuditType) return false;
    return true;
  });

  const uniqueStates = [...new Set(openAssignments.map(a => a.state))].filter(Boolean);
  const uniqueCities = [...new Set(openAssignments.map(a => a.city))].filter(Boolean);
  const uniqueAuditTypes = [...new Set(openAssignments.map(a => a.audit_type))].filter(Boolean);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-primary">Auditor Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            {kycStatus === 'approved' && (
            <Button variant="outline" onClick={() => navigate('/payments')}>
                <DollarSign className="h-4 w-4 mr-2" />
                Payments
              </Button>
            )}
            <NotificationBell />
            <Button variant="outline" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* KYC Status Alert */}
        {(!kycStatus || kycStatus === 'pending') && (
          <Alert variant={!kycStatus ? 'destructive' : 'default'}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {!kycStatus ? 'Complete Your Profile' : 'KYC Under Review'}
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                {!kycStatus 
                  ? 'Complete your auditor profile to apply for assignments'
                  : 'Your profile is under admin review. You can apply once approved.'}
              </span>
              {!kycStatus && (
                <Button size="sm" onClick={() => navigate('/profile-setup')}>
                  Complete Profile
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {kycStatus === 'rejected' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>KYC Rejected</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>Your KYC was rejected. Please update your profile and resubmit.</span>
              <Button size="sm" variant="outline" onClick={() => navigate('/profile-setup')}>
                Update Profile
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available Jobs</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-primary" />
                {openAssignments.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Applications</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Clock className="h-6 w-6 text-warning" />
                {myApplications.filter(app => app.status === 'pending').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Assignments</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-accent" />
                {myAssignments.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="available" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="available">Available Jobs</TabsTrigger>
            <TabsTrigger value="applications">My Applications</TabsTrigger>
            <TabsTrigger value="assignments">My Assignments</TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>State</Label>
                    <Select value={filterState} onValueChange={setFilterState}>
                      <SelectTrigger>
                        <SelectValue placeholder="All States" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All States</SelectItem>
                        {uniqueStates.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>City</Label>
                    <Select value={filterCity} onValueChange={setFilterCity}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Cities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Cities</SelectItem>
                        {uniqueCities.map(city => (
                          <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Audit Type</Label>
                    <Select value={filterAuditType} onValueChange={setFilterAuditType}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {uniqueAuditTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {filteredOpenAssignments.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No open assignments available at the moment.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOpenAssignments.map((assignment) => {
                  const hasApplied = myApplications.some(
                    app => app.assignment_id === assignment.id
                  );
                  
                  return (
                    <Card key={assignment.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{assignment.audit_type || 'Assignment'}</CardTitle>
                            <CardDescription>{assignment.city}, {assignment.state}</CardDescription>
                          </div>
                          <span className="text-xs text-muted-foreground">#{assignment.id?.substring(0, 8)}</span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm space-y-2">
                          <div>Location: {assignment.city}, {assignment.state}</div>
                          <div>Audit Date: {assignment.audit_date ? new Date(assignment.audit_date).toLocaleDateString('en-IN') : 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">Apply to view full details including fees and client information</div>
                          {!hasApplied && (
                            <Button
                              className="w-full mt-4"
                              onClick={() => handleApply(assignment.id)}
                            >
                              Apply for Assignment
                            </Button>
                          )}
                          {hasApplied && (
                            <div className="mt-4 text-center text-accent-foreground bg-accent/10 py-2 rounded">
                              Application Submitted
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="applications" className="space-y-4">
            {myApplications.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  You haven't applied for any assignments yet.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {myApplications.filter(app => app.assignment).map((app) => (
                  <Card key={app.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{app.assignment?.client_name || 'Assignment Details Unavailable'}</CardTitle>
                          <CardDescription>{app.assignment?.branch_name || 'N/A'}</CardDescription>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Location: {app.assignment?.city}, {app.assignment?.state}</div>
                        <div>Applied: {app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-IN') : 'N/A'}</div>
                        <div>Audit Date: {app.assignment?.audit_date ? new Date(app.assignment.audit_date).toLocaleDateString('en-IN') : 'N/A'}</div>
                        {app.assignment?.assignment_number && (
                          <div className="text-xs font-mono">Assignment #{app.assignment.assignment_number}</div>
                        )}
                        {app.assignment?.fees && <div className="font-semibold text-primary mt-2">Fees: ₹{Number(app.assignment.fees).toLocaleString('en-IN')}</div>}
                      </div>
                      {app.status === 'pending' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="mt-4"
                          onClick={() => handleDeleteApplication(app.id)}
                        >
                          Delete Application
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            {myAssignments.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No assignments allotted yet.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myAssignments.map((assignment) => (
                    <Card key={assignment.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{assignment.client_name}</CardTitle>
                            <CardDescription>{assignment.branch_name}</CardDescription>
                            <div className="text-xs font-mono text-muted-foreground mt-1">#{assignment.assignment_number}</div>
                          </div>
                          <StatusBadge status={assignment.status} />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm space-y-4">
                          <div>Location: {assignment.city}, {assignment.state}</div>
                          <div>Audit Date: {assignment.audit_date ? new Date(assignment.audit_date).toLocaleDateString('en-IN') : 'N/A'}</div>
                          {assignment.fees && <div className="font-semibold text-primary">Fees: ₹{Number(assignment.fees).toLocaleString('en-IN')}</div>}
                          
                          {/* GPS Check-In/Out */}
                          {assignment.status === 'allotted' && (
                            <GPSCheckInOut
                              assignmentId={assignment.id}
                              checkInTime={assignment.check_in_time}
                              checkOutTime={assignment.check_out_time}
                              onUpdate={fetchData}
                            />
                          )}
                          
                          {assignment.status === 'allotted' && !assignment.report_url && (
                            <Button
                              className="w-full mt-4"
                              onClick={() => openReportDialog(assignment)}
                            >
                              Upload Report
                            </Button>
                          )}

                          {assignment.report_url && (
                            <div className="mt-4 p-2 bg-accent/10 rounded text-center text-sm">
                              Report Submitted
                              {assignment.completion_status === 'incomplete' && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Status: Incomplete
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            {user && <AuditorAnalytics userId={user.id} />}
          </TabsContent>
        </Tabs>
      </main>

      {/* Report Upload Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Assignment Report</DialogTitle>
            <DialogDescription>
              Upload your report and indicate completion status
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Completion Status</Label>
              <RadioGroup value={completionStatus} onValueChange={setCompletionStatus}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="completed" id="completed" />
                  <Label htmlFor="completed" className="font-normal cursor-pointer">
                    Audit Completed Successfully
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="incomplete" id="incomplete" />
                  <Label htmlFor="incomplete" className="font-normal cursor-pointer">
                    Audit Incomplete
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {completionStatus === 'incomplete' && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Incomplete Audit</Label>
                <Textarea
                  id="reason"
                  value={incompleteReason}
                  onChange={(e) => setIncompleteReason(e.target.value)}
                  placeholder="Please explain why the audit could not be completed..."
                  rows={4}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="report-file">Upload Report (PDF, DOC, DOCX)</Label>
              <input
                id="report-file"
                type="file"
                className="w-full p-2 border rounded"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedReportFile(file);
                  }
                }}
                disabled={uploadingReport !== null}
              />
              {selectedReportFile && (
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedReportFile.name}
                </div>
              )}
              {uploadingReport && (
                <div className="text-sm text-muted-foreground">Uploading...</div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setReportDialogOpen(false)}
                disabled={uploadingReport !== null}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleReportSubmit}
                disabled={uploadingReport !== null || !selectedReportFile}
              >
                {uploadingReport ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
