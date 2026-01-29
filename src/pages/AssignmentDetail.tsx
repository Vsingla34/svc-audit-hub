import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, MapPin, Calendar, Clock, Building2, Info, Laptop, 
  IndianRupee, CheckCircle2, FileText, Upload, FileCheck, Star, ExternalLink, Navigation 
} from 'lucide-react';
import { format } from 'date-fns';
import { DashboardLayout, auditorNavItems, adminNavItems } from '@/components/DashboardLayout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useProfileValidation } from '@/hooks/useProfileValidation';

export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [assignment, setAssignment] = useState<any>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [reportSignedUrl, setReportSignedUrl] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<string>('completed');
  const [incompleteReason, setIncompleteReason] = useState('');
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [selectedReportFile, setSelectedReportFile] = useState<File | null>(null);

  const { isComplete: profileComplete, missingFields, canApply } = useProfileValidation();

  useEffect(() => {
    if (id) fetchAssignmentDetails();
  }, [id, user]);

  const fetchAssignmentDetails = async () => {
    // 1. Fetch Assignment
    const { data: job, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      toast({ title: 'Error', description: 'Could not load assignment details', variant: 'destructive' });
      navigate('/dashboard');
      return;
    }
    setAssignment(job);

    // 2. Check if already applied (for auditors)
    if (user && userRole === 'auditor') {
      const { data: application } = await supabase
        .from('applications')
        .select('id')
        .eq('assignment_id', id)
        .eq('auditor_id', user.id)
        .maybeSingle();
      
      if (application) setHasApplied(true);
    }

    // 3. Get Signed URL for report if exists
    if (job.report_url && !job.report_url.startsWith('http')) {
        const { data, error } = await supabase.storage
          .from('kyc-documents')
          .createSignedUrl(job.report_url, 3600);
        if (!error && data) {
          setReportSignedUrl(data.signedUrl);
        }
    }
  };

  const handleApply = async () => {
    if (!user) return;
    if (!profileComplete) {
      toast({ title: 'Incomplete Profile', description: `Please complete your profile first. Missing: ${missingFields.join(', ')}`, variant: 'destructive' });
      return;
    }

    setApplying(true);
    const { error } = await supabase
      .from('applications')
      .insert({
        assignment_id: id,
        auditor_id: user.id,
        status: 'pending'
      });

    if (error) {
      toast({ title: "Application Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Applied Successfully", description: "The client will be notified." });
      setHasApplied(true);
    }
    setApplying(false);
  };

  const handleReportSubmit = async () => {
    if (!assignment || !selectedReportFile) {
      toast({ title: 'Error', description: 'Please select a file', variant: 'destructive' });
      return;
    }
    if (completionStatus === 'incomplete' && !incompleteReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a reason', variant: 'destructive' });
      return;
    }

    setUploadingReport(true);
    try {
      const fileExt = selectedReportFile.name.split('.').pop();
      const fileName = `report-${assignment.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user?.id}/reports/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(filePath, selectedReportFile);
      if (uploadError) throw uploadError;

      const updateData: any = { 
        report_url: filePath, 
        completion_status: completionStatus,
        completion_remarks: completionRemarks || null,
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
        .eq('id', assignment.id);
      if (updateError) throw updateError;

      toast({ title: "Success", description: 'Report submitted successfully!' });
      setReportDialogOpen(false);
      fetchAssignmentDetails();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingReport(false);
    }
  };

  if (!assignment) return <div className="p-8 text-center">Loading details...</div>;

  const navItems = userRole === 'admin' ? adminNavItems : auditorNavItems;

  return (
    <DashboardLayout title="Assignment Details" navItems={navItems}>
      <div className="max-w-5xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Jobs
        </Button>

        {/* Header Card */}
        <Card className="border-t-4 border-t-primary shadow-md">
          <CardHeader className="pb-4 border-b">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline" className="text-muted-foreground font-mono">
                    #{assignment.assignment_number || 'ID-N/A'}
                  </Badge>
                  <Badge className="capitalize">{assignment.audit_type}</Badge>
                </div>
                <CardTitle className="text-2xl font-bold">{assignment.industry || assignment.client_name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2 text-base">
                  <MapPin className="h-4 w-4" /> 
                  {assignment.city}, {assignment.state}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">₹{assignment.fees?.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">per man/day</div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-6 grid gap-8 md:grid-cols-3">
            
            {/* Left Column: Key Details */}
            <div className="md:col-span-2 space-y-6">
              <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" /> Scope & Requirements
                </h3>
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Qualification Required</span>
                      <p className="font-medium">{assignment.qualification_required || 'Not specified'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Laptop Required</span>
                      <p className="font-medium flex items-center gap-2">
                        {assignment.laptop_required ? (
                          <><Laptop className="h-4 w-4 text-orange-500" /> Yes</>
                        ) : (
                          "No"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                     <span className="text-sm text-muted-foreground">Reimbursement Policy</span>
                     <p className="font-medium">{assignment.reimbursement || 'None specified'}</p>
                  </div>
                </div>
              </section>

              {assignment.additional_info && (
                <section>
                  <h3 className="text-lg font-semibold mb-2">Additional Information</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line bg-card border p-4 rounded-md shadow-sm">
                    {assignment.additional_info}
                  </p>
                </section>
              )}

              {/* Show Report Section if Allotted to User */}
              {assignment.allotted_to === user?.id && (
                <section className="mt-8 border-t pt-6">
                   <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" /> Report & Completion
                   </h3>
                   <div className="bg-muted/10 border rounded-xl p-6">
                      {assignment.report_url ? (
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <FileCheck className="h-8 w-8 text-green-600" />
                              <div>
                                <p className="font-medium">Report Submitted</p>
                                <p className="text-sm text-muted-foreground">Status: {assignment.completion_status}</p>
                              </div>
                           </div>
                           <Button variant="outline" onClick={() => reportSignedUrl && window.open(reportSignedUrl, '_blank')}>
                              <ExternalLink className="h-4 w-4 mr-2" /> View Report
                           </Button>
                        </div>
                      ) : (
                        <div className="text-center">
                           <p className="text-muted-foreground mb-4">Audit complete? Submit your report here.</p>
                           <Button onClick={() => setReportDialogOpen(true)}>
                              <Upload className="h-4 w-4 mr-2" /> Submit Report
                           </Button>
                        </div>
                      )}
                   </div>
                </section>
              )}
            </div>

            {/* Right Column: Timeline & Action */}
            <div className="space-y-6">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                       <Calendar className="h-4 w-4" /> Start Date
                    </div>
                    <p className="font-semibold">{format(new Date(assignment.audit_date), 'dd MMM yyyy')}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                       <Clock className="h-4 w-4" /> Duration
                    </div>
                    <p className="font-semibold">{assignment.duration || 'TBD'}</p>
                  </div>

                  <div className="pt-4">
                    {userRole === 'auditor' ? (
                       hasApplied ? (
                        <Button className="w-full bg-green-600 hover:bg-green-700 cursor-default" disabled>
                          <CheckCircle2 className="h-4 w-4 mr-2" /> Applied
                        </Button>
                      ) : (
                        <Button className="w-full" size="lg" onClick={handleApply} disabled={applying}>
                          {applying ? 'Applying...' : 'Apply Now'}
                        </Button>
                      )
                    ) : (
                      <Button className="w-full" variant="outline" disabled>
                        {assignment.status === 'open' ? 'Open for Applications' : assignment.status}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions for Active Audit */}
              {assignment.allotted_to === user?.id && (
                 <Card>
                    <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                       <Button className="w-full justify-start" variant="outline" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(assignment.city + ', ' + assignment.state)}`)}>
                          <Navigation className="h-4 w-4 mr-2" /> Navigate to Location
                       </Button>
                    </CardContent>
                 </Card>
              )}
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Report Submission Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Audit Report</DialogTitle>
            <DialogDescription>
              Upload your audit report for {assignment.client_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-sm font-medium">Completion Status</Label>
              <RadioGroup value={completionStatus} onValueChange={setCompletionStatus} className="mt-2 space-y-2">
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="completed" id="completed" />
                  <Label htmlFor="completed" className="flex-1 cursor-pointer">
                    <span className="font-medium">Completed</span>
                    <p className="text-xs text-muted-foreground">Audit was completed successfully</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="incomplete" id="incomplete" />
                  <Label htmlFor="incomplete" className="flex-1 cursor-pointer">
                    <span className="font-medium">Incomplete</span>
                    <p className="text-xs text-muted-foreground">Audit could not be completed</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {completionStatus === 'incomplete' && (
              <div>
                <Label className="text-sm font-medium">Reason for Incomplete</Label>
                <Textarea
                  value={incompleteReason}
                  onChange={(e) => setIncompleteReason(e.target.value)}
                  placeholder="Explain why the audit is incomplete..."
                  className="mt-2"
                />
              </div>
            )}

            <div>
              <Label className="text-sm font-medium">Upload Report (PDF/DOC)</Label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setSelectedReportFile(e.target.files?.[0] || null)}
                className="mt-2 w-full text-sm border rounded-lg p-2 cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReportSubmit} disabled={uploadingReport || !selectedReportFile}>
                {uploadingReport ? 'Uploading...' : 'Submit Report'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}