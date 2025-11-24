import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowLeft, FileText, DollarSign, Clock, CheckCircle } from 'lucide-react';

export default function PaymentsDashboard() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; invoice: any }>({
    open: false,
    invoice: null,
  });

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

      // Calculate stats
      const total = invoicesData?.length || 0;
      const pending = invoicesData?.filter(i => i.payment_status === 'pending').length || 0;
      const paid = invoicesData?.filter(i => i.payment_status === 'paid').length || 0;
      const totalAmount = invoicesData?.reduce((sum, i) => sum + Number(i.net_payable), 0) || 0;
      setStats({ total, pending, paid, totalAmount });

      // Fetch completed assignments without invoices (for auditors)
      if (userRole === 'auditor') {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('assignments')
          .select('*')
          .eq('allotted_to', user?.id)
          .eq('status', 'completed');

        if (assignmentsError) throw assignmentsError;

        // Filter out assignments that already have invoices
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
      const tdsRate = 10; // Default TDS rate
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

      toast.success('Invoice created successfully!');
      setShowCreateDialog(false);
      setSelectedAssignment(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUpdatePayment = async (invoiceId: string, status: string, reference?: string, remarks?: string) => {
    try {
      const updateData: any = { payment_status: status };
      if (status === 'paid') {
        updateData.payment_date = new Date().toISOString().split('T')[0];
      }
      if (reference) updateData.payment_reference = reference;
      if (remarks) updateData.payment_remarks = remarks;

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success(`Payment status updated to ${status}`);
      setPaymentDialog({ open: false, invoice: null });
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
          <p className="mt-4 text-muted-foreground">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-primary">Payments & Invoices</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Invoices</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                {stats.total}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Clock className="h-6 w-6 text-warning" />
                {stats.pending}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Paid</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-accent" />
                {stats.paid}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Amount</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-primary" />
                ₹{stats.totalAmount.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Create Invoice (Auditor only) */}
        {userRole === 'auditor' && assignments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Generate Invoice</CardTitle>
              <CardDescription>Create invoices for completed assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{assignment.client_name}</h3>
                      <p className="text-sm text-muted-foreground">{assignment.branch_name}</p>
                      <p className="text-sm font-semibold text-primary mt-1">
                        Fees: ₹{assignment.fees.toLocaleString()} + OPE: ₹{(assignment.ope || 0).toLocaleString()}
                      </p>
                    </div>
                    <Button onClick={() => handleCreateInvoice(assignment)}>
                      Generate Invoice
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Invoices</CardTitle>
            <CardDescription>Track and manage payment invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  {userRole === 'admin' && <TableHead>Auditor</TableHead>}
                  <TableHead>Assignment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>TDS</TableHead>
                  <TableHead>Net Payable</TableHead>
                  <TableHead>Status</TableHead>
                  {userRole === 'admin' && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                    {userRole === 'admin' && (
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.auditor?.full_name}</div>
                          <div className="text-sm text-muted-foreground">{invoice.auditor?.email}</div>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.assignment?.client_name}</div>
                        <div className="text-sm text-muted-foreground">{invoice.assignment?.branch_name}</div>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                    <TableCell>₹{Number(invoice.total_amount).toLocaleString()}</TableCell>
                    <TableCell>₹{Number(invoice.tds_amount).toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">₹{Number(invoice.net_payable).toLocaleString()}</TableCell>
                    <TableCell>
                      <StatusBadge status={invoice.payment_status} />
                    </TableCell>
                    {userRole === 'admin' && (
                      <TableCell>
                        {invoice.payment_status !== 'paid' && (
                          <Button
                            size="sm"
                            onClick={() => setPaymentDialog({ open: true, invoice })}
                          >
                            Update
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Payment Update Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => setPaymentDialog({ open, invoice: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Invoice: {paymentDialog.invoice?.invoice_number}</Label>
              <p className="text-sm text-muted-foreground">
                Amount: ₹{Number(paymentDialog.invoice?.net_payable || 0).toLocaleString()}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                onValueChange={(value) => {
                  if (value === 'paid' || value === 'approved' || value === 'rejected') {
                    handleUpdatePayment(paymentDialog.invoice?.id, value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="paid">Mark as Paid</SelectItem>
                  <SelectItem value="rejected">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}