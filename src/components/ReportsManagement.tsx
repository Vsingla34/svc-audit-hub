import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Eye, FileText, CheckCircle, XCircle, Clock, RefreshCcw, Star, Check, FileCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReportsManagement() {
  const [activeAudits, setActiveAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Reject Dialog
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [targetItem, setTargetItem] = useState<{ type: 'check_in' | 'report', assignmentId: string, reportId?: string } | null>(null);

  // Complete Audit & Payment Dialog
  const [completeDialog, setCompleteDialog] = useState(false);
  const [completeData, setCompleteData] = useState<{ id: string, fees: number, totalFees: number }>({ id: '', fees: 0, totalFees: 0 });
  const [rating, setRating] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState<number | string>('');

  useEffect(() => {
    fetchActiveAudits();
  }, []);

  const fetchActiveAudits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("assignments")
        .select(`*, auditor:profiles!assignments_allotted_to_fkey(full_name, email)`)
        .in('status', ['allotted', 'in_progress'])
        .not('tracking_details', 'is', null)
        .order("audit_date", { ascending: false });

      if (error) throw error;
      setActiveAudits(data || []);
    } catch (err: any) {
      toast.error("Failed to load live reports: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewFile = async (path: string) => {
    if (!path) return;
    try {
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(path, 3600);

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
       setActiveAudits(prev => prev.map(a => 
         a.id === assignmentId ? { ...a, tracking_details: updatedTracking } : a
       ));
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

  const openCompleteDialog = (audit: any) => {
    // Calculate total possible amount including base fees + all perks/reimbursements
    const baseFees = audit.fees || 0;
    const totalFees = baseFees + (audit.ope || 0) + (audit.reimbursement_food || 0) + (audit.reimbursement_courier || 0) + (audit.reimbursement_conveyance || 0);
    
    setCompleteData({ id: audit.id, fees: baseFees, totalFees: totalFees });
    
    // Set the default payment input to the max total (the admin can adjust it down if actuals were lower)
    setPaymentAmount(totalFees);
    setRating(0);
    setCompleteDialog(true);
  };

  const handleConfirmCompleteAudit = async () => {
    if (!rating) {
      toast.error("Please provide a rating for the auditor.");
      return;
    }
    if (paymentAmount === '' || Number(paymentAmount) < 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    const assignment = activeAudits.find(a => a.id === completeData.id);
    if (!assignment) return;

    // Attach payment and invoice details to tracking_details
    const updatedTracking = {
      ...assignment.tracking_details,
      payment_info: {
        amount: Number(paymentAmount),
        status: 'invoice_generated',
        generated_at: new Date().toISOString()
      }
    };

    try {
      // 1. Mark Assignment as Completed and Save the Individual Rating
      const { error: updateError } = await supabase
        .from('assignments')
        .update({
          status: 'completed',
          auditor_rating: rating,
          completed_at: new Date().toISOString(),
          tracking_details: updatedTracking
        })
        .eq('id', completeData.id);

      if (updateError) throw updateError;

      // 2. Calculate the New Average Rating for this Auditor
      if (assignment.allotted_to) {
        const { data: ratedAssignments, error: fetchError } = await supabase
          .from('assignments')
          .select('auditor_rating')
          .eq('allotted_to', assignment.allotted_to)
          .not('auditor_rating', 'is', null);

        if (!fetchError && ratedAssignments && ratedAssignments.length > 0) {
          const totalScore = ratedAssignments.reduce((sum, curr) => sum + Number(curr.auditor_rating), 0);
          const averageScore = Number((totalScore / ratedAssignments.length).toFixed(1));

          // 3. Save the Average Rating to the User's Profile table
          const { error: profileError } = await supabase
            .from('auditor_profiles')
            .update({ rating: averageScore })
            .eq('user_id', assignment.allotted_to);
            
          // Smart Fallback: If 'rating' column was created on the main 'profiles' table instead
          if (profileError) {
             console.warn("Saving to auditor_profiles failed, attempting to save to profiles table...", profileError);
             await supabase
                .from('profiles')
                .update({ rating: averageScore })
                .eq('id', assignment.allotted_to);
          }
        }
      }

      toast.success("Audit completed! Rating and invoice processed successfully.");
      setActiveAudits(prev => prev.filter(a => a.id !== completeData.id));
      setCompleteDialog(false);
      
    } catch (error: any) {
      toast.error("Failed to complete audit: " + error.message);
    }
  };

  const getSlotLabel = (slot: number, index: number) => {
    if (slot === 1) return "Main report file";
    if (slot === 2) return "Supporting file";
    return `Supporting file ${index}`; 
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
               
               const hasReports = reports.length > 0;
               const allReportsApproved = hasReports && reports.every((r: any) => r.status === 'approved');
               const isCheckedOut = tracking?.check_out?.completed;

               const sortedReports = [...reports].sort((a: any, b: any) => a.slot - b.slot);

               return (
                  <Card key={audit.id} className="overflow-hidden border-l-4 border-l-primary shadow-sm">
                     <CardHeader className="bg-muted/10 pb-4">
                        <div className="flex justify-between items-start">
                           <div>
                              <CardTitle>{audit.client_name}</CardTitle>
                              <CardDescription className="flex items-center gap-2 mt-1">
                                <span>Auditor: {audit.auditor?.full_name}</span>
                                <span>•</span>
                                <span>{audit.city}, {audit.state}</span>
                              </CardDescription>
                           </div>
                           <Badge variant="outline" className={tracking.is_started ? "bg-green-100 text-green-700 font-bold" : ""}>
                              {tracking.is_started ? "IN PROGRESS" : "NOT STARTED"}
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
                                          <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => updateStatus(audit.id, 'check_in', 'approved')}><CheckCircle className="h-5 w-5" /></Button>
                                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => openRejectDialog(audit.id, 'check_in')}><XCircle className="h-5 w-5" /></Button>
                                       </div>
                                    )}
                                 </TableCell>
                              </TableRow>

                              {/* REPORTS ROWS */}
                              {sortedReports.length > 0 ? (
                                 sortedReports.map((report: any, index: number) => (
                                    <TableRow key={report.id}>
                                       <TableCell className="font-medium">{getSlotLabel(report.slot, index + 1)}</TableCell>
                                       <TableCell>
                                          <div className="flex flex-col items-start">
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
                                                <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => updateStatus(audit.id, 'report', 'approved', undefined, report.id)}><CheckCircle className="h-5 w-5" /></Button>
                                                <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => openRejectDialog(audit.id, 'report', report.id)}><XCircle className="h-5 w-5" /></Button>
                                             </div>
                                          )}
                                       </TableCell>
                                    </TableRow>
                                 ))
                              ) : (
                                 <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-4">No report files uploaded yet.</TableCell></TableRow>
                              )}
                              
                              {/* CHECK OUT STATUS */}
                              <TableRow className="bg-muted/5">
                                 <TableCell className="font-medium">Auditor Status</TableCell>
                                 <TableCell colSpan={2}>
                                    {isCheckedOut ? (
                                       <div className="flex items-center text-green-600 font-medium">
                                          <CheckCircle className="h-4 w-4 mr-2" /> Auditor requested Check Out at {new Date(tracking.check_out.timestamp).toLocaleTimeString()}
                                       </div>
                                    ) : (
                                       <span className="text-muted-foreground">Waiting for auditor to check out</span>
                                    )}
                                 </TableCell>
                                 <TableCell></TableCell>
                              </TableRow>
                           </TableBody>
                        </Table>
                     </CardContent>

                     {/* FINALIZATION FOOTER */}
                     <CardFooter className={`border-t p-4 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors ${allReportsApproved && isCheckedOut ? "bg-blue-50/50" : "bg-muted/10"}`}>
                        <div className="text-sm font-medium flex items-center gap-2">
                           {allReportsApproved && isCheckedOut ? (
                              <span className="text-blue-700 flex items-center">
                                 <CheckCircle className="h-4 w-4 mr-2" />
                                 Auditor is checked out and reports are approved.
                              </span>
                           ) : (
                              <span className="text-muted-foreground flex items-center">
                                 <Clock className="h-4 w-4 mr-2" />
                                 Approve all reports & wait for check out to finalize.
                              </span>
                           )}
                        </div>

                        {allReportsApproved && isCheckedOut && (
                           <Button 
                              onClick={() => openCompleteDialog(audit)}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                           >
                              <FileCheck className="h-4 w-4 mr-2" /> Finalize & Generate Invoice
                           </Button>
                        )}
                     </CardFooter>
                  </Card>
               );
            })}
         </div>
      )}

      {/* Reject File Dialog */}
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

      {/* Complete Audit & Payment Dialog */}
      <Dialog open={completeDialog} onOpenChange={setCompleteDialog}>
         <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
               <DialogTitle>Finalize Audit & Invoice</DialogTitle>
               <DialogDescription>
                  Rate the auditor and confirm the final payment amount. This will close the audit and generate an invoice.
               </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
               <div className="space-y-2">
                  <Label>Rate Auditor Performance</Label>
                  <div className="flex gap-1 pt-1">
                     {[1, 2, 3, 4, 5].map((star) => (
                        <button
                           key={star}
                           onClick={() => setRating(star)}
                           className="focus:outline-none transition-transform hover:scale-110"
                        >
                           <Star 
                              className={`h-8 w-8 ${
                                 star <= rating 
                                    ? "fill-yellow-400 text-yellow-400" 
                                    : "fill-transparent text-gray-300 hover:text-yellow-200"
                              }`} 
                           />
                        </button>
                     ))}
                  </div>
               </div>
               
               <div className="space-y-2">
                  <Label htmlFor="payment">Final Payment Amount (₹)</Label>
                  <Input 
                     id="payment" 
                     type="number" 
                     placeholder="e.g. 5000"
                     value={paymentAmount} 
                     onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                  {/* Detailed breakdown for Admin's context */}
                  <p className="text-xs text-muted-foreground mt-1">
                     Original base fees: ₹{completeData.fees.toLocaleString()} <br/>
                     Max including allowances: ₹{completeData.totalFees.toLocaleString()}
                  </p>
               </div>
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setCompleteDialog(false)}>Cancel</Button>
               <Button onClick={handleConfirmCompleteAudit} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Confirm & Generate Invoice
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}