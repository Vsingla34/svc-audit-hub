import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, FileText, CheckCircle, XCircle, Clock, RefreshCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ReportsManagement() {
  const [activeAudits, setActiveAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog States
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [targetItem, setTargetItem] = useState<{ type: 'check_in' | 'report', assignmentId: string, reportId?: string } | null>(null);

  useEffect(() => {
    fetchActiveAudits();
  }, []);

  const fetchActiveAudits = async () => {
    setLoading(true);
    try {
      // Explicitly select the correct foreign key relationship for 'auditor'
      const { data, error } = await supabase
        .from("assignments")
        .select(`*, auditor:profiles!assignments_allotted_to_fkey(full_name, email)`)
        .in('status', ['allotted', 'in_progress'])
        .not('tracking_details', 'is', null)
        .order("audit_date", { ascending: false });

      if (error) throw error;
      setActiveAudits(data || []);
    } catch (err: any) {
      console.error("Error:", err);
      toast.error("Failed to load live reports: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: Handle File Viewing via Signed URL ---
  const handleViewFile = async (path: string) => {
    if (!path) return;
    try {
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(path, 3600); // Valid for 1 hour

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        toast.error("Could not generate secure link");
      }
    } catch (error: any) {
      toast.error("Error opening file: " + error.message);
    }
  };
  // ----------------------------------------------

  const updateStatus = async (assignmentId: string, type: 'check_in' | 'report', status: 'approved' | 'rejected', reason?: string, reportId?: string) => {
    const assignment = activeAudits.find(a => a.id === assignmentId);
    if (!assignment) return;

    let updatedTracking = { ...assignment.tracking_details };

    if (type === 'check_in') {
       updatedTracking.check_in = { 
          ...updatedTracking.check_in, 
          status, 
          feedback: reason || "" 
       };
    } else if (type === 'report' && reportId) {
       updatedTracking.reports = updatedTracking.reports.map((r: any) => 
          r.id === reportId ? { ...r, status, feedback: reason || "" } : r
       );
    }

    const { error } = await supabase
       .from('assignments')
       .update({ tracking_details: updatedTracking })
       .eq('id', assignmentId);

    if (error) {
       toast.error("Update failed");
    } else {
       toast.success(`Marked as ${status}`);
       fetchActiveAudits();
       setRejectDialog(false);
       setRejectReason("");
       setTargetItem(null);
    }
  };

  const openRejectDialog = (assignmentId: string, type: 'check_in' | 'report', reportId?: string) => {
     setTargetItem({ assignmentId, type, reportId });
     setRejectReason("");
     setRejectDialog(true);
  };

  const handleConfirmReject = () => {
     if (!targetItem) return;
     updateStatus(targetItem.assignmentId, targetItem.type, 'rejected', rejectReason, targetItem.reportId);
  };

  if (loading) return <div>Loading live activity...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h2 className="text-xl font-bold">Live Audit Tracking</h2>
         <Button size="sm" variant="outline" onClick={fetchActiveAudits}><RefreshCcw className="h-4 w-4 mr-2"/> Refresh</Button>
      </div>

      {activeAudits.length === 0 ? (
         <Card><CardContent className="py-8 text-center text-muted-foreground">No active live reports found.</CardContent></Card>
      ) : (
         <div className="grid gap-6">
            {activeAudits.map(audit => {
               const tracking = audit.tracking_details || {};
               const reports = tracking.reports || [];

               return (
                  <Card key={audit.id} className="overflow-hidden">
                     <CardHeader className="bg-muted/10 pb-4">
                        <div className="flex justify-between">
                           <div>
                              <CardTitle>{audit.client_name}</CardTitle>
                              <CardDescription>Auditor: {audit.auditor?.full_name}</CardDescription>
                           </div>
                           <Badge variant="outline" className={tracking.is_started ? "bg-green-100 text-green-700" : ""}>
                              {tracking.is_started ? "STARTED" : "NOT STARTED"}
                           </Badge>
                        </div>
                     </CardHeader>
                     <CardContent className="p-0">
                        <Table>
                           <TableHeader>
                              <TableRow>
                                 <TableHead>Step</TableHead>
                                 <TableHead>Content</TableHead>
                                 <TableHead>Status</TableHead>
                                 <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {/* CHECK IN ROW */}
                              <TableRow>
                                 <TableCell className="font-medium">Check In</TableCell>
                                 <TableCell>
                                    {tracking.check_in?.url ? (
                                       // UPDATED: Use handleViewFile instead of direct href
                                       <Button 
                                          variant="link" 
                                          className="p-0 h-auto text-blue-600 flex items-center gap-1 hover:underline"
                                          onClick={() => handleViewFile(tracking.check_in.url)}
                                       >
                                          <Eye className="h-4 w-4" /> View Image
                                       </Button>
                                    ) : <span className="text-muted-foreground">Not uploaded</span>}
                                 </TableCell>
                                 <TableCell>
                                    <Badge variant={tracking.check_in?.status === 'approved' ? 'default' : tracking.check_in?.status === 'rejected' ? 'destructive' : 'secondary'}>
                                       {tracking.check_in?.status || 'Pending'}
                                    </Badge>
                                 </TableCell>
                                 <TableCell className="text-right">
                                    {tracking.check_in?.status === 'pending' && (
                                       <div className="flex justify-end gap-2">
                                          <Button size="sm" variant="ghost" className="text-green-600" onClick={() => updateStatus(audit.id, 'check_in', 'approved')}><CheckCircle className="h-5 w-5" /></Button>
                                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => openRejectDialog(audit.id, 'check_in')}><XCircle className="h-5 w-5" /></Button>
                                       </div>
                                    )}
                                 </TableCell>
                              </TableRow>

                              {/* REPORTS ROWS */}
                              {reports.length > 0 ? (
                                 reports.map((report: any) => (
                                    <TableRow key={report.id}>
                                       <TableCell className="font-medium">Report File</TableCell>
                                       <TableCell>
                                          <div className="flex flex-col items-start">
                                             {/* UPDATED: Use handleViewFile */}
                                             <Button 
                                                variant="link" 
                                                className="p-0 h-auto text-blue-600 flex items-center gap-1 hover:underline"
                                                onClick={() => handleViewFile(report.url)}
                                             >
                                                <FileText className="h-4 w-4" /> {report.name}
                                             </Button>
                                             {report.feedback && <span className="text-xs text-red-500 mt-1">{report.feedback}</span>}
                                          </div>
                                       </TableCell>
                                       <TableCell>
                                          <Badge variant={report.status === 'approved' ? 'default' : report.status === 'rejected' ? 'destructive' : 'secondary'}>
                                             {report.status}
                                          </Badge>
                                       </TableCell>
                                       <TableCell className="text-right">
                                          {report.status === 'pending' && (
                                             <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="ghost" className="text-green-600" onClick={() => updateStatus(audit.id, 'report', 'approved', undefined, report.id)}><CheckCircle className="h-5 w-5" /></Button>
                                                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => openRejectDialog(audit.id, 'report', report.id)}><XCircle className="h-5 w-5" /></Button>
                                             </div>
                                          )}
                                       </TableCell>
                                    </TableRow>
                                 ))
                              ) : (
                                 <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-xs">No report files uploaded yet.</TableCell></TableRow>
                              )}
                              
                              {/* CHECK OUT STATUS */}
                              <TableRow className="bg-muted/5">
                                 <TableCell className="font-medium">Check Out</TableCell>
                                 <TableCell colSpan={2}>
                                    {tracking.check_out?.completed ? (
                                       <div className="flex items-center text-green-600 font-medium">
                                          <CheckCircle className="h-4 w-4 mr-2" /> Completed at {new Date(tracking.check_out.timestamp).toLocaleTimeString()}
                                       </div>
                                    ) : "Pending completion"}
                                 </TableCell>
                                 <TableCell></TableCell>
                              </TableRow>
                           </TableBody>
                        </Table>
                     </CardContent>
                  </Card>
               );
            })}
         </div>
      )}

      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
         <DialogContent>
            <DialogHeader><DialogTitle>Reject Item</DialogTitle></DialogHeader>
            <div className="space-y-4">
               <p className="text-sm text-muted-foreground">Please provide a reason for rejection. The auditor will see this and be asked to re-upload.</p>
               <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g., Image is blurry, Wrong file format..." />
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
               <Button variant="destructive" onClick={handleConfirmReject} disabled={!rejectReason.trim()}>Reject</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}