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
import { Plus, LogOut, Users, Briefcase, CheckCircle, Clock, DollarSign, ArrowLeft, MapPin, Star, BarChart3, Shield } from 'lucide-react';
import { BulkUploadDialog } from '@/components/BulkUploadDialog';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { AssignmentFilters } from '@/components/AssignmentFilters';
import { DashboardAnalytics } from '@/components/DashboardAnalytics';
import { NotificationBell } from '@/components/NotificationBell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuditorsList } from '@/components/AuditorsList';
import { AssignmentSearchExport } from '@/components/AssignmentSearchExport';
import { UserRoleManagement } from '@/components/UserRoleManagement';

export default function AdminDashboard() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [pendingKyc, setPendingKyc] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    allotted: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterAuditType, setFilterAuditType] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [auditorRatings, setAuditorRatings] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  
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

      // Fetch applications with auditor profiles for ratings
      const { data: applicationsData, error: applicationsError } = await supabase
        .from('applications')
        .select(`
          *,
          assignment:assignments(client_name, branch_name, city, state, assignment_number),
          auditor:profiles!applications_auditor_id_fkey(full_name, email, id)
        `)
        .eq('status', 'pending')
        .order('applied_at', { ascending: false });

      if (applicationsError) throw applicationsError;
      setApplications(applicationsData || []);

      // Fetch auditor ratings for all auditors in applications
      if (applicationsData && applicationsData.length > 0) {
        const auditorIds = applicationsData.map(app => app.auditor_id);
        const { data: profilesData } = await supabase
          .from('auditor_profiles')
          .select('user_id, rating')
          .in('user_id', auditorIds);

        const ratingsMap: Record<string, number> = {};
        profilesData?.forEach(profile => {
          ratingsMap[profile.user_id] = profile.rating || 0;
        });
        setAuditorRatings(ratingsMap);
      }

      // Fetch pending KYC
      const { data: kycData, error: kycError } = await supabase
        .from('auditor_profiles')
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .eq('kyc_status', 'pending')
        .order('created_at', { ascending: false });

      if (kycError) throw kycError;
      setPendingKyc(kycData || []);
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

  const handleRejectKyc = async (auditorId: string) => {
    if (!confirm('Are you sure you want to reject this KYC?')) return;
    
    try {
      const { error } = await supabase
        .from('auditor_profiles')
        .update({ kyc_status: 'rejected' })
        .eq('user_id', auditorId);

      if (error) throw error;
      toast.success('KYC rejected successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleKycApproval = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('auditor_profiles')
        .update({ kyc_status: status })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(`KYC ${status} successfully!`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAllotAssignment = async (applicationId: string, assignmentId: string, auditorId: string) => {
    try {
      // Get assignment and auditor details
      const { data: assignment } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      const { data: auditor } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', auditorId)
        .single();

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

      // Send email notification
      if (assignment && auditor) {
        await supabase.functions.invoke('send-assignment-notification', {
          body: {
            to: auditor.email,
            auditorName: auditor.full_name,
            assignmentDetails: {
              clientName: assignment.client_name,
              branchName: assignment.branch_name,
              city: assignment.city,
              state: assignment.state,
              auditDate: assignment.audit_date,
              fees: assignment.fees,
            },
          },
        });

        // Create notification
        await supabase.functions.invoke('create-notification', {
          body: {
            user_id: auditorId,
            title: 'Assignment Allotted',
            message: `You have been assigned to ${assignment.client_name} - ${assignment.branch_name}. Assignment #${assignment.assignment_number}`,
            type: 'success',
            related_assignment_id: assignmentId,
          },
        });
      }

      toast.success('Assignment allotted successfully!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      toast.success('Assignment deleted successfully!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleChangeAllocation = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ 
          allotted_to: null, 
          status: 'open' 
        })
        .eq('id', assignmentId);

      if (error) throw error;
      toast.success('Allocation cleared. Assignment is now open for new applications.');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCompleteAssignment = async (assignmentId: string, rating?: number) => {
    try {
      const updateData: any = { 
        status: 'completed',
        completed_at: new Date().toISOString()
      };
      
      if (rating) {
        updateData.auditor_rating = rating;
      }

      const { data: assignment, error } = await supabase
        .from('assignments')
        .update(updateData)
        .eq('id', assignmentId)
        .select('allotted_to')
        .single();

      if (error) throw error;

      // Send notification to auditor
      if (assignment?.allotted_to) {
        await supabase.functions.invoke('create-notification', {
          body: {
            user_id: assignment.allotted_to,
            title: 'Assignment Completed',
            message: rating 
              ? `Your assignment has been marked complete with a rating of ${rating}/5 stars!`
              : 'Your assignment has been marked as completed.',
            type: 'success',
            related_assignment_id: assignmentId,
          },
        });
      }

      toast.success('Assignment marked as completed');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedAssignmentForRating, setSelectedAssignmentForRating] = useState<string | null>(null);
  const [tempRating, setTempRating] = useState(0);

  const openRatingDialog = (assignmentId: string) => {
    setSelectedAssignmentForRating(assignmentId);
    setTempRating(0);
    setRatingDialogOpen(true);
  };

  const submitRating = () => {
    if (selectedAssignmentForRating && tempRating > 0) {
      handleCompleteAssignment(selectedAssignmentForRating, tempRating);
      setRatingDialogOpen(false);
      setSelectedAssignmentForRating(null);
      setTempRating(0);
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

  const handleBulkStatusUpdate = async () => {
    if (selectedAssignments.length === 0) {
      toast.error('Please select assignments first');
      return;
    }
    if (!bulkStatus) {
      toast.error('Please select a status');
      return;
    }

    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status: bulkStatus })
        .in('id', selectedAssignments);

      if (error) throw error;
      toast.success(`${selectedAssignments.length} assignments updated to ${bulkStatus}`);
      setSelectedAssignments([]);
      setBulkStatus('');
      setShowBulkActions(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleBulkReassign = async () => {
    if (selectedAssignments.length === 0) {
      toast.error('Please select assignments first');
      return;
    }

    if (!confirm(`Clear allocation for ${selectedAssignments.length} assignments?`)) return;

    try {
      const { error } = await supabase
        .from('assignments')
        .update({ 
          allotted_to: null, 
          status: 'open' 
        })
        .in('id', selectedAssignments);

      if (error) throw error;
      toast.success(`${selectedAssignments.length} assignments cleared and set to open`);
      setSelectedAssignments([]);
      setShowBulkActions(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleAssignmentSelection = (assignmentId: string) => {
    setSelectedAssignments(prev => 
      prev.includes(assignmentId) 
        ? prev.filter(id => id !== assignmentId)
        : [...prev, assignmentId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedAssignments.length === filteredAssignments.length) {
      setSelectedAssignments([]);
    } else {
      setSelectedAssignments(filteredAssignments.map(a => a.id));
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    if (filterStatus !== 'all' && assignment.status !== filterStatus) return false;
    if (filterState !== 'all' && assignment.state !== filterState) return false;
    if (filterCity !== 'all' && assignment.city !== filterCity) return false;
    if (filterAuditType !== 'all' && assignment.audit_type !== filterAuditType) return false;
    if (filterDateFrom && new Date(assignment.audit_date) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(assignment.audit_date) > new Date(filterDateTo)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        assignment.client_name?.toLowerCase().includes(query) ||
        assignment.branch_name?.toLowerCase().includes(query) ||
        assignment.city?.toLowerCase().includes(query) ||
        assignment.state?.toLowerCase().includes(query) ||
        assignment.assignment_number?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    return true;
  });

  const uniqueStates = [...new Set(assignments.map(a => a.state))];
  const uniqueCities = [...new Set(assignments.map(a => a.city))];
  const uniqueAuditTypes = [...new Set(assignments.map(a => a.audit_type))];

  const handleFilterChange = (filters: {
    status?: string;
    state?: string;
    city?: string;
    auditType?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    if (filters.status !== undefined) setFilterStatus(filters.status);
    if (filters.state !== undefined) setFilterState(filters.state);
    if (filters.city !== undefined) setFilterCity(filters.city);
    if (filters.auditType !== undefined) setFilterAuditType(filters.auditType);
    if (filters.dateFrom !== undefined) setFilterDateFrom(filters.dateFrom);
    if (filters.dateTo !== undefined) setFilterDateTo(filters.dateTo);
  };

  const resetFilters = () => {
    setFilterStatus('all');
    setFilterState('all');
    setFilterCity('all');
    setFilterAuditType('all');
    setFilterDateFrom('');
    setFilterDateTo('');
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
            <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowAnalytics(!showAnalytics)}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            <Button variant="outline" onClick={() => navigate('/payments')}>
              <DollarSign className="h-4 w-4 mr-2" />
              Payments
            </Button>
            <Button variant="outline" onClick={() => navigate('/map')}>
              <MapPin className="h-4 w-4 mr-2" />
              Map View
            </Button>
            <NotificationBell />
            <Button variant="outline" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Analytics Dashboard */}
        {showAnalytics && (
          <DashboardAnalytics assignments={assignments} />
        )}

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

        {/* Create Assignment Buttons */}
        <div className="flex gap-4">
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
        <BulkUploadDialog userId={user?.id || ''} onSuccess={fetchData} />
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="assignments" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="auditors">Auditors</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="kyc">KYC Approvals</TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              User Roles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="space-y-4">
            {/* Search & Export */}
            <AssignmentSearchExport
              assignments={filteredAssignments}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
            
            {/* Filters */}
            <AssignmentFilters
              filterStatus={filterStatus}
              filterState={filterState}
              filterCity={filterCity}
              filterAuditType={filterAuditType}
              filterDateFrom={filterDateFrom}
              filterDateTo={filterDateTo}
              onFilterChange={handleFilterChange}
              onReset={resetFilters}
              states={uniqueStates}
              cities={uniqueCities}
              auditTypes={uniqueAuditTypes}
            />

            {/* All Assignments */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Assignments</CardTitle>
                    <CardDescription>Manage all audit assignments</CardDescription>
                  </div>
                  {selectedAssignments.length > 0 && (
                    <Button 
                      variant="outline" 
                      onClick={() => setShowBulkActions(!showBulkActions)}
                    >
                      Bulk Actions ({selectedAssignments.length} selected)
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showBulkActions && selectedAssignments.length > 0 && (
                  <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                    <h4 className="font-medium">Bulk Actions</h4>
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <Label>Update Status</Label>
                        <Select value={bulkStatus} onValueChange={setBulkStatus}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="allotted">Allotted</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleBulkStatusUpdate}>
                        Update Status
                      </Button>
                      <Button variant="outline" onClick={handleBulkReassign}>
                        Clear Allocations
                      </Button>
                      <Button 
                        variant="ghost" 
                        onClick={() => {
                          setSelectedAssignments([]);
                          setShowBulkActions(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedAssignments.length === filteredAssignments.length && filteredAssignments.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Assign #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Fees</TableHead>
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedAssignments.includes(assignment.id)}
                            onCheckedChange={() => toggleAssignmentSelection(assignment.id)}
                          />
                        </TableCell>
                        <TableCell className="text-xs font-mono">{assignment.assignment_number}</TableCell>
                        <TableCell className="font-medium">{assignment.client_name}</TableCell>
                        <TableCell>{assignment.branch_name}</TableCell>
                        <TableCell>{assignment.city}, {assignment.state}</TableCell>
                        <TableCell>{assignment.audit_type}</TableCell>
                        <TableCell>{new Date(assignment.audit_date).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell>₹{assignment.fees.toLocaleString('en-IN')}</TableCell>
                        <TableCell>
                          {assignment.check_in_time ? (
                            <div className="text-xs">
                              <div>{new Date(assignment.check_in_time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                              {assignment.check_in_lat && (
                                <div className="text-muted-foreground">📍 {Number(assignment.check_in_lat).toFixed(4)}, {Number(assignment.check_in_lng).toFixed(4)}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {assignment.check_out_time ? (
                            <div className="text-xs">
                              <div>{new Date(assignment.check_out_time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                              {assignment.check_out_lat && (
                                <div className="text-muted-foreground">📍 {Number(assignment.check_out_lat).toFixed(4)}, {Number(assignment.check_out_lng).toFixed(4)}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={assignment.status} />
                        </TableCell>
                        <TableCell>
                          {assignment.auditor_rating ? (
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-warning text-warning" />
                              <span>{assignment.auditor_rating}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not rated</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {assignment.status === 'allotted' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleChangeAllocation(assignment.id)}
                                >
                                  Change
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openRatingDialog(assignment.id)}
                                >
                                  <Star className="h-3 w-3 mr-1" />
                                  Complete
                                </Button>
                              </>
                            )}
                            {assignment.status === 'completed' && assignment.report_url && (
                              <Button
                                size="sm"
                                onClick={() => navigate('/payments')}
                              >
                                Pay
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteAssignment(assignment.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auditors" className="space-y-4">
            <AuditorsList />
          </TabsContent>

          <TabsContent value="applications" className="space-y-4">
            {/* Pending Applications for Allotment */}
            {applications.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No pending applications at the moment.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Pending Applications</CardTitle>
                  <CardDescription>Review and allot assignments to auditors who have applied</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assignment #</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Auditor Name</TableHead>
                        <TableHead>Auditor Email</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Applied At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map((app: any) => (
                        <TableRow key={app.id}>
                          <TableCell className="text-xs font-mono">{app.assignment?.assignment_number || 'N/A'}</TableCell>
                          <TableCell className="font-medium">{app.assignment?.client_name || 'N/A'}</TableCell>
                          <TableCell>{app.assignment?.branch_name || 'N/A'}</TableCell>
                          <TableCell>{app.assignment?.city}, {app.assignment?.state}</TableCell>
                          <TableCell className="font-medium">{app.auditor?.full_name || 'Unknown'}</TableCell>
                          <TableCell>{app.auditor?.email || 'N/A'}</TableCell>
                          <TableCell>
                            {auditorRatings[app.auditor_id] ? (
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 fill-warning text-warning" />
                                <span>{auditorRatings[app.auditor_id]}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">No rating</span>
                            )}
                          </TableCell>
                          <TableCell>{new Date(app.applied_at).toLocaleDateString('en-IN')}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAllotAssignment(app.id, app.assignment_id, app.auditor_id)}
                              >
                                Allot
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteApplication(app.id)}
                              >
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="kyc" className="space-y-4">
            {pendingKyc.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No pending KYC approvals at the moment.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Pending KYC Approvals</CardTitle>
                  <CardDescription>Review and approve auditor registrations</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Qualifications</TableHead>
                        <TableHead>Experience</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingKyc.map((kyc) => (
                        <TableRow key={kyc.id}>
                          <TableCell className="font-medium">{kyc.profiles?.full_name || 'N/A'}</TableCell>
                          <TableCell>{kyc.profiles?.email || 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {kyc.qualifications?.map((q: string) => (
                                <span key={q} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                                  {q}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>{kyc.experience_years} years</TableCell>
                          <TableCell>{kyc.base_city}, {kyc.base_state}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleKycApproval(kyc.user_id, 'approved')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectKyc(kyc.user_id)}
                              >
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* User Roles Tab */}
          <TabsContent value="users">
            <UserRoleManagement />
          </TabsContent>
        </Tabs>
      </main>

      {/* Rating Dialog */}
      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate Auditor & Complete Assignment</DialogTitle>
            <DialogDescription>
              Provide a rating (1-5 stars) for the auditor's performance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setTempRating(rating)}
                  className="transition-all hover:scale-110"
                >
                  <Star
                    className={`h-10 w-10 ${
                      rating <= tempRating
                        ? 'fill-warning text-warning'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {tempRating > 0 ? `You selected ${tempRating} star${tempRating !== 1 ? 's' : ''}` : 'Click to rate'}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRatingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRating} disabled={tempRating === 0}>
              Complete Assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
