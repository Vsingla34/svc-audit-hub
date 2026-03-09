import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MapPin, Calendar, RefreshCcw, AlertCircle, Upload, FileText, FileSpreadsheet, CheckCircle, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// --- LIVE ASSIGNMENT CARD COMPONENT ---
// Encapsulates the tracking state so multiple live assignments don't conflict
function LiveAssignmentCard({ assignment, user, onUpdate }: { assignment: any, user: any, onUpdate: () => void }) {
  const [trackingData, setTrackingData] = useState<any>(assignment.tracking_details || {});
  const [uploading, setUploading] = useState(false);
  const [activeSlots, setActiveSlots] = useState<number[]>([1, 2]);

  useEffect(() => {
    setTrackingData(assignment.tracking_details || {});
  }, [assignment.tracking_details]);

  useEffect(() => {
    if (trackingData?.reports?.length > 0) {
      setActiveSlots(prev => {
         const existingSlots = trackingData.reports.map((r: any) => r.slot);
         const merged = Array.from(new Set([...prev, 1, 2, ...existingSlots])).sort((a, b) => a - b);
         if (merged.join(',') !== prev.join(',')) return merged;
         return prev;
      });
    }
  }, [trackingData?.reports]);

  const updateTrackingData = async (newData: any) => {
     const updated = { ...trackingData, ...newData };
     setTrackingData(updated);

     const { error } = await supabase
        .from('assignments')
        .update({ 
           tracking_details: updated,
           status: 'in_progress' 
        })
        .eq('id', assignment.id);
        
     if (error) { 
        toast.error("Failed to update report in database"); 
        setTrackingData(assignment.tracking_details || {});
     } else {
        onUpdate();
     }
  };

  const handleCheckInUpload = async (file: File) => {
     setUploading(true);
     try {
        const path = `${user?.id}/check-in/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { error } = await supabase.storage.from('kyc-documents').upload(path, file);
        if (error) throw error;
        await updateTrackingData({ check_in: { url: path, status: 'pending', timestamp: new Date().toISOString() } });
        toast.success("Check-in photo uploaded!");
     } catch (e:any) { 
        toast.error(e.message); 
     } finally { 
        setUploading(false); 
     }
  };

  const handleStartAssignment = async (started: boolean) => {
     if (started) { 
        await updateTrackingData({ is_started: true }); 
        toast.success("Assignment started!"); 
     }
  };

  const handleReportUpload = async (file: File, slot: number) => {
     setUploading(true);
     try {
        const path = `${user?.id}/reports/${Date.now()}-slot${slot}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { error } = await supabase.storage.from('kyc-documents').upload(path, file);
        if (error) {
           if (error.message.includes('mime') || error.message.includes('Type')) { 
               toast.error("File type not allowed."); 
           } else { 
               throw error; 
           }
           return;
        }
        const newReport = { id: crypto.randomUUID(), name: file.name, url: path, status: 'pending', slot: slot, type: file.type, timestamp: new Date().toISOString() };
        const currentReports = trackingData.reports || [];
        const otherReports = currentReports.filter((r: any) => r.slot !== slot);
        await updateTrackingData({ reports: [...otherReports, newReport] });
        toast.success(`Report uploaded successfully!`);
     } catch (e:any) { 
        toast.error(e.message || "Upload failed"); 
     } finally { 
        setUploading(false); 
     }
  };

  const deleteReportFile = async (reportId: string) => {
      if(!confirm("Are you sure you want to delete this file?")) return;
      const currentReports = trackingData.reports || [];
      const updatedReports = currentReports.filter((r: any) => r.id !== reportId);
      await updateTrackingData({ reports: updatedReports });
      toast.success("File removed");
  };

  const handleAddSlot = () => {
      setActiveSlots(prev => {
         const nextSlot = Math.max(2, ...prev) + 1;
         return [...prev, nextSlot];
      });
  };

  const handleRemoveSlot = async (slotToRemove: number) => {
      const report = getReportBySlot(slotToRemove);
      if (report) {
          if(!confirm("This box contains an uploaded file. Removing the box will also delete the file. Continue?")) return;
          const updatedReports = (trackingData.reports || []).filter((r: any) => r.id !== report.id);
          await updateTrackingData({ reports: updatedReports });
      }
      setActiveSlots(prev => prev.filter(s => s !== slotToRemove));
  };

  const handleCheckOut = async () => {
     if (!confirm("Are you sure you want to check out? The admin will review your reports and finalize your payment.")) return;
     
     const { error } = await supabase
        .from('assignments')
        .update({ 
           status: 'in_progress', 
           tracking_details: { ...trackingData, check_out: { completed: true, timestamp: new Date().toISOString() } } 
        })
        .eq('id', assignment.id);
        
     if (error) {
         toast.error("Check out failed"); 
     } else { 
         toast.success("Check out submitted! Awaiting Admin Review."); 
         onUpdate();
     }
  };

  const isCheckedOut = trackingData?.check_out?.completed;
  const canStart = trackingData?.check_in?.url; 
  const isStarted = trackingData?.is_started;
  const reports = trackingData?.reports || [];
  const hasReports = reports.length > 0;
  const allReportsApproved = hasReports && reports.every((r: any) => r.status === 'approved');
  const canCheckOut = isStarted && allReportsApproved && trackingData?.check_in?.status === 'approved';

  const getReportBySlot = (slot: number) => reports.find((r: any) => r.slot === slot);

  const getSlotLabel = (slot: number, index: number) => {
     if (slot === 1) return "Main report file";
     if (slot === 2) return "Supporting file";
     return `Supporting file ${index}`; 
  };

  const getFileIcon = (fileName: string) => {
     if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        return <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#4338CA]" />;
     }
     return <FileText className="h-4 w-4 shrink-0 text-[#4338CA]" />;
  };

  return (
    <Card className="border-l-4 border-l-[#4338CA] shadow-md mb-6 overflow-hidden">
      <div className="bg-[#4338CA] text-white px-6 py-2 flex justify-between items-center text-sm font-semibold tracking-wide">
         <span>ACTION REQUIRED TODAY</span>
         <span>{assignment.audit_type}</span>
      </div>
      <CardHeader className="bg-muted/5 border-b">
         <div className="flex justify-between items-start">
            <div>
               <CardTitle className="text-2xl">{assignment.client_name}</CardTitle>
               <CardDescription className="text-base mt-1 flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {assignment.branch_name} • {assignment.city}, {assignment.state}
               </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onUpdate} title="Refresh Data">
               <RefreshCcw className="h-4 w-4 mr-2"/> Refresh
            </Button>
         </div>
      </CardHeader>
      <CardContent className="space-y-8 pt-8">
         
         {/* 1. CHECK IN */}
         <div className="space-y-4">
            <div className="flex items-center gap-3 font-semibold text-lg">
               <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${trackingData.check_in ? 'bg-[#4338CA] text-white' : 'bg-[#4338CA]/10 text-[#4338CA]'}`}>1</div>
               Location Check-In
               {trackingData.check_in?.status === 'approved' && <Badge className="bg-green-600 ml-2">Admin Approved</Badge>}
               {trackingData.check_in?.status === 'rejected' && <Badge variant="destructive" className="ml-2">Admin Rejected</Badge>}
               {trackingData.check_in?.status === 'pending' && <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200">Pending Review</Badge>}
            </div>
            
            {trackingData.check_in?.url ? (
               <div className="ml-11 space-y-3">
                  <img 
                     src={trackingData.check_in.url.startsWith('http') ? trackingData.check_in.url : `https://tcmtmznnjdqjmxetqvdq.supabase.co/storage/v1/object/public/kyc-documents/${trackingData.check_in.url}`} 
                     alt="Check In Selfie" 
                     className="h-48 w-auto rounded-lg border object-cover shadow-sm" 
                  />
                  
                  {trackingData.check_in.status === 'rejected' && (
                     <div className="space-y-3 max-w-md">
                        <Alert variant="destructive">
                           <AlertCircle className="h-4 w-4"/>
                           <AlertTitle>Upload Rejected by Admin</AlertTitle>
                           <AlertDescription>{trackingData.check_in.feedback || "Please re-upload a clearer image showing your location."}</AlertDescription>
                        </Alert>
                        <div className="flex items-center gap-2">
                           <Label htmlFor={`reupload-checkin-${assignment.id}`} className="cursor-pointer bg-destructive/10 text-destructive px-3 py-1.5 rounded text-sm hover:bg-destructive/20 font-medium">
                              Select New Image
                           </Label>
                           <input id={`reupload-checkin-${assignment.id}`} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleCheckInUpload(e.target.files[0])} className="hidden" disabled={uploading} />
                           {uploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading...</span>}
                        </div>
                     </div>
                  )}
               </div>
            ) : (
               <div className="ml-11 max-w-md">
                  <Label className="text-muted-foreground mb-2 block">Take a selfie at the client location to begin the audit process.</Label>
                  <div className="mt-3">
                     <Label htmlFor={`upload-checkin-${assignment.id}`} className="cursor-pointer bg-white border-2 border-dashed border-[#4338CA]/30 text-[#4338CA] px-4 py-8 rounded-xl flex flex-col items-center justify-center hover:bg-[#4338CA]/5 transition-colors">
                        <Upload className="h-6 w-6 mb-2" />
                        <span className="font-medium">Upload Photo</span>
                     </Label>
                     <input id={`upload-checkin-${assignment.id}`} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleCheckInUpload(e.target.files[0])} disabled={uploading} className="hidden"/>
                     {uploading && <span className="text-xs text-muted-foreground mt-2 block animate-pulse">Uploading image...</span>}
                  </div>
               </div>
            )}
         </div>

         <Separator />

         {/* 2. START ASSIGNMENT */}
         <div className={`space-y-4 ${!canStart ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            <div className="flex items-center gap-3 font-semibold text-lg">
               <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${isStarted ? 'bg-[#4338CA] text-white' : 'bg-[#4338CA]/10 text-[#4338CA]'}`}>2</div>
               Confirm Audit Start
            </div>
            <div className="ml-11">
               <RadioGroup value={isStarted ? 'yes' : 'no'} onValueChange={(v) => v === 'yes' && handleStartAssignment(true)} disabled={isStarted}>
                  <div className="flex items-center space-x-3 mb-2">
                     <RadioGroupItem value="yes" id={`r-yes-${assignment.id}`} />
                     <Label htmlFor={`r-yes-${assignment.id}`} className="font-medium text-base cursor-pointer">Yes, I am on-site and starting the audit now</Label>
                  </div>
               </RadioGroup>
               {!isStarted && <p className="text-sm text-muted-foreground mt-2">You must confirm you have started the audit before you can upload final reports.</p>}
            </div>
         </div>

         <Separator />

         {/* 3. REPORTS UPLOAD */}
         <div className={`space-y-4 ${!isStarted ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            <div className="flex items-center gap-3 font-semibold text-lg">
               <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${allReportsApproved ? 'bg-[#4338CA] text-white' : 'bg-[#4338CA]/10 text-[#4338CA]'}`}>3</div>
               Upload Audit Reports
            </div>
            
            <p className="ml-11 text-sm text-muted-foreground mb-4">Upload the completed assignment files here. The admin must review and approve them before you can check out.</p>

            <div className="ml-11 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeSlots.map((slot, index) => {
                const report = getReportBySlot(slot);
                
                return (
                  <div key={slot} className="border rounded-xl p-4 bg-muted/5 flex flex-col gap-3 min-h-[140px] relative overflow-hidden group">
                    <div className="flex justify-between items-center z-10 relative">
                       <span className="font-semibold text-sm">{getSlotLabel(slot, index)}</span>
                       
                       <div className="flex items-center gap-2">
                          {report && (
                             <Badge variant={report.status === 'approved' ? 'default' : report.status === 'rejected' ? 'destructive' : 'secondary'} className={report.status === 'approved' ? 'bg-green-600' : ''}>
                                {report.status}
                             </Badge>
                          )}
                          
                          {slot > 2 && (
                             <button 
                                onClick={() => handleRemoveSlot(slot)} 
                                className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10" 
                                title="Remove this upload box"
                             >
                                <Trash2 className="h-4 w-4" />
                             </button>
                          )}
                       </div>
                    </div>

                    {report ? (
                       <div className="space-y-3 mt-2 z-10 relative">
                          <div className="flex items-center gap-2 text-sm text-[#4338CA] bg-white border shadow-sm p-2 rounded-md truncate" title={report.name}>
                             {getFileIcon(report.name)}
                             <span className="truncate font-medium">{report.name}</span>
                          </div>
                          
                          {report.feedback && (
                             <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-md border border-red-100 font-medium">
                                Admin Feedback: {report.feedback}
                             </div>
                          )}

                          {(report.status === 'pending' || report.status === 'rejected') && (
                             <Button variant="destructive" size="sm" className="w-full h-8" onClick={() => deleteReportFile(report.id)}>
                                {report.status === 'rejected' ? 'Remove & Re-upload' : 'Delete File'}
                             </Button>
                          )}
                       </div>
                    ) : (
                       <div className="mt-auto z-10 relative h-full flex items-end">
                          <Label htmlFor={`upload-${assignment.id}-${slot}`} className="cursor-pointer w-full">
                             <div className="bg-white border-2 border-dashed border-muted-foreground/25 rounded-lg h-[80px] flex flex-col items-center justify-center hover:bg-[#4338CA]/5 hover:border-[#4338CA]/50 transition-colors">
                                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                                <span className="text-xs font-medium text-foreground">Click to Upload</span>
                                <span className="text-[10px] text-muted-foreground">PDF, Excel, CSV</span>
                             </div>
                          </Label>
                          <input 
                             id={`upload-${assignment.id}-${slot}`} 
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

            <div className="ml-11 mt-4">
               <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-dashed" 
                  onClick={handleAddSlot}
               >
                  <Plus className="h-4 w-4 mr-2" />
                  Add more upload box
               </Button>
            </div>
         </div>

         <Separator />

         {/* 4. CHECK OUT */}
         <div className={`space-y-4 ${!canCheckOut && !isCheckedOut ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3 font-semibold text-lg">
               <div className="h-8 w-8 rounded-full bg-[#4338CA]/10 text-[#4338CA] flex items-center justify-center text-sm font-bold">4</div>
               Final Check Out
            </div>
            <div className="ml-11">
               {isCheckedOut ? (
                  <Alert className="mb-4 bg-blue-50 text-blue-800 border-blue-200 max-w-md">
                     <CheckCircle className="h-4 w-4 text-blue-600"/>
                     <AlertTitle>Check Out Submitted</AlertTitle>
                     <AlertDescription>You have successfully checked out. The admin will now review your reports, process your payment, and finalize the audit.</AlertDescription>
                  </Alert>
               ) : !canCheckOut ? (
                  <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground mb-4 border max-w-md">
                     <strong>Action Locked.</strong> You must complete the following before checking out:
                     <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Upload Check-in photo <span className={trackingData?.check_in?.status === 'approved' ? "text-green-600" : ""}>({trackingData?.check_in?.status === 'approved' ? "Approved" : "Pending Admin Approval"})</span></li>
                        <li>Confirm Start <span className={isStarted ? "text-green-600" : ""}>({isStarted ? "Done" : "Pending"})</span></li>
                        <li>Upload at least 1 Report <span className={allReportsApproved ? "text-green-600" : ""}>({allReportsApproved ? "Approved" : "Pending Admin Approval"})</span></li>
                     </ul>
                  </div>
               ) : (
                  <Alert className="mb-4 bg-amber-50 text-amber-800 border-amber-200 max-w-md">
                     <AlertCircle className="h-4 w-4 text-amber-600"/>
                     <AlertTitle>Ready to Submit</AlertTitle>
                     <AlertDescription>All files are approved. Submit your check out to allow the admin to process your payment.</AlertDescription>
                  </Alert>
               )}
               
               {!isCheckedOut && (
                  <Button 
                     size="lg" 
                     className="w-full sm:w-auto bg-[#4338CA] hover:bg-[#4338CA]/90 font-bold" 
                     disabled={!canCheckOut} 
                     onClick={handleCheckOut}
                  >
                     Submit Check Out
                  </Button>
               )}
            </div>
         </div>

      </CardContent>
    </Card>
  );
}

// --- MAIN MY ASSIGNMENTS PAGE ---
export default function MyAssignments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all assignments allotted to this auditor
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['auditor-my-assignments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('allotted_to', user?.id)
        .order('audit_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const handleRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ['auditor-my-assignments'] });
  };

  // --- Date Categorization ---
  const todayStr = new Date().toLocaleDateString('en-CA'); 

  // Jobs that are allotted or in progress, and their date is today or in the past
  const liveAssignments = assignments.filter(a => 
    ['allotted', 'in_progress'].includes(a.status) && 
    a.audit_date <= todayStr
  );
  
  const upcomingAssignments = assignments.filter(a => 
    a.audit_date > todayStr && 
    !['completed', 'incomplete'].includes(a.status)
  );
  
  const pastCompletedAssignments = assignments.filter(a => 
    ['completed', 'incomplete'].includes(a.status)
  );

  if (isLoading) {
    return (
      <DashboardLayout title="My Assignments" navItems={auditorNavItems} activeTab="my-jobs">
        <div className="flex items-center justify-center py-20 text-muted-foreground animate-pulse">Loading assignments...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Assignments" navItems={auditorNavItems} activeTab="my-jobs">
      <div className="max-w-6xl mx-auto py-6 space-y-8">
        
        {/* --- SECTION 1: TODAY'S LIVE AUDITS --- */}
        {liveAssignments.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-[#4338CA]">
              <span className="relative flex h-3 w-3 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4338CA] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4338CA]"></span>
              </span>
              Live Audits
            </h2>
            
            <div className="grid gap-6">
              {liveAssignments.map((job) => (
                <LiveAssignmentCard 
                  key={job.id} 
                  assignment={job} 
                  user={user} 
                  onUpdate={handleRefetch} 
                />
              ))}
            </div>
          </div>
        )}

        {/* --- SECTION 2: THE REGULAR LISTS --- */}
        <div className="space-y-4 pt-4">
          <h2 className="text-2xl font-bold tracking-tight">Assignment Directory</h2>
          
          <Tabs defaultValue="upcoming" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="upcoming">Upcoming ({upcomingAssignments.length})</TabsTrigger>
              <TabsTrigger value="past">Completed / Past ({pastCompletedAssignments.length})</TabsTrigger>
            </TabsList>

            {/* Upcoming Tab */}
            <TabsContent value="upcoming" className="mt-6">
              {upcomingAssignments.length === 0 ? (
                <div className="text-center py-12 border rounded-xl bg-muted/10 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  No upcoming assignments. Check your dashboard to apply for jobs!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingAssignments.map(job => (
                    <Card key={job.id} className="hover:border-[#4338CA]/50 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{job.client_name}</CardTitle>
                            <CardDescription>{job.branch_name}</CardDescription>
                          </div>
                          <Badge variant="outline">{job.audit_type}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2 space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 shrink-0" /> <span className="truncate">{job.city}, {job.state}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4 shrink-0" /> 
                          <span className="font-medium text-foreground">Scheduled: {new Date(job.audit_date).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                      <CardFooter className="bg-muted/10 pt-4 mt-4 border-t flex justify-between">
                         <span className="text-sm font-semibold text-gray-600">Fees: ₹{job.fees}</span>
                         <span className="text-xs text-muted-foreground">Live Actions unlock on {new Date(job.audit_date).toLocaleDateString()}</span>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Past/Completed Tab */}
            <TabsContent value="past" className="mt-6">
              {pastCompletedAssignments.length === 0 ? (
                <div className="text-center py-12 border rounded-xl bg-muted/10 text-muted-foreground">
                  No past or completed assignments found.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pastCompletedAssignments.map(job => (
                    <Card key={job.id} className="opacity-80">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{job.client_name}</CardTitle>
                            <CardDescription>{job.branch_name}</CardDescription>
                          </div>
                          <Badge variant={job.completion_status === 'completed' ? 'default' : 'secondary'} className={job.completion_status === 'completed' ? 'bg-green-600 hover:bg-green-600' : ''}>
                            {job.completion_status === 'completed' ? 'Completed' : 'Missed / Past'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" /> Date: {new Date(job.audit_date).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}