import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { 
  ArrowLeft, MapPin, Calendar, Clock, Building2, FileText, 
  Upload, CheckCircle, AlertCircle, IndianRupee, Navigation,
  User, Phone, Mail, FileCheck, Timer, Star, ExternalLink
} from 'lucide-react';
import { GPSCheckInOut } from '@/components/GPSCheckInOut';
import { StatusBadge } from '@/components/StatusBadge';

interface Assignment {
  id: string;
  assignment_number: string;
  client_name: string;
  branch_name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  audit_type: string;
  audit_date: string;
  deadline_date: string;
  fees: number;
  ope: number;
  status: string;
  allotted_to: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  report_url: string | null;
  completion_status: string;
  completion_remarks: string | null;
  incomplete_reason: string | null;
  completed_at: string | null;
  auditor_rating: number | null;
}

export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingReport, setUploadingReport] = useState(false);
  
  // Report dialog state
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<string>('completed');
  const [incompleteReason, setIncompleteReason] = useState('');
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [selectedReportFile, setSelectedReportFile] = useState<File | null>(null);

  useEffect(() => {
    if (id) fetchAssignment();
  }, [id]);

  const fetchAssignment = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setAssignment(data);
    } catch (error: any) {
      toast.error('Failed to load assignment: ' + error.message);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getDeadlineStatus = (deadline: string) => {
    const d = new Date(deadline);
    const days = differenceInDays(d, new Date());
    if (isPast(d) && !isToday(d)) return { label: 'Overdue', color: 'destructive' as const, percent: 100 };
    if (isToday(d)) return { label: 'Due Today', color: 'destructive' as const, percent: 95 };
    if (days <= 3) return { label: `${days} days left`, color: 'secondary' as const, percent: 80 };
    if (days <= 7) return { label: `${days} days left`, color: 'outline' as const, percent: 60 };
    return { label: `${days} days left`, color: 'outline' as const, percent: 30 };
  };

  const getProgressPercent = () => {
    if (!assignment) return 0;
    if (assignment.status === 'completed' || assignment.status === 'paid') return 100;
    if (assignment.report_url) return 90;
    if (assignment.check_out_time) return 70;
    if (assignment.check_in_time) return 50;
    if (assignment.status === 'allotted') return 25;
    return 0;
  };

  const getProgressSteps = () => {
    if (!assignment) return [];
    return [
      { label: 'Assigned', completed: true, icon: CheckCircle },
      { label: 'Checked In', completed: !!assignment.check_in_time, icon: MapPin },
      { label: 'Checked Out', completed: !!assignment.check_out_time, icon: MapPin },
      { label: 'Report Submitted', completed: !!assignment.report_url, icon: FileText },
      { label: 'Completed', completed: assignment.status === 'completed' || assignment.status === 'paid', icon: Star },
    ];
  };

  const handleReportSubmit = async () => {
    if (!assignment || !selectedReportFile) {
      toast.error('Please select a file');
      return;
    }
    if (completionStatus === 'incomplete' && !incompleteReason.trim()) {
      toast.error('Please provide a reason for incomplete status');
      return;
    }

    setUploadingReport(true);
    try {
      const fileExt = selectedReportFile.name.split('.').pop();
      const fileName = `${assignment.id}-${Date.now()}.${fileExt}`;
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

      toast.success('Report submitted successfully!');
      setReportDialogOpen(false);
      fetchAssignment();
    } catch (error: any) {
      toast.error('Failed to submit report: ' + error.message);
    } finally {
      setUploadingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Assignment Not Found</h2>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  const deadlineStatus = getDeadlineStatus(assignment.deadline_date);
  const progressPercent = getProgressPercent();
  const progressSteps = getProgressSteps();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="gap-2 hover:bg-primary/10 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{assignment.client_name}</h1>
                <StatusBadge status={assignment.status} />
              </div>
              <p className="text-muted-foreground">{assignment.branch_name} • {assignment.assignment_number}</p>
            </div>
            <Badge variant={deadlineStatus.color} className="text-sm px-3 py-1.5">
              <Clock className="h-4 w-4 mr-1" />
              {deadlineStatus.label}
            </Badge>
          </div>
        </div>

        {/* Progress Tracker */}
        <Card className="mb-6 border-0 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              Assignment Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
            
            <div className="flex flex-wrap justify-between gap-2">
              {progressSteps.map((step, index) => (
                <div key={step.label} className="flex flex-col items-center gap-1 flex-1 min-w-[80px]">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${step.completed ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className={`text-xs text-center ${step.completed ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Assignment Info */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Assignment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Client Name</p>
                    <p className="font-medium">{assignment.client_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Branch Name</p>
                    <p className="font-medium">{assignment.branch_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Audit Type</p>
                    <Badge variant="secondary">{assignment.audit_type}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Assignment Number</p>
                    <p className="font-mono text-sm">{assignment.assignment_number}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-border/50">
                  <div className="flex items-start gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{assignment.address}</p>
                      <p className="text-sm text-muted-foreground">{assignment.city}, {assignment.state} - {assignment.pincode}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Audit Date
                    </p>
                    <p className="font-medium">{format(new Date(assignment.audit_date), 'dd MMM yyyy')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Deadline
                    </p>
                    <p className="font-medium">{format(new Date(assignment.deadline_date), 'dd MMM yyyy')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <IndianRupee className="h-3 w-3" /> Fees
                    </p>
                    <p className="font-medium">₹{assignment.fees?.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <IndianRupee className="h-3 w-3" /> OPE
                    </p>
                    <p className="font-medium">₹{(assignment.ope || 0).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* GPS Check-In/Out */}
            {assignment.status === 'allotted' && (
              <GPSCheckInOut 
                assignmentId={assignment.id} 
                checkInTime={assignment.check_in_time} 
                checkOutTime={assignment.check_out_time}
                onUpdate={fetchAssignment}
              />
            )}

            {/* Report Section */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Report & Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {assignment.report_url ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <FileCheck className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Report Submitted</p>
                          <p className="text-sm text-muted-foreground">
                            Status: {assignment.completion_status === 'completed' ? 'Completed' : 'Incomplete'}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => window.open(assignment.report_url!, '_blank')}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View Report
                      </Button>
                    </div>

                    {assignment.completion_remarks && (
                      <div className="p-4 bg-muted/50 rounded-xl">
                        <p className="text-sm text-muted-foreground mb-1">Completion Remarks</p>
                        <p className="text-sm">{assignment.completion_remarks}</p>
                      </div>
                    )}

                    {assignment.incomplete_reason && (
                      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                        <p className="text-sm text-muted-foreground mb-1">Incomplete Reason</p>
                        <p className="text-sm">{assignment.incomplete_reason}</p>
                      </div>
                    )}
                  </div>
                ) : assignment.status === 'allotted' ? (
                  <div className="text-center py-6">
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-medium mb-2">No Report Submitted Yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload your audit report once the audit is complete
                    </p>
                    <Button onClick={() => setReportDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Submit Report
                    </Button>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-6">
                    Report submission available after assignment is allotted
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignment.status === 'allotted' && !assignment.report_url && (
                  <Button className="w-full" onClick={() => setReportDialogOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Submit Report
                  </Button>
                )}
                {assignment.status === 'completed' && (
                  <Button className="w-full" variant="outline" onClick={() => navigate('/payments')}>
                    <IndianRupee className="h-4 w-4 mr-2" />
                    View Payments
                  </Button>
                )}
                <Button className="w-full" variant="outline" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(assignment.address + ', ' + assignment.city)}`, '_blank')}>
                  <Navigation className="h-4 w-4 mr-2" />
                  Open in Maps
                </Button>
              </CardContent>
            </Card>

            {/* Rating */}
            {assignment.auditor_rating && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="h-5 w-5 text-amber-500" />
                    Your Rating
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-6 w-6 ${star <= assignment.auditor_rating! ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
                      />
                    ))}
                    <span className="ml-2 font-medium">{assignment.auditor_rating}/5</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Completion Info */}
            {assignment.completed_at && (
              <Card className="border-0 shadow-lg bg-green-500/5 border-green-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-700">Completed</p>
                      <p className="text-sm text-green-600">
                        {format(new Date(assignment.completed_at), 'dd MMM yyyy, hh:mm a')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Audit Report</DialogTitle>
            <DialogDescription>
              Upload your audit report for {assignment.client_name} - {assignment.branch_name}
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
              <Label className="text-sm font-medium">Remarks (Optional)</Label>
              <Textarea
                value={completionRemarks}
                onChange={(e) => setCompletionRemarks(e.target.value)}
                placeholder="Any additional remarks about the audit..."
                className="mt-2"
              />
            </div>

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
    </div>
  );
}