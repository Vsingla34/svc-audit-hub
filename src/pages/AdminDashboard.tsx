import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus, LogOut, Users, Briefcase, CheckCircle, Clock } from 'lucide-react';

export default function AdminDashboard() {
  const { signOut, user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    allotted: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    client_name: '',
    branch_name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    audit_type: 'Stock Audit',
    audit_date: '',
    deadline_date: '',
    fees: '',
    ope: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('*')
        .order('created_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Calculate stats
      const total = assignmentsData?.length || 0;
      const open = assignmentsData?.filter(a => a.status === 'open').length || 0;
      const allotted = assignmentsData?.filter(a => a.status === 'allotted' || a.status === 'in_progress').length || 0;
      const completed = assignmentsData?.filter(a => a.status === 'completed' || a.status === 'paid').length || 0;
      
      setStats({ total, open, allotted, completed });

      // Fetch applications
      const { data: applicationsData, error: applicationsError } = await supabase
        .from('applications')
        .select(`
          *,
          assignment:assignments(client_name, branch_name, city, state),
          auditor:profiles(full_name, email)
        `)
        .eq('status', 'pending')
        .order('applied_at', { ascending: false });

      if (applicationsError) throw applicationsError;
      setApplications(applicationsData || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase.from('assignments').insert({
        ...formData,
        fees: parseFloat(formData.fees),
        ope: parseFloat(formData.ope) || 0,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success('Assignment created successfully!');
      setShowCreateDialog(false);
      setFormData({
        client_name: '',
        branch_name: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        audit_type: 'Stock Audit',
        audit_date: '',
        deadline_date: '',
        fees: '',
        ope: '',
      });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAllotAssignment = async (applicationId: string, assignmentId: string, auditorId: string) => {
    try {
      // Update assignment
      const { error: assignmentError } = await supabase
        .from('assignments')
        .update({ status: 'allotted', allotted_to: auditorId })
        .eq('id', assignmentId);

      if (assignmentError) throw assignmentError;

      // Update application
      const { error: applicationError } = await supabase
        .from('applications')
        .update({ status: 'accepted' })
        .eq('id', applicationId);

      if (applicationError) throw applicationError;

      // Reject other applications for this assignment
      await supabase
        .from('applications')
        .update({ status: 'rejected' })
        .eq('assignment_id', assignmentId)
        .neq('id', applicationId);

      toast.success('Assignment allotted successfully!');
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
          <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Assignments</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-primary" />
                {stats.total}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Clock className="h-6 w-6 text-warning" />
                {stats.open}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Allotted</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                {stats.allotted}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-accent" />
                {stats.completed}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Create Assignment Button */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create New Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Assignment</DialogTitle>
              <DialogDescription>Add a new audit assignment to the system</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_name">Client Name</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch_name">Branch Name</Label>
                  <Input
                    id="branch_name"
                    value={formData.branch_name}
                    onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit_type">Audit Type</Label>
                <Select value={formData.audit_type} onValueChange={(value) => setFormData({ ...formData, audit_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Stock Audit">Stock Audit</SelectItem>
                    <SelectItem value="Concurrent Audit">Concurrent Audit</SelectItem>
                    <SelectItem value="Credit Audit">Credit Audit</SelectItem>
                    <SelectItem value="Revenue Audit">Revenue Audit</SelectItem>
                    <SelectItem value="Tax Audit">Tax Audit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="audit_date">Audit Date</Label>
                  <Input
                    id="audit_date"
                    type="date"
                    value={formData.audit_date}
                    onChange={(e) => setFormData({ ...formData, audit_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline_date">Deadline Date</Label>
                  <Input
                    id="deadline_date"
                    type="date"
                    value={formData.deadline_date}
                    onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fees">Fees (₹)</Label>
                  <Input
                    id="fees"
                    type="number"
                    step="0.01"
                    value={formData.fees}
                    onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ope">Out of Pocket Expenses (₹)</Label>
                  <Input
                    id="ope"
                    type="number"
                    step="0.01"
                    value={formData.ope}
                    onChange={(e) => setFormData({ ...formData, ope: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">Create Assignment</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Pending Applications */}
        {applications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Applications</CardTitle>
              <CardDescription>Review and allot assignments to auditors</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auditor</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{app.auditor?.full_name}</div>
                          <div className="text-sm text-muted-foreground">{app.auditor?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{app.assignment?.client_name}</div>
                          <div className="text-sm text-muted-foreground">{app.assignment?.branch_name}</div>
                        </div>
                      </TableCell>
                      <TableCell>{app.assignment?.city}, {app.assignment?.state}</TableCell>
                      <TableCell>{new Date(app.applied_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleAllotAssignment(app.id, app.assignment_id, app.auditor_id)}
                        >
                          Allot
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* All Assignments */}
        <Card>
          <CardHeader>
            <CardTitle>All Assignments</CardTitle>
            <CardDescription>Manage all audit assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Fees</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.client_name}</TableCell>
                    <TableCell>{assignment.branch_name}</TableCell>
                    <TableCell>{assignment.city}, {assignment.state}</TableCell>
                    <TableCell>{assignment.audit_type}</TableCell>
                    <TableCell>{new Date(assignment.audit_date).toLocaleDateString()}</TableCell>
                    <TableCell>₹{assignment.fees.toLocaleString()}</TableCell>
                    <TableCell>
                      <StatusBadge status={assignment.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
