import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/StatusBadge';
import { FileText, DollarSign, Clock, CheckCircle, Wallet, Receipt, AlertCircle, IndianRupee } from 'lucide-react';
import { DashboardLayout, adminNavItems, auditorNavItems } from '@/components/DashboardLayout';

export default function PaymentsDashboard() {
  const { user, userRole } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog States
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; invoice: any }>({ open: false, invoice: null });
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    paid: 0,
    totalAmount: 0,
  });

  useEffect(() => {
    fetchData();
  }, [user, userRole]);

  const fetchData = async () => {
    try {
      let invoicesQuery = supabase
        .from('invoices')
        .select(`
          *,
          assignment:assignments(client_name, branch_name, fees, ope),
          auditor:profiles(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (userRole === 'auditor') {
        invoicesQuery = invoicesQuery.eq('auditor_id', user?.id);
      }

      const { data: invoicesData, error: invoicesError } = await invoicesQuery;
      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);

      const total = invoicesData?.length || 0;
      const pending = invoicesData?.filter(i => i.payment_status === 'pending' || i.payment_status === 'processing').length || 0;
      const paid = invoicesData?.filter(i => i.payment_status === 'paid').length || 0;
      const totalAmount = invoicesData?.reduce((sum, i) => sum + Number(i.net_payable), 0) || 0;
      setStats({ total, pending, paid, totalAmount });

      if (userRole === 'auditor') {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('assignments')
          .select('*')
          .eq('allotted_to', user?.id)
          .eq('status', 'completed');

        if (assignmentsError) throw assignmentsError;

        const invoiceAssignmentIds = invoicesData?.map(i => i.assignment_id) || [];
        const availableAssignments = assignmentsData?.filter(
          a => !invoiceAssignmentIds.includes(a.id)
        ) || [];
        
        setAssignments(availableAssignments);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateInvoiceNumber = () => {
    const timestamp = Date.now();
    return `INV-${timestamp}`;
  };

  const calculateTDS = (amount: number, tdsRate: number) => {
    return (amount * tdsRate) / 100;
  };

  const handleCreateInvoice = async (assignment: any) => {
    try {
      const totalAmount = parseFloat(assignment.fees) + parseFloat(assignment.ope || 0);
      const tdsRate = 10;
      const tdsAmount = calculateTDS(totalAmount, tdsRate);
      const netPayable = totalAmount - tdsAmount;

      const { error } = await supabase.from('invoices').insert({
        assignment_id: assignment.id,
        auditor_id: user?.id,
        invoice_number: generateInvoiceNumber(),
        base_amount: parseFloat(assignment.fees),
        ope_amount: parseFloat(assignment.ope || 0),
        total_amount: totalAmount,
        tds_rate: tdsRate,
        tds_amount: tdsAmount,
        net_payable: netPayable,
      });

      if (error) throw error;

      toast.success('Invoice generated successfully!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUpdatePayment = async () => {
    if (!paymentDialog.invoice?.id || !paymentStatus) return;
    
    try {
      const updateData: any = { 
        payment_status: paymentStatus,
        payment_reference: paymentRef || null,
        payment_remarks: paymentRemarks || null 
      };
      
      if (paymentStatus === 'paid') {
        updateData.payment_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', paymentDialog.invoice.id);

      if (error) throw error;

      // Only attempt to invoke function if the edge function exists
      try {
        await supabase.functions.invoke('send-payment-notification', {
          body: {
            to: paymentDialog.invoice.auditor?.email,
            auditorName: paymentDialog.invoice.auditor?.full_name,
            invoiceNumber: paymentDialog.invoice.invoice_number,
            amount: paymentDialog.invoice.net_payable,
            status: paymentStatus,
            paymentDate: updateData.payment_date,
          },
        });
      } catch (funcError) {
        console.warn('Notification function bypassed.', funcError);
      }

      toast.success(`Payment status updated to ${paymentStatus}`);
      setPaymentDialog({ open: false, invoice: null });
      setPaymentStatus('');
      setPaymentRef('');
      setPaymentRemarks('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const navItems = userRole === 'admin' ? adminNavItems : auditorNavItems;

  if (loading) {
    return (
      <DashboardLayout title="Payments & Invoices" navItems={navItems} activeTab="payments">
        <div className="flex items-center justify-center h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  // ==========================================
  // AUDITOR VIEW
  // ==========================================
  if (userRole === 'auditor') {
    return (
      <DashboardLayout title="My Earnings" navItems={navItems} activeTab="payments">
        <div className="space-y-8 max-w-7xl mx-auto">
          
          {/* Auditor Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-primary/80 font-medium">Total Billed</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2 text-primary">
                  <Wallet className="h-6 w-6" />
                  ₹ {stats.totalAmount.toLocaleString('en-IN')}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Clearance</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <Clock className="h-6 w-6 text-amber-500" />
                  {stats.pending} Invoices
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Successfully Paid</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  {stats.paid} Invoices
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Pending Invoices to Generate */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Available for Invoicing</h2>
              <p className="text-sm text-muted-foreground">Completed assignments that are ready to be billed.</p>
            </div>
            
            {assignments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignments.map((assignment) => {
                  const total = parseFloat(assignment.fees) + parseFloat(assignment.ope || 0);
                  const net = total - calculateTDS(total, 10);
                  return (
                    <Card key={assignment.id} className="border-primary/20 shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{assignment.client_name}</CardTitle>
                        <CardDescription>{assignment.branch_name}</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Base Fee:</span>
                          <span>₹ {Number(assignment.fees).toLocaleString('en-IN')}</span>
                        </div>
                        {assignment.ope > 0 && (
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">OPE:</span>
                            <span>₹ {Number(assignment.ope).toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-semibold text-primary pt-2 border-t mt-2">
                          <span>Est. Net Payable:</span>
                          <span>₹ {net.toLocaleString('en-IN')}</span>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button className="w-full" onClick={() => handleCreateInvoice(assignment)}>
                          <Receipt className="h-4 w-4 mr-2" /> Generate Invoice
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-medium">All caught up!</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    You have no pending assignments to invoice. Complete more audits to generate new invoices.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Auditor Invoice History */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">TDS (10%)</TableHead>
                      <TableHead className="text-right font-bold">Net</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No invoices generated yet.</TableCell></TableRow>
                    )}
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                        <TableCell>
                          <div className="font-medium truncate max-w-[200px]">{invoice.assignment?.client_name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{invoice.assignment?.branch_name}</div>
                        </TableCell>
                        <TableCell className="text-sm">{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-IN') : 'N/A'}</TableCell>
                        <TableCell className="text-right text-sm">₹ {Number(invoice.total_amount).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-sm text-red-500">-₹ {Number(invoice.tds_amount).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right font-bold text-primary">₹ {Number(invoice.net_payable).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status={invoice.payment_status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ==========================================
  // ADMIN VIEW
  // ==========================================
  return (
    <DashboardLayout title="Platform Finance" navItems={navItems} activeTab="payments">
      <div className="space-y-8 max-w-7xl mx-auto">
        
        {/* Admin Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Invoices</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-500" />
                {stats.total}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Payouts</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Clock className="h-6 w-6 text-amber-500" />
                {stats.pending}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Settled Payouts</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                {stats.paid}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardDescription className="text-primary-foreground/80">Total Value (Net)</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <IndianRupee className="h-6 w-6" />
                {Number(stats.totalAmount).toLocaleString('en-IN')}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Admin All Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Management</CardTitle>
            <CardDescription>Review and process payments for completed assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice / Date</TableHead>
                    <TableHead>Auditor</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead className="text-right">Net Payable</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No invoices found.</TableCell></TableRow>
                  )}
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div className="font-mono text-xs font-medium">{invoice.invoice_number}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-IN') : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{invoice.auditor?.full_name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{invoice.auditor?.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium truncate max-w-[200px]">{invoice.assignment?.client_name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{invoice.assignment?.branch_name}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-bold text-primary">₹ {Number(invoice.net_payable).toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-muted-foreground">TDS: ₹ {Number(invoice.tds_amount).toLocaleString('en-IN')}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={invoice.payment_status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.payment_status !== 'paid' ? (
                          <Button size="sm" onClick={() => {
                            setPaymentStatus(invoice.payment_status);
                            setPaymentDialog({ open: true, invoice });
                          }}>
                            Update
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled>Settled</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Payment Update Dialog */}
        <Dialog open={paymentDialog.open} onOpenChange={(open) => {
          if (!open) {
            setPaymentDialog({ open: false, invoice: null });
            setPaymentStatus('');
            setPaymentRef('');
            setPaymentRemarks('');
          }
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Update Payment Status</DialogTitle>
              <DialogDescription>
                Process payment for {paymentDialog.invoice?.auditor?.full_name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="bg-muted/50 p-3 rounded-md flex justify-between items-center border">
                <div>
                  <p className="text-xs text-muted-foreground">Invoice Number</p>
                  <p className="font-mono text-sm">{paymentDialog.invoice?.invoice_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Net Payable</p>
                  <p className="font-bold text-lg text-primary">
                    ₹ {Number(paymentDialog.invoice?.net_payable || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="paid">Mark as Paid</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentStatus === 'paid' && (
                <div className="grid gap-2 animate-in fade-in zoom-in duration-200">
                  <Label htmlFor="ref">Transaction Reference (UTR)</Label>
                  <Input 
                    id="ref" 
                    placeholder="e.g., UPI/2390192039..." 
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="remarks">Remarks (Optional)</Label>
                <Textarea 
                  id="remarks" 
                  placeholder="Add any internal notes or message to auditor..." 
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  className="resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDialog({ open: false, invoice: null })}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePayment} disabled={!paymentStatus}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}