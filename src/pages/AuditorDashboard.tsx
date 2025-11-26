import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { AssignmentCard } from '@/components/AssignmentCard';
import { LogOut, Briefcase, Clock, CheckCircle, AlertCircle, DollarSign, ArrowLeft } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AuditorDashboard() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [openAssignments, setOpenAssignments] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState<{ [key: string]: number }>({});
  const [uploadingReport, setUploadingReport] = useState<string | null>(null);

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
      // Fetch open assignments
      const { data: openData, error: openError } = await supabase
        .from('assignments')
        .select('*')
        .eq('status', 'open')
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

    const bid = bidAmount[assignmentId];
    if (!bid || bid <= 0) {
      toast.error('Please enter a valid bid amount');
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
        bid_amount: bid,
      });

      if (error) throw error;

      toast.success('Application submitted successfully!');
      setBidAmount(prev => ({ ...prev, [assignmentId]: 0 }));
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleReportUpload = async (assignmentId: string, file: File) => {
    setUploadingReport(assignmentId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${assignmentId}-${Date.now()}.${fileExt}`;
      const filePath = `reports/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('assignments')
        .update({ 
          report_url: publicUrl,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (updateError) throw updateError;

      toast.success('Report uploaded successfully!');
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="available">Available Jobs</TabsTrigger>
            <TabsTrigger value="applications">My Applications</TabsTrigger>
            <TabsTrigger value="assignments">My Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-4">
            {openAssignments.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No open assignments available at the moment.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {openAssignments.map((assignment) => {
                  const hasApplied = myApplications.some(
                    app => app.assignment_id === assignment.id
                  );
                  
                  return (
                    <Card key={assignment.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{assignment.client_name}</CardTitle>
                        <CardDescription>{assignment.branch_name}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm space-y-2">
                          <div>Location: {assignment.city}, {assignment.state}</div>
                          <div>Audit Date: {new Date(assignment.audit_date).toLocaleDateString('en-IN')}</div>
                          <div className="font-semibold text-primary">Fees: ₹{assignment.fees.toLocaleString('en-IN')}</div>
                          {!hasApplied && (
                            <div className="mt-4 space-y-2">
                              <label className="text-sm font-medium">Your Bid Amount (₹)</label>
                              <input
                                type="number"
                                className="w-full p-2 border rounded"
                                placeholder="Enter your bid"
                                value={bidAmount[assignment.id] || ''}
                                onChange={(e) => setBidAmount(prev => ({ 
                                  ...prev, 
                                  [assignment.id]: Number(e.target.value) 
                                }))}
                              />
                              <Button
                                className="w-full"
                                onClick={() => handleApply(assignment.id)}
                              >
                                Submit Bid
                              </Button>
                            </div>
                          )}
                          {hasApplied && (
                            <div className="mt-4 text-center text-muted-foreground">
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
                {myApplications.map((app) => (
                  <Card key={app.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{app.assignment.client_name}</CardTitle>
                          <CardDescription>{app.assignment.branch_name}</CardDescription>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Location: {app.assignment.city}, {app.assignment.state}</div>
                        <div>Applied: {new Date(app.applied_at).toLocaleDateString('en-IN')}</div>
                        <div>Audit Date: {new Date(app.assignment.audit_date).toLocaleDateString('en-IN')}</div>
                        <div className="font-semibold text-primary mt-2">Your Bid: ₹{app.bid_amount?.toLocaleString('en-IN') || 0}</div>
                        <div className="font-semibold text-primary">Assignment Fees: ₹{app.assignment.fees.toLocaleString('en-IN')}</div>
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
                      <CardTitle className="text-lg">{assignment.client_name}</CardTitle>
                      <CardDescription>{assignment.branch_name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm space-y-2">
                        <div>Location: {assignment.city}, {assignment.state}</div>
                        <div>Audit Date: {new Date(assignment.audit_date).toLocaleDateString('en-IN')}</div>
                        <div className="font-semibold text-primary">Fees: ₹{assignment.fees.toLocaleString('en-IN')}</div>
                        <StatusBadge status={assignment.status} />
                        
                        {assignment.status === 'allotted' && !assignment.report_url && (
                          <div className="mt-4">
                            <label className="text-sm font-medium">Upload Report</label>
                            <input
                              type="file"
                              className="w-full mt-2"
                              accept=".pdf,.doc,.docx"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleReportUpload(assignment.id, file);
                              }}
                              disabled={uploadingReport === assignment.id}
                            />
                            {uploadingReport === assignment.id && (
                              <div className="text-sm text-muted-foreground mt-2">Uploading...</div>
                            )}
                          </div>
                        )}
                        
                        {assignment.report_url && (
                          <div className="mt-4">
                            <a 
                              href={assignment.report_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary underline text-sm"
                            >
                              View Submitted Report
                            </a>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
