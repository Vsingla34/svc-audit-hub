import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/StatusBadge';
import { Star, Repeat, Pencil, Trash2 } from 'lucide-react';
import { BulkUploadDialog } from '@/components/BulkUploadDialog';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { EditAssignmentDialog } from '@/components/EditAssignmentDialog'; 
import { Checkbox } from '@/components/ui/checkbox';
import { AssignmentSearchExport } from '@/components/AssignmentSearchExport';
import { AssignmentFilters } from '@/components/AssignmentFilters';
import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';

export default function AdminAssignmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // SHARED CACHE: This uses the exact same query key as the Overview page!
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['admin-assignments-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  // A helper function to easily refresh data after mutations (edits, deletes, creates)
  const refreshAssignments = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-assignments-all'] });
  };

  // Edit Assignment State
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Reallocation State
  const [reallocateDialogOpen, setReallocateDialogOpen] = useState(false);
  const [reallocationList, setReallocationList] = useState<any[]>([]);
  const [selectedAssignmentForRealloc, setSelectedAssignmentForRealloc] = useState<string | null>(null);
  const [fetchingApplicants, setFetchingApplicants] = useState(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterAuditType, setFilterAuditType] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);

  // Derived Filter Options using useMemo for speed
  const uniqueStates = useMemo(() => Array.from(new Set(assignments.map(a => a.state).filter(Boolean))).sort(), [assignments]);
  const uniqueCities = useMemo(() => Array.from(new Set(assignments.map(a => a.city).filter(Boolean))).sort(), [assignments]);
  const uniqueAuditTypes = useMemo(() => Array.from(new Set(assignments.map(a => a.audit_type).filter(Boolean))).sort(), [assignments]);

  // High-performance Filtering Logic
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = 
          a.client_name?.toLowerCase().includes(q) ||
          a.branch_name?.toLowerCase().includes(q) ||
          a.city?.toLowerCase().includes(q) ||
          a.state?.toLowerCase().includes(q) ||
          a.audit_type?.toLowerCase().includes(q) ||
          a.assignment_number?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterStatus !== 'all' && a.status !== filterStatus) return false;
      if (filterState !== 'all' && a.state !== filterState) return false;
      if (filterCity !== 'all' && a.city !== filterCity) return false;
      if (filterAuditType !== 'all' && a.audit_type !== filterAuditType) return false;
      if (filterDateFrom && new Date(a.audit_date) < new Date(filterDateFrom)) return false;
      if (filterDateTo && new Date(a.audit_date) > new Date(filterDateTo)) return false;
      return true;
    });
  }, [assignments, searchQuery, filterStatus, filterState, filterCity, filterAuditType, filterDateFrom, filterDateTo]);

  const handleFilterChange = (filters: any) => {
    if (filters.status !== undefined) setFilterStatus(filters.status);
    if (filters.state !== undefined) setFilterState(filters.state);
    if (filters.city !== undefined) setFilterCity(filters.city);
    if (filters.auditType !== undefined) setFilterAuditType(filters.auditType);
    if (filters.dateFrom !== undefined) setFilterDateFrom(filters.dateFrom);
    if (filters.dateTo !== undefined) setFilterDateTo(filters.dateTo);
  };

  const handleResetFilters = () => {
    setFilterStatus('all'); setFilterState('all'); setFilterCity('all');
    setFilterAuditType('all'); setFilterDateFrom(''); setFilterDateTo('');
    setSearchQuery('');
  };

  // Actions
  const handleEditAssignment = (assignment: any) => {
    setEditingAssignment(assignment);
    setEditDialogOpen(true);
  };

  const handleDeleteAssignment = async (id: string) => { 
    if(confirm('Are you sure you want to delete this assignment?')) { 
      try {
        await supabase.from('assignments').delete().eq('id', id); 
        refreshAssignments(); 
        toast.success('Assignment deleted successfully');
      } catch (err: any) {
        toast.error('Failed to delete: ' + err.message);
      }
    } 
  };

  const handleOpenReallocate = async (assignmentId: string) => {
    setSelectedAssignmentForRealloc(assignmentId);
    setReallocationList([]);
    setReallocateDialogOpen(true);
    setFetchingApplicants(true);

    try {
      const { data: apps, error } = await supabase
        .from('applications')
        .select(`*, auditor:profiles(full_name, email, phone)`)
        .eq('assignment_id', assignmentId);

      if (error) throw error;
      if (!apps || apps.length === 0) {
        setFetchingApplicants(false);
        return;
      }

      const auditorIds = apps.map(a => a.auditor_id);
      const { data: profiles } = await supabase
        .from('auditor_profiles')
        .select('*')
        .in('user_id', auditorIds);
      
      const mergedList = apps.map(app => {
        const profile = profiles?.find(p => p.user_id === app.auditor_id);
        return {
          ...app,
          rating: profile?.rating || 0,
          experience: profile?.experience_years || 0
        };
      });

      setReallocationList(mergedList);
    } catch (error: any) {
      toast.error('Failed to load applicants');
    } finally {
      setFetchingApplicants(false);
    }
  };

  const confirmReallocation = async (applicationId: string, newAuditorId: string) => {
    if (!selectedAssignmentForRealloc) return;
    if (!confirm("Confirm re-allocation? This will notify the new auditor.")) return;

    try {
      const { error: assignError } = await supabase
        .from('assignments')
        .update({ allotted_to: newAuditorId, status: 'allotted' })
        .eq('id', selectedAssignmentForRealloc);

      if (assignError) throw assignError;

      await supabase.from('applications').update({ status: 'rejected' }).eq('assignment_id', selectedAssignmentForRealloc);
      await supabase.from('applications').update({ status: 'accepted' }).eq('id', applicationId);

      await supabase.from('notifications').insert({
        user_id: newAuditorId,
        title: 'Assignment Re-allocated to You! 🎉',
        message: 'An assignment has been transferred to you. Check My Assignments.',
        type: 'success',
        related_assignment_id: selectedAssignmentForRealloc
      });

      toast.success('Auditor changed successfully');
      setReallocateDialogOpen(false);
      refreshAssignments();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleAssignmentSelection = (id: string) => setSelectedAssignments(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedAssignments(selectedAssignments.length === filteredAssignments.length ? [] : filteredAssignments.map(a => a.id));

  return (
    <DashboardLayout title="Assignments Management" navItems={adminNavItems} activeTab="assignments">
      <div className="space-y-4 max-w-7xl mx-auto py-6">
        
        <div className="flex gap-2 mb-6">
          <CreateAssignmentDialog onAssignmentCreated={refreshAssignments} />
          <BulkUploadDialog userId={user?.id || ''} onSuccess={refreshAssignments} />
        </div>

        <AssignmentFilters 
          filterStatus={filterStatus} filterState={filterState} filterCity={filterCity}
          filterAuditType={filterAuditType} filterDateFrom={filterDateFrom} filterDateTo={filterDateTo}
          onFilterChange={handleFilterChange} onReset={handleResetFilters}
          states={uniqueStates} cities={uniqueCities} auditTypes={uniqueAuditTypes}
        />
        
        <AssignmentSearchExport assignments={filteredAssignments} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
               <div className="text-center py-10 text-muted-foreground animate-pulse">Loading assignments...</div>
            ) : (
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead className="w-10"><Checkbox checked={selectedAssignments.length > 0 && selectedAssignments.length === filteredAssignments.length} onCheckedChange={toggleSelectAll} /></TableHead>
                     <TableHead>Client</TableHead>
                     <TableHead>Location</TableHead>
                     <TableHead>Audit Type</TableHead>
                     <TableHead>Date</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filteredAssignments.length === 0 ? (
                     <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No assignments found matching criteria</TableCell></TableRow>
                   ) : (
                     filteredAssignments.map(a => (
                       <TableRow key={a.id}>
                         <TableCell><Checkbox checked={selectedAssignments.includes(a.id)} onCheckedChange={() => toggleAssignmentSelection(a.id)} /></TableCell>
                         <TableCell>
                           <div className="font-medium">{a.client_name}</div>
                           <div className="text-xs text-muted-foreground">{a.branch_name}</div>
                         </TableCell>
                         <TableCell>{a.city}, {a.state}</TableCell>
                         <TableCell><Badge variant="outline">{a.audit_type}</Badge></TableCell>
                         <TableCell>{new Date(a.audit_date).toLocaleDateString()}</TableCell>
                         <TableCell><StatusBadge status={a.status} /></TableCell>
                         <TableCell>
                           <div className="flex justify-end gap-2">
                             <Button size="icon" variant="ghost" onClick={() => handleEditAssignment(a)} title="Edit Assignment">
                               <Pencil className="h-4 w-4 text-blue-600" />
                             </Button>
                             {a.status === 'allotted' && (
                               <Button size="icon" variant="ghost" onClick={() => handleOpenReallocate(a.id)} title="Re-allocate">
                                 <Repeat className="h-4 w-4 text-amber-600" />
                               </Button>
                             )}
                             <Button size="icon" variant="ghost" onClick={() => handleDeleteAssignment(a.id)} title="Delete Assignment">
                                <Trash2 className="h-4 w-4 text-destructive" />
                             </Button>
                           </div>
                         </TableCell>
                       </TableRow>
                     ))
                   )}
                 </TableBody>
               </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Assignment Dialog */}
      <EditAssignmentDialog 
        assignment={editingAssignment} open={editDialogOpen}
        onOpenChange={setEditDialogOpen} onSuccess={refreshAssignments}
      />

      {/* Reallocate Dialog */}
      <Dialog open={reallocateDialogOpen} onOpenChange={setReallocateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Re-allocate Assignment</DialogTitle>
            <DialogDescription>Select another auditor from the applicant pool.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Auditor</TableHead>
                   <TableHead>Stats</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead className="text-right">Action</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {fetchingApplicants ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Loading applicants...</TableCell></TableRow>
                 ) : reallocationList.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No other applicants found.</TableCell></TableRow>
                 ) : (
                    reallocationList.map((app) => (
                      <TableRow key={app.id}>
                         <TableCell>
                            <div className="font-medium">{app.auditor?.full_name}</div>
                            <div className="text-xs text-muted-foreground">{app.auditor?.email}</div>
                         </TableCell>
                         <TableCell>
                            <div className="text-xs">
                               <span className="font-semibold">{app.experience} yrs</span> • {app.rating} <Star className="inline h-3 w-3 fill-amber-500 text-amber-500"/>
                            </div>
                         </TableCell>
                         <TableCell>
                            <StatusBadge status={app.status} />
                         </TableCell>
                         <TableCell className="text-right">
                            {app.status !== 'accepted' ? (
                               <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => confirmReallocation(app.id, app.auditor_id)}>Assign</Button>
                               </div>
                            ) : (
                               <span className="text-xs font-medium text-green-600">Current</span>
                            )}
                         </TableCell>
                      </TableRow>
                    ))
                 )}
               </TableBody>
             </Table>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReallocateDialogOpen(false)}>Cancel</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}