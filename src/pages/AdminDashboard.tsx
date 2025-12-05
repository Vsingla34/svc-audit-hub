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
import { Plus, Users, Briefcase, CheckCircle, Clock, Star } from 'lucide-react';
import { BulkUploadDialog } from '@/components/BulkUploadDialog';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { AssignmentFilters } from '@/components/AssignmentFilters';
import { DashboardAnalytics } from '@/components/DashboardAnalytics';
import { AuditorsList } from '@/components/AuditorsList';
import { AssignmentSearchExport } from '@/components/AssignmentSearchExport';
import { UserRoleManagement } from '@/components/UserRoleManagement';
import { DeadlineReminders } from '@/components/DeadlineReminders';
import { ReportsManagement } from '@/components/ReportsManagement';
import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [pendingKyc, setPendingKyc] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, allotted: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterAuditType, setFilterAuditType] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [auditorRatings, setAuditorRatings] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // Rating Dialog
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedAssignmentForRating, setSelectedAssignmentForRating] = useState<string | null>(null);
  const [tempRating, setTempRating] = useState(0);
  
  // Form state
  const [formData, setFormData] = useState({
    client_name: '', branch_name: '', address: '', city: '', state: '',
    pincode: '', audit_type: 'Stock Audit', audit_date: '', deadline_date: '', fees: '', ope: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments').select('*').order('created_at', { ascending: false });
      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      const total = assignmentsData?.length || 0;
      const open = assignmentsData?.filter(a => a.status === 'open').length || 0;
      const allotted = assignmentsData?.filter(a => a.status === 'allotted' || a.status === 'in_progress').length || 0;
      const completed = assignmentsData?.filter(a => a.status === 'completed' || a.status === 'paid').length || 0;
      setStats({ total, open, allotted, completed });

      const { data: applicationsData, error: applicationsError } = await supabase
        .from('applications')
        .select(`*, assignment:assignments(client_name, branch_name, city, state, assignment_number), auditor:profiles!applications_auditor_id_fkey(full_name, email, id)`)
        .eq('status', 'pending').order('applied_at', { ascending: false });
      if (applicationsError) throw applicationsError;
      setApplications(applicationsData || []);

      if (applicationsData && applicationsData.length > 0) {
        const auditorIds = applicationsData.map(app => app.auditor_id);
        const { data: profilesData } = await supabase.from('auditor_profiles').select('user_id, rating').in('user_id', auditorIds);
        const ratingsMap: Record<string, number> = {};
        profilesData?.forEach(profile => { ratingsMap[profile.user_id] = profile.rating || 0; });
        setAuditorRatings(ratingsMap);
      }

      const { data: kycData, error: kycError } = await supabase
        .from('auditor_profiles')
        .select(`*, profiles:user_id (full_name, email)`)
        .eq('kyc_status', 'pending').order('created_at', { ascending: false });
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
        ...formData, fees: parseFloat(formData.fees), ope: parseFloat(formData.ope) || 0, created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Assignment created successfully!');
      setShowCreateDialog(false);
      setFormData({ client_name: '', branch_name: '', address: '', city: '', state: '', pincode: '', audit_type: 'Stock Audit', audit_date: '', deadline_date: '', fees: '', ope: '' });
      fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const handleKycApproval = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase.from('auditor_profiles').update({ kyc_status: status }).eq('user_id', userId);
      if (error) throw error;
      toast.success(`KYC ${status} successfully!`);
      fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const handleAllotAssignment = async (applicationId: string, assignmentId: string, auditorId: string) => {
    try {
      const { data: assignment } = await supabase.from('assignments').select('*').eq('id', assignmentId).single();
      const { data: auditor } = await supabase.from('profiles').select('*').eq('id', auditorId).single();

      const { error: assignmentError } = await supabase.from('assignments').update({ status: 'allotted', allotted_to: auditorId }).eq('id', assignmentId);
      if (assignmentError) throw assignmentError;

      const { error: applicationError } = await supabase.from('applications').update({ status: 'accepted' }).eq('id', applicationId);
      if (applicationError) throw applicationError;

      await supabase.from('applications').update({ status: 'rejected' }).eq('assignment_id', assignmentId).neq('id', applicationId);

      if (assignment && auditor) {
        await supabase.functions.invoke('send-assignment-notification', {
          body: { to: auditor.email, auditorName: auditor.full_name, assignmentDetails: { clientName: assignment.client_name, branchName: assignment.branch_name, city: assignment.city, state: assignment.state, auditDate: assignment.audit_date, fees: assignment.fees } },
        });
        await supabase.functions.invoke('create-notification', {
          body: { user_id: auditorId, title: 'Assignment Allotted', message: `You have been assigned to ${assignment.client_name} - ${assignment.branch_name}. Assignment #${assignment.assignment_number}`, type: 'success', related_assignment_id: assignmentId },
        });
      }
      toast.success('Assignment allotted successfully!');
      fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    try {
      const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
      if (error) throw error;
      toast.success('Assignment deleted successfully!');
      fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const handleChangeAllocation = async (assignmentId: string) => {
    try {
      const { error } = await supabase.from('assignments').update({ allotted_to: null, status: 'open' }).eq('id', assignmentId);
      if (error) throw error;
      toast.success('Allocation cleared. Assignment is now open for new applications.');
      fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const handleCompleteAssignment = async (assignmentId: string, rating?: number) => {
    try {
      const updateData: any = { status: 'completed', completed_at: new Date().toISOString() };
      if (rating) updateData.auditor_rating = rating;

      const { data: assignment, error } = await supabase.from('assignments').update(updateData).eq('id', assignmentId).select('allotted_to').single();
      if (error) throw error;

      if (assignment?.allotted_to) {
        await supabase.functions.invoke('create-notification', {
          body: { user_id: assignment.allotted_to, title: 'Assignment Completed', message: rating ? `Your assignment has been marked complete with a rating of ${rating}/5 stars!` : 'Your assignment has been marked as completed.', type: 'success', related_assignment_id: assignmentId },
        });
      }
      toast.success('Assignment marked as completed');
      fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const openRatingDialog = (assignmentId: string) => { setSelectedAssignmentForRating(assignmentId); setTempRating(0); setRatingDialogOpen(true); };
  const submitRating = () => { if (selectedAssignmentForRating && tempRating > 0) { handleCompleteAssignment(selectedAssignmentForRating, tempRating); setRatingDialogOpen(false); setSelectedAssignmentForRating(null); setTempRating(0); } };

  const handleDeleteApplication = async (applicationId: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;
    try {
      const { error } = await supabase.from('applications').delete().eq('id', applicationId);
      if (error) throw error;
      toast.success('Application deleted successfully!');
      fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedAssignments.length === 0 || !bulkStatus) { toast.error('Please select assignments and status'); return; }
    try {
      const { error } = await supabase.from('assignments').update({ status: bulkStatus }).in('id', selectedAssignments);
      if (error) throw error;
      toast.success(`${selectedAssignments.length} assignments updated`);
      setSelectedAssignments([]); setBulkStatus(''); setShowBulkActions(false);
      fetchData();
    } catch (error: any) { toast.error(error.message); }
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
      return assignment.client_name?.toLowerCase().includes(query) || assignment.branch_name?.toLowerCase().includes(query) || assignment.city?.toLowerCase().includes(query) || assignment.assignment_number?.toLowerCase().includes(query);
    }
    return true;
  });

  const uniqueStates = [...new Set(assignments.map(a => a.state))];
  const uniqueCities = [...new Set(assignments.map(a => a.city))];
  const uniqueAuditTypes = [...new Set(assignments.map(a => a.audit_type))];

  const handleFilterChange = (filters: any) => {
    if (filters.status !== undefined) setFilterStatus(filters.status);
    if (filters.state !== undefined) setFilterState(filters.state);
    if (filters.city !== undefined) setFilterCity(filters.city);
    if (filters.auditType !== undefined) setFilterAuditType(filters.auditType);
    if (filters.dateFrom !== undefined) setFilterDateFrom(filters.dateFrom);
    if (filters.dateTo !== undefined) setFilterDateTo(filters.dateTo);
  };

  const resetFilters = () => { setFilterStatus('all'); setFilterState('all'); setFilterCity('all'); setFilterAuditType('all'); setFilterDateFrom(''); setFilterDateTo(''); };

  const toggleAssignmentSelection = (id: string) => setSelectedAssignments(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedAssignments(selectedAssignments.length === filteredAssignments.length ? [] : filteredAssignments.map(a => a.id));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Admin Dashboard" navItems={adminNavItems} activeTab={activeTab} onTabChange={setActiveTab}>
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardDescription>Total Assignments</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <Briefcase className="h-6 w-6 text-primary" />{stats.total}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-card hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardDescription>Open</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <Clock className="h-6 w-6 text-amber-500" />{stats.open}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-card hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardDescription>Allotted</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <Users className="h-6 w-6 text-blue-500" />{stats.allotted}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-card hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardDescription>Completed</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-green-500" />{stats.completed}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Analytics */}
          <DashboardAnalytics assignments={assignments} />
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Create Assignment</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Assignment</DialogTitle>
                  <DialogDescription>Add a new audit assignment</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateAssignment} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Client Name</Label><Input value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Branch Name</Label><Input value={formData.branch_name} onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })} required /></div>
                  </div>
                  <div className="space-y-2"><Label>Address</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>City</Label><Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>State</Label><Input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Pincode</Label><Input value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} required /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Audit Type</Label>
                    <Select value={formData.audit_type} onValueChange={(v) => setFormData({ ...formData, audit_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <div className="space-y-2"><Label>Audit Date</Label><Input type="date" value={formData.audit_date} onChange={(e) => setFormData({ ...formData, audit_date: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Deadline Date</Label><Input type="date" value={formData.deadline_date} onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })} required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Fees (₹)</Label><Input type="number" step="0.01" value={formData.fees} onChange={(e) => setFormData({ ...formData, fees: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>OPE (₹)</Label><Input type="number" step="0.01" value={formData.ope} onChange={(e) => setFormData({ ...formData, ope: e.target.value })} /></div>
                  </div>
                  <Button type="submit" className="w-full">Create Assignment</Button>
                </form>
              </DialogContent>
            </Dialog>
            <BulkUploadDialog userId={user?.id || ''} onSuccess={fetchData} />
          </div>

          <AssignmentSearchExport assignments={filteredAssignments} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          <AssignmentFilters filterStatus={filterStatus} filterState={filterState} filterCity={filterCity} filterAuditType={filterAuditType} filterDateFrom={filterDateFrom} filterDateTo={filterDateTo} onFilterChange={handleFilterChange} onReset={resetFilters} states={uniqueStates} cities={uniqueCities} auditTypes={uniqueAuditTypes} />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle>All Assignments</CardTitle><CardDescription>{filteredAssignments.length} assignments</CardDescription></div>
                {selectedAssignments.length > 0 && <Button variant="outline" onClick={() => setShowBulkActions(!showBulkActions)}>Bulk Actions ({selectedAssignments.length})</Button>}
              </div>
            </CardHeader>
            <CardContent>
              {showBulkActions && selectedAssignments.length > 0 && (
                <div className="p-4 border rounded-lg bg-muted/50 mb-4 flex gap-4 items-end flex-wrap">
                  <div className="flex-1 min-w-[150px]">
                    <Label>Status</Label>
                    <Select value={bulkStatus} onValueChange={setBulkStatus}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="allotted">Allotted</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleBulkStatusUpdate}>Update</Button>
                  <Button variant="ghost" onClick={() => { setSelectedAssignments([]); setShowBulkActions(false); }}>Cancel</Button>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"><Checkbox checked={selectedAssignments.length === filteredAssignments.length && filteredAssignments.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                      <TableHead>Assign #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Fees</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell><Checkbox checked={selectedAssignments.includes(a.id)} onCheckedChange={() => toggleAssignmentSelection(a.id)} /></TableCell>
                        <TableCell className="font-mono text-xs">{a.assignment_number}</TableCell>
                        <TableCell className="font-medium">{a.client_name}</TableCell>
                        <TableCell>{a.branch_name}</TableCell>
                        <TableCell>{a.city}, {a.state}</TableCell>
                        <TableCell>{a.audit_type}</TableCell>
                        <TableCell>{new Date(a.audit_date).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell>₹{a.fees?.toLocaleString('en-IN')}</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {a.status === 'allotted' && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleChangeAllocation(a.id)}>Change</Button>
                                <Button size="sm" variant="outline" onClick={() => openRatingDialog(a.id)}><Star className="h-3 w-3" /></Button>
                              </>
                            )}
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteAssignment(a.id)}>Delete</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Deadlines Tab */}
      {activeTab === 'deadlines' && <DeadlineReminders />}

      {/* Auditors Tab */}
      {activeTab === 'auditors' && <AuditorsList />}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <Card>
          <CardHeader><CardTitle>Pending Applications</CardTitle><CardDescription>Review and allot assignments</CardDescription></CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pending applications</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assignment #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Auditor</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((app: any) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-mono text-xs">{app.assignment?.assignment_number}</TableCell>
                        <TableCell className="font-medium">{app.assignment?.client_name}</TableCell>
                        <TableCell>{app.assignment?.city}, {app.assignment?.state}</TableCell>
                        <TableCell>{app.auditor?.full_name}</TableCell>
                        <TableCell>{auditorRatings[app.auditor_id] ? <div className="flex items-center gap-1"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{auditorRatings[app.auditor_id]}</div> : <span className="text-muted-foreground">-</span>}</TableCell>
                        <TableCell>{new Date(app.applied_at).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleAllotAssignment(app.id, app.assignment_id, app.auditor_id)}>Allot</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteApplication(app.id)}>Reject</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && <ReportsManagement />}

      {/* KYC Approvals Tab */}
      {activeTab === 'kyc-approvals' && (
        <Card>
          <CardHeader><CardTitle>Pending KYC Approvals</CardTitle><CardDescription>Review auditor registrations</CardDescription></CardHeader>
          <CardContent>
            {pendingKyc.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pending KYC approvals</p>
            ) : (
              <div className="overflow-x-auto">
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
                        <TableCell className="font-medium">{kyc.profiles?.full_name}</TableCell>
                        <TableCell>{kyc.profiles?.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {kyc.qualifications?.map((q: string) => <span key={q} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">{q}</span>)}
                          </div>
                        </TableCell>
                        <TableCell>{kyc.experience_years} years</TableCell>
                        <TableCell>{kyc.base_city}, {kyc.base_state}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleKycApproval(kyc.user_id, 'approved')}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleKycApproval(kyc.user_id, 'rejected')}>Reject</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* User Roles Tab */}
      {activeTab === 'user-roles' && <UserRoleManagement />}

      {/* Rating Dialog */}
      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate Auditor & Complete</DialogTitle>
            <DialogDescription>Provide a rating (1-5 stars)</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map((r) => (
              <button key={r} onClick={() => setTempRating(r)} className="transition-transform hover:scale-110">
                <Star className={`h-10 w-10 ${r <= tempRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRatingDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitRating} disabled={tempRating === 0}>Complete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
