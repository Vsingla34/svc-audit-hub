import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar, RefreshCcw, AlertCircle, Upload, FileText, FileSpreadsheet } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';
import { isToday, isPast } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function AuditorLiveReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [trackingData, setTrackingData] = useState<any>({});
  const [uploading, setUploading] = useState(false);

  // 1. Fetch from shared cache instantly
  const { data: assignments = [], isLoading, refetch } = useQuery({
    queryKey: ['auditor-assignments', user?.id],
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
    staleTime: 1000 * 60 * 5,
  });

  // 2. Find today's active assignment instantly using useMemo
  const activeReportAssignment = useMemo(() => {
    return assignments.find(a => 
      ['allotted', 'in_progress'].includes(a.status) && 
      (isToday(new Date(a.audit_date)) || isPast(new Date(a.audit_date)))
    );
  }, [assignments]);

  // 3. Sync tracking data to local state for instant UI updates
  useEffect(() => {
    if (activeReportAssignment) {
      setTrackingData(activeReportAssignment.tracking_details || {});
    }
  }, [activeReportAssignment]);

  const updateTrackingData = async (newData: any) => {
     if (!activeReportAssignment) return;
     const updated = { ...trackingData, ...newData };
     
     // Optimistic UI Update
     setTrackingData(updated);

     const { error } = await supabase
        .from('assignments')
        .update({ 
           tracking_details: updated,
           status: 'in_progress' // Set to in_progress once tracking starts
        })
        .eq('id', activeReportAssignment.id);
        
     if (error) { 
        toast.error("Failed to update report in database"); 
        // Revert on failure
        setTrackingData(activeReportAssignment.tracking_details || {});
     } else {
        // Invalidate cache in background to keep other pages synced
        queryClient.invalidateQueries({ queryKey: ['auditor-assignments', user?.id] });
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
        toast.success(`Report ${slot} uploaded!`);
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

  const handleCheckOut = async () => {
     if (!confirm("Are you sure you want to finish this assignment? The admin will review it and finalize your payment.")) return;
     
     const { error } = await supabase
        .from('assignments')
        .update({ 
           status: 'completed', 
           completed_at: new Date().toISOString(), 
           tracking_details: { ...trackingData, check_out: { completed: true, timestamp: new Date().toISOString() } } 
        })
        .eq('id', activeReportAssignment.id);
        
     if (error) {
         toast.error("Check out failed"); 
     } else { 
         toast.success("Assignment Completed! Awaiting Admin Review."); 
         queryClient.invalidateQueries({ queryKey: ['auditor-assignments', user?.id] });
     }
  };

  // Logic flags for UI state
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
        return <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#4338CA]" />;
     }
     return <FileText className="h-4 w-4 shrink-0 text-[#4338CA]" />;
  };

  if (isLoading) {
      return (
         <DashboardLayout title="Live Audit Report" navItems={auditorNavItems} activeTab="live-report">
            <div className="flex items-center justify-center py-20 text-muted-foreground animate-pulse">Loading active assignment...</div>
         </DashboardLayout>
      );
  }

  return (
    <DashboardLayout title="Live Audit Report" navItems={auditorNavItems} activeTab="live-report">
      <div className="space-y-6 max-w-5xl mx-auto py-6">
         {!activeReportAssignment ? (
            <Card className="border-dashed shadow-none bg-muted/10">
               <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-4">
                  <Calendar className="h-16 w-16 opacity-20" />
                  <div className="text-center max-w-md">
                     <h3 className="text-xl font-semibold text-foreground mb-2">No Active Audit Today</h3>
                     <p>You have no scheduled assignments that need tracking today. Assignments will appear here automatically on their scheduled audit date.</p>
                  </div>
                  <Button variant="outline" className="mt-4" onClick={() => navigate('/auditor/assignments')}>View My Assignments</Button>
               </CardContent>
            </Card>
         ) : (
            <div className="grid gap-6">
               <Card className="border-l-4 border-l-[#4338CA] shadow-md">
                  <CardHeader className="bg-muted/5 border-b">
                     <div className="flex justify-between items-start">
                        <div>
                           <Badge variant="outline" className="mb-3 bg-white border-[#4338CA]/30 text-[#4338CA] font-bold tracking-wider">
                             LIVE AUDIT TRACKING
                           </Badge>
                           <CardTitle className="text-2xl">{activeReportAssignment.client_name}</CardTitle>
                           <CardDescription className="text-base mt-1">
                              {activeReportAssignment.branch_name} • {activeReportAssignment.city}, {activeReportAssignment.state}
                           </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => refetch()} title="Refresh Data">
                           <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}/> Refresh
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
                                       <Label htmlFor="reupload-checkin" className="cursor-pointer bg-destructive/10 text-destructive px-3 py-1.5 rounded text-sm hover:bg-destructive/20 font-medium">
                                          Select New Image
                                       </Label>
                                       <input id="reupload-checkin" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleCheckInUpload(e.target.files[0])} className="hidden" disabled={uploading} />
                                       {uploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading...</span>}
                                    </div>
                                 </div>
                              )}
                           </div>
                        ) : (
                           <div className="ml-11 max-w-md">
                              <Label className="text-muted-foreground mb-2 block">Take a selfie at the client location to begin the audit process.</Label>
                              <div className="mt-3">
                                 <Label htmlFor="upload-checkin" className="cursor-pointer bg-white border-2 border-dashed border-[#4338CA]/30 text-[#4338CA] px-4 py-8 rounded-xl flex flex-col items-center justify-center hover:bg-[#4338CA]/5 transition-colors">
                                    <Upload className="h-6 w-6 mb-2" />
                                    <span className="font-medium">Upload Photo</span>
                                 </Label>
                                 <input id="upload-checkin" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleCheckInUpload(e.target.files[0])} disabled={uploading} className="hidden"/>
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
                                 <RadioGroupItem value="yes" id="r-yes" />
                                 <Label htmlFor="r-yes" className="font-medium text-base cursor-pointer">Yes, I am on-site and starting the audit now</Label>
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
                          {[1, 2, 3, 4].map((slot) => {
                            const report = getReportBySlot(slot);
                            
                            return (
                              <div key={slot} className="border rounded-xl p-4 bg-muted/5 flex flex-col gap-3 min-h-[140px] relative overflow-hidden">
                                <div className="flex justify-between items-center z-10 relative">
                                   <span className="font-semibold text-sm">Report Slot {slotLabels[slot-1]}</span>
                                   {report && (
                                      <Badge variant={report.status === 'approved' ? 'default' : report.status === 'rejected' ? 'destructive' : 'secondary'} className={report.status === 'approved' ? 'bg-green-600' : ''}>
                                         {report.status}
                                      </Badge>
                                   )}
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
                                      <Label htmlFor={`upload-${slot}`} className="cursor-pointer w-full">
                                         <div className="bg-white border-2 border-dashed border-muted-foreground/25 rounded-lg h-[80px] flex flex-col items-center justify-center hover:bg-[#4338CA]/5 hover:border-[#4338CA]/50 transition-colors">
                                            <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                                            <span className="text-xs font-medium text-foreground">Click to Upload</span>
                                            <span className="text-[10px] text-muted-foreground">PDF, Excel, CSV</span>
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
                     <div className={`space-y-4 ${!canCheckOut ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-3 font-semibold text-lg">
                           <div className="h-8 w-8 rounded-full bg-[#4338CA]/10 text-[#4338CA] flex items-center justify-center text-sm font-bold">4</div>
                           Final Check Out
                        </div>
                        <div className="ml-11">
                           {!canCheckOut ? (
                              <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground mb-4 border max-w-md">
                                 <strong>Action Locked.</strong> You must complete the following before checking out:
                                 <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li>Upload Check-in photo <span className={trackingData?.check_in?.status === 'approved' ? "text-green-600" : ""}>({trackingData?.check_in?.status === 'approved' ? "Approved" : "Pending Admin Approval"})</span></li>
                                    <li>Confirm Start <span className={isStarted ? "text-green-600" : ""}>({isStarted ? "Done" : "Pending"})</span></li>
                                    <li>Upload at least 1 Report <span className={allReportsApproved ? "text-green-600" : ""}>({allReportsApproved ? "Approved" : "Pending Admin Approval"})</span></li>
                                 </ul>
                              </div>
                           ) : (
                              <Alert className="mb-4 bg-green-50 text-green-800 border-green-200 max-w-md">
                                 <CheckCircle className="h-4 w-4 text-green-600"/>
                                 <AlertTitle>Ready for Check Out</AlertTitle>
                                 <AlertDescription>All steps have been completed and approved by the admin. You may now check out to finalize this audit.</AlertDescription>
                              </Alert>
                           )}
                           
                           <Button 
                              size="lg" 
                              className="w-full sm:w-auto bg-[#4338CA] hover:bg-[#4338CA]/90 font-bold" 
                              disabled={!canCheckOut} 
                              onClick={handleCheckOut}
                           >
                              Complete Audit & Check Out
                           </Button>
                        </div>
                     </div>

                  </CardContent>
               </Card>
            </div>
         )}
      </div>
    </DashboardLayout>
  );
}