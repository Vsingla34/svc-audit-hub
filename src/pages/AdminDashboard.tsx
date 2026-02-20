import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/StatusBadge';
// Added FileText to the imports below
import { Star, Download, Eye, MapPin, Phone, Mail, MessageSquare, Briefcase, GraduationCap, Users, Navigation, Repeat, Pencil, Trash2, FileText } from 'lucide-react';
import { BulkUploadDialog } from '@/components/BulkUploadDialog';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { EditAssignmentDialog } from '@/components/EditAssignmentDialog'; 
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { AssignmentSearchExport } from '@/components/AssignmentSearchExport';
import { AssignmentFilters } from '@/components/AssignmentFilters';
import { UserRoleManagement } from '@/components/UserRoleManagement';
import { DeadlineReminders } from '@/components/DeadlineReminders';
import { ReportsManagement } from '@/components/ReportsManagement';
import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DashboardAnalytics } from '@/components/DashboardAnalytics';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [assignments, setAssignments] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [pendingKyc, setPendingKyc] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, allotted: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  
  const [auditorDetails, setAuditorDetails] = useState<Record<string, any>>({});

  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [kycDetailOpen, setKycDetailOpen] = useState(false);
  const [appDetailOpen, setAppDetailOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  
  // Edit & Reallocation State
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reallocateDialogOpen, setReallocateDialogOpen] = useState(false);
  const [reallocationList, setReallocationList] = useState<any[]>([]);
  const [selectedAssignmentForRealloc, setSelectedAssignmentForRealloc] = useState<string | null>(null);

  const [selectedAssignmentForRating, setSelectedAssignmentForRating] = useState<string | null>(null);
  const [viewingKycProfile, setViewingKycProfile] = useState<any>(null);
  const [viewingApplication, setViewingApplication] = useState<any>(null);
  const [selectedKycUser, setSelectedKycUser] = useState<string | null>(null);
  
  const [applicantPhotoUrl, setApplicantPhotoUrl] = useState<string | null>(null);
  const [kycPhotoUrl, setKycPhotoUrl] = useState<string | null>(null);
  
  const [tempRating, setTempRating] = useState(0);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterAuditType, setFilterAuditType] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);

  useEffect(() => { fetchData(); }, []);

  // Fetch Photo for Applications
  useEffect(() => {
    const fetchAppImage = async () => {
      if (viewingApplication && auditorDetails[viewingApplication.auditor_id]) {
        const path = auditorDetails[viewingApplication.auditor_id].profile_photo_url;
        if (path) {
          if (path.startsWith('http') || path.startsWith('https')) {
            setApplicantPhotoUrl(path);
          } else {
            const { data } = await supabase.storage.from('kyc-documents').createSignedUrl(path, 3600);
            setApplicantPhotoUrl(data?.signedUrl || null);
          }
        } else {
          setApplicantPhotoUrl(null);
        }
      }
    };
    if (appDetailOpen) fetchAppImage(); else setApplicantPhotoUrl(null);
  }, [viewingApplication, appDetailOpen, auditorDetails]);

  // Fetch Photo for KYC Details
  useEffect(() => {
    const fetchKycImage = async () => {
      if (viewingKycProfile?.profile_photo_url) {
        const path = viewingKycProfile.profile_photo_url;
        if (path.startsWith('http') || path.startsWith('https')) {
          setKycPhotoUrl(path);
        } else {
          const { data } = await supabase.storage.from('kyc-documents').createSignedUrl(path, 3600);
          setKycPhotoUrl(data?.signedUrl || null);
        }
      } else {
        setKycPhotoUrl(null);
      }
    };
    if (kycDetailOpen) fetchKycImage(); else setKycPhotoUrl(null);
  }, [viewingKycProfile, kycDetailOpen]);

  const handleTabChange = (tab: string) => setSearchParams({ tab });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assignmentsResult, applicationsResult, kycResult] = await Promise.allSettled([
        supabase.from('assignments').select('*').order('created_at', { ascending: false }),
        
        supabase.from('applications')
          .select(`*, interest_reason, assignment:assignments(client_name, branch_name, city, state, assignment_number), auditor:profiles(full_name, email, id, phone)`)
          .eq('status', 'pending')
          .order('applied_at', { ascending: false }),

        supabase.from('auditor_profiles')
          .select(`*, profiles(full_name, email, phone)`) 
          .eq('kyc_status', 'pending')
          .order('created_at', { ascending: false })
      ]);

      if (assignmentsResult.status === 'fulfilled' && assignmentsResult.value.data) {
        const data = assignmentsResult.value.data;
        setAssignments(data);
        setStats({
          total: data.length,
          open: data.filter(a => a.status === 'open').length,
          allotted: data.filter(a => a.status === 'allotted' || a.status === 'in_progress').length,
          completed: data.filter(a => a.status === 'completed' || a.status === 'paid').length
        });
      }

      if (applicationsResult.status === 'fulfilled' && applicationsResult.value.data) {
        const apps = applicationsResult.value.data;
        setApplications(apps);
        
        if (apps.length > 0) {
          const auditorIds = apps.map(app => app.auditor_id);
          const { data: profilesData } = await supabase
            .from('auditor_profiles')
            .select('*')
            .in('user_id', auditorIds);
            
          const detailsMap: Record<string, any> = {};
          profilesData?.forEach(profile => { 
            detailsMap[profile.user_id] = profile;
          });
          setAuditorDetails(detailsMap);
        }
      }

      if (kycResult.status === 'fulfilled' && kycResult.value.data) {
        setPendingKyc(kycResult.value.data);
      }

    } catch (error: any) {
      toast.error("Error loading dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const uniqueStates = useMemo(() => {
    const s = new Set(assignments.map(a => a.state).filter(Boolean));
    return Array.from(s).sort();
  }, [assignments]);

  const uniqueCities = useMemo(() => {
    const c = new Set(assignments.map(a => a.city).filter(Boolean));
    return Array.from(c).sort();
  }, [assignments]);

  const uniqueAuditTypes = useMemo(() => {
    const t = new Set(assignments.map(a => a.audit_type).filter(Boolean));
    return Array.from(t).sort();
  }, [assignments]);

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
    setFilterStatus('all');
    setFilterState('all');
    setFilterCity('all');
    setFilterAuditType('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchQuery('');
  };

  const groupedApplications = useMemo(() => {
    const grouped: Record<string, { assignment: any, applicants: any[] }> = {};
    applications.forEach(app => {
      const assignId = app.assignment_id;
      if (!grouped[assignId]) {
        grouped[assignId] = { assignment: app.assignment, applicants: [] };
      }
      grouped[assignId].applicants.push(app);
    });
    return grouped;
  }, [applications]);

  const openApplicationDetail = (app: any) => { setViewingApplication(app); setAppDetailOpen(true); };

  const handleEditAssignment = (assignment: any) => {
    setEditingAssignment(assignment);
    setEditDialogOpen(true);
  };

  const handleAllotAssignment = async (applicationId: string, assignmentId: string, auditorId: string) => {
    try {
      const { data: assignment } = await supabase.from('assignments').select('client_name, city').eq('id', assignmentId).single();
      
      const { error: assignError } = await supabase.from('assignments').update({ status: 'allotted', allotted_to: auditorId }).eq('id', assignmentId);
      if (assignError) throw assignError;

      await supabase.from('applications').update({ status: 'accepted' }).eq('id', applicationId);
      
      await supabase.from('notifications').insert({
        user_id: auditorId,
        title: 'Application Accepted! 🎉',
        message: `You have been selected for the audit of ${assignment?.client_name} in ${assignment?.city}. Check 'My Assignments' for details.`,
        type: 'success',
        related_assignment_id: assignmentId,
        read: false
      });

      const { data: rejectedApps } = await supabase.from('applications').select('id, auditor_id').eq('assignment_id', assignmentId).neq('id', applicationId);

      if (rejectedApps && rejectedApps.length > 0) {
        const rejectedIds = rejectedApps.map(a => a.id);
        await supabase.from('applications').update({ status: 'rejected' }).in('id', rejectedIds);

        const notifications = rejectedApps.map(app => ({
          user_id: app.auditor_id,
          title: 'Application Update',
          message: `Thank you for your interest in ${assignment?.client_name}. Another auditor was selected for this assignment.`,
          type: 'info',
          related_assignment_id: assignmentId,
          read: false
        }));
        await supabase.from('notifications').insert(notifications);
      }

      toast.success('Assignment allotted & notifications sent!');
      setAppDetailOpen(false);
      fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const handleOpenReallocate = async (assignmentId: string) => {
    setSelectedAssignmentForRealloc(assignmentId);
    setReallocationList([]);
    setReallocateDialogOpen(true);

    try {
      const { data: apps, error } = await supabase
        .from('applications')
        .select(`*, auditor:profiles(full_name, email, phone)`)
        .eq('assignment_id', assignmentId);

      if (error) throw error;
      if (!apps) return;

      const auditorIds = apps.map(a => a.auditor_id);
      const { data: profiles } = await supabase
        .from('auditor_profiles')
        .select('*')
        .in('user_id', auditorIds);
      
      if (profiles) {
        const newDetailsMap: Record<string, any> = {};
        profiles.forEach(profile => { newDetailsMap[profile.user_id] = profile; });
        setAuditorDetails(prev => ({ ...prev, ...newDetailsMap }));
      }
      
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
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    if (!confirm('Are you sure you want to reject this application?')) return;
    try {
      const { error } = await supabase.from('applications').delete().eq('id', applicationId);
      if (error) throw error;
      toast.success('Application rejected.');
      setAppDetailOpen(false);
      fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const handleKycApproval = async (uid: string, status: string, reason?: string) => { 
    try { 
      await supabase.from('auditor_profiles').update({ kyc_status: status, rejection_reason: reason || null }).eq('user_id', uid); 
      toast.success(`KYC ${status}`); 
      setKycDetailOpen(false); 
      setRejectionDialogOpen(false); 
      fetchData(); 
    } catch (err: any) { toast.error(err.message); } 
  };
  
  const handleDownloadResume = async (path: string) => { 
    if(!path) return; 
    try { 
      if (path.startsWith('http')) {
        window.open(path, '_blank');
        return;
      }
      const {data} = await supabase.storage.from('kyc-documents').createSignedUrl(path, 3600); 
      if(data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        toast.error("Could not generate download link");
      }
    } catch(e:any) { toast.error(e.message); } 
  };

  const handleDeleteAssignment = async (id: string) => { 
    if(confirm('Are you sure you want to delete this assignment?')) { 
      await supabase.from('assignments').delete().eq('id', id); 
      fetchData(); 
      toast.success('Assignment deleted successfully');
    } 
  };
  
  const submitRating = async () => { 
    if(selectedAssignmentForRating && tempRating > 0) { 
      await supabase.from('assignments').update({ status: 'completed', auditor_rating: tempRating, completed_at: new Date().toISOString() }).eq('id', selectedAssignmentForRating); 
      setRatingDialogOpen(false); 
      fetchData(); 
      toast.success('Rated!'); 
    } 
  };
  
  const openViewDetails = (p: any) => { setViewingKycProfile(p); setKycDetailOpen(true); };
  const toggleAssignmentSelection = (id: string) => setSelectedAssignments(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedAssignments(selectedAssignments.length === filteredAssignments.length ? [] : filteredAssignments.map(a => a.id));

  return (
    <DashboardLayout title="Admin Dashboard" navItems={adminNavItems} activeTab={activeTab} onTabChange={handleTabChange}>
      
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-3xl">{stats.total}</CardTitle><CardDescription>Total</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-3xl">{stats.open}</CardTitle><CardDescription>Open</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-3xl">{stats.allotted}</CardTitle><CardDescription>Allotted</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-3xl">{stats.completed}</CardTitle><CardDescription>Completed</CardDescription></CardHeader></Card>
          </div>
          <DashboardAnalytics assignments={assignments} />
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <CreateAssignmentDialog onAssignmentCreated={fetchData} />
            <BulkUploadDialog userId={user?.id || ''} onSuccess={fetchData} />
          </div>

          <AssignmentFilters 
            filterStatus={filterStatus}
            filterState={filterState}
            filterCity={filterCity}
            filterAuditType={filterAuditType}
            filterDateFrom={filterDateFrom}
            filterDateTo={filterDateTo}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
            states={uniqueStates}
            cities={uniqueCities}
            auditTypes={uniqueAuditTypes}
          />
          
          <AssignmentSearchExport assignments={filteredAssignments} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={selectedAssignments.length > 0 && selectedAssignments.length === filteredAssignments.length} onCheckedChange={toggleSelectAll} /></TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Audit Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map(a => (
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
                        <div className="flex gap-2">
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
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'applications' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Pending Applications</h2>
            <Badge variant="secondary">{applications.length} total pending</Badge>
          </div>

          {applications.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No pending applications</CardContent></Card>
          ) : (
            Object.entries(groupedApplications).map(([assignmentId, group]) => (
              <Card key={assignmentId} className="border-l-4 border-l-primary shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 pb-3 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{group.assignment.client_name} - {group.assignment.branch_name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <MapPin className="h-3 w-3" /> {group.assignment.city}, {group.assignment.state}
                        <span className="text-muted-foreground/30">•</span>
                        <span>{group.assignment.audit_type}</span>
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-background">{group.applicants.length} Applicants</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/5 hover:bg-muted/5">
                        <TableHead className="w-[30%]">Auditor Details</TableHead>
                        <TableHead>Experience</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Applied On</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.applicants.map((app: any) => {
                        const details = auditorDetails[app.auditor_id] || {};
                        return (
                          <TableRow key={app.id}>
                            <TableCell>
                              <div className="font-medium text-base">{app.auditor?.full_name}</div>
                              <div className="text-xs text-muted-foreground flex flex-col gap-0.5 mt-0.5">
                                <span className="flex items-center gap-1"><Mail className="h-3 w-3"/> {app.auditor?.email}</span>
                                <span className="flex items-center gap-1"><Phone className="h-3 w-3"/> {app.auditor?.phone || 'N/A'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{details.experience_years || 0} Years</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-full w-fit">
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                <span className="text-xs font-semibold text-amber-700">{details.rating || 0}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(app.applied_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" onClick={() => openApplicationDetail(app)}>
                                Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'kyc-approvals' && (
        <Card>
          <CardHeader><CardTitle>Pending KYC Approvals</CardTitle></CardHeader>
          <CardContent>
            {pendingKyc.length === 0 ? <p className="text-center py-8 text-muted-foreground">No pending KYC applications</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Auditor Name</TableHead><TableHead>Location</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {pendingKyc.map(kyc => (
                    <TableRow key={kyc.id}>
                      <TableCell className="font-medium">
                        {kyc.profiles?.full_name}
                        <div className="text-xs text-muted-foreground">{kyc.profiles?.email}</div>
                      </TableCell>
                      <TableCell>{kyc.base_city}, {kyc.base_state}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => openViewDetails(kyc)}><Eye className="h-4 w-4 mr-1"/> Review KYC</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'deadlines' && <DeadlineReminders />}
      {activeTab === 'reports' && <ReportsManagement />}
      {activeTab === 'user-roles' && <UserRoleManagement />}

      {/* --- DIALOGS --- */}
      
      {/* Reallocate Assignment Dialog */}
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
                 {reallocationList.length === 0 ? (
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
                                  <Button size="sm" variant="ghost" onClick={() => openApplicationDetail(app)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" onClick={() => confirmReallocation(app.id, app.auditor_id)}>
                                     Assign
                                  </Button>
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
          <DialogFooter>
             <Button variant="outline" onClick={() => setReallocateDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Application Detail Dialog */}
      <Dialog open={appDetailOpen} onOpenChange={setAppDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Application Review</DialogTitle>
            <DialogDescription>Detailed analysis of applicant profile</DialogDescription>
          </DialogHeader>
          
          {viewingApplication && auditorDetails[viewingApplication.auditor_id] ? (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/10 p-4 rounded-xl border">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                     <Avatar className="h-14 w-14 border-2 border-primary/20">
                        <AvatarImage src={applicantPhotoUrl || ''} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                          {viewingApplication.auditor?.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                     </Avatar>
                     
                     <div>
                        <h3 className="font-bold text-lg">{viewingApplication.auditor?.full_name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" /> 
                          {auditorDetails[viewingApplication.auditor_id].base_city}, {auditorDetails[viewingApplication.auditor_id].base_state}
                        </div>
                     </div>
                  </div>
                  
                  <div className="space-y-1 pt-2">
                     <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground"/> {viewingApplication.auditor?.email}</div>
                     <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground"/> {viewingApplication.auditor?.phone || 'N/A'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-background p-3 rounded-lg border">
                      <div className="text-xs text-muted-foreground uppercase font-bold">Experience</div>
                      <div className="text-lg font-semibold">{auditorDetails[viewingApplication.auditor_id].experience_years} Years</div>
                   </div>
                   <div className="bg-background p-3 rounded-lg border">
                      <div className="text-xs text-muted-foreground uppercase font-bold">Rating</div>
                      <div className="flex items-center gap-1 text-lg font-semibold">
                         {auditorDetails[viewingApplication.auditor_id].rating} <Star className="h-4 w-4 text-amber-500 fill-amber-500"/>
                      </div>
                   </div>
                   <div className="bg-background p-3 rounded-lg border col-span-2">
                      <div className="text-xs text-muted-foreground uppercase font-bold">Core Competency</div>
                      <div className="font-medium text-primary">{auditorDetails[viewingApplication.auditor_id].core_competency || 'N/A'}</div>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-4">
                    <div>
                       <Label className="flex items-center gap-2 mb-2"><GraduationCap className="h-4 w-4"/> Qualifications</Label>
                       <div className="flex flex-wrap gap-2">
                          {auditorDetails[viewingApplication.auditor_id].qualifications?.map((q: string) => (
                             <Badge key={q} variant="secondary">{q}</Badge>
                          )) || <span className="text-sm text-muted-foreground">None listed</span>}
                       </div>
                    </div>

                    <div>
                       <Label className="flex items-center gap-2 mb-2"><Briefcase className="h-4 w-4"/> Competencies</Label>
                       <div className="flex flex-wrap gap-2">
                          {auditorDetails[viewingApplication.auditor_id].competencies?.map((c: string) => (
                             <Badge key={c} variant="outline">{c}</Badge>
                          )) || <span className="text-sm text-muted-foreground">None listed</span>}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div>
                       <Label className="flex items-center gap-2 mb-2"><Users className="h-4 w-4"/> Team Availability</Label>
                       <div className="p-3 border rounded-md text-sm">
                          {auditorDetails[viewingApplication.auditor_id].has_manpower ? (
                             <span className="text-green-600 font-medium flex items-center gap-2">
                                <Users className="h-4 w-4"/> Yes, Team of {auditorDetails[viewingApplication.auditor_id].manpower_count}
                             </span>
                          ) : (
                             <span className="text-muted-foreground">Individual Auditor (No Manpower)</span>
                          )}
                       </div>
                    </div>

                    <div>
                       <Label className="flex items-center gap-2 mb-2"><Navigation className="h-4 w-4"/> Travel & Logistics</Label>
                       <div className="p-3 border rounded-md text-sm space-y-2">
                          <div className="flex justify-between">
                             <span className="text-muted-foreground">Travel Radius:</span>
                             <span className="font-medium">{auditorDetails[viewingApplication.auditor_id].willing_to_travel_radius} km</span>
                          </div>
                          <div className="flex justify-between items-start">
                             <span className="text-muted-foreground whitespace-nowrap mr-2">Preferred States:</span>
                             <span className="font-medium text-right flex flex-wrap justify-end gap-1">
                                {auditorDetails[viewingApplication.auditor_id].preferred_states?.join(', ') || 'None'}
                             </span>
                          </div>
                          
                          <div className="border-t pt-2 mt-2">
                             <span className="text-muted-foreground block mb-1">Available Assets:</span>
                             <div className="flex gap-4">
                                <span className={auditorDetails[viewingApplication.auditor_id].has_smartphone ? "text-green-600 font-medium" : "text-muted-foreground line-through opacity-50"}>Smartphone</span>
                                <span className={auditorDetails[viewingApplication.auditor_id].has_laptop ? "text-green-600 font-medium" : "text-muted-foreground line-through opacity-50"}>Laptop</span>
                                <span className={auditorDetails[viewingApplication.auditor_id].has_bike ? "text-green-600 font-medium" : "text-muted-foreground line-through opacity-50"}>Two-Wheeler</span>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div>
                <Label className="flex items-center gap-2 text-primary font-semibold mb-2">
                  <MessageSquare className="h-4 w-4" /> Why they applied (Interest Reason)
                </Label>
                <div className="bg-muted/30 p-4 rounded-lg text-sm italic border border-l-4 border-l-primary">
                  "{viewingApplication.interest_reason || 'No specific reason provided.'}"
                </div>
              </div>

              {auditorDetails[viewingApplication.auditor_id].resume_url && (
                 <div className="flex justify-start">
                    <Button variant="outline" onClick={() => handleDownloadResume(auditorDetails[viewingApplication.auditor_id].resume_url)}>
                       <Download className="h-4 w-4 mr-2" /> Download Applicant's Resume
                    </Button>
                 </div>
              )}

              <Separator />

              <DialogFooter className="gap-2 sm:gap-0 sticky bottom-0 bg-background pt-2">
                <Button variant="outline" onClick={() => setAppDetailOpen(false)}>Close Review</Button>
                <Button variant="destructive" onClick={() => handleDeleteApplication(viewingApplication.id)}>Reject Application</Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleAllotAssignment(viewingApplication.id, viewingApplication.assignment_id, viewingApplication.auditor_id)}>
                  Accept & Allot Assignment
                </Button>
              </DialogFooter>
            </div>
          ) : (
             <div className="py-10 text-center text-muted-foreground">Loading profile details...</div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* KYC Profile Detail Dialog */}
      <Dialog open={kycDetailOpen} onOpenChange={setKycDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-2xl">Auditor Profile Review (KYC)</DialogTitle></DialogHeader>
          {viewingKycProfile ? (
            <div className="space-y-6 py-4">
              
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/10 p-4 rounded-xl border">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                     <Avatar className="h-14 w-14 border-2 border-primary/20">
                        <AvatarImage src={kycPhotoUrl || ''} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                          {viewingKycProfile.profiles?.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                     </Avatar>
                     <div>
                        <h3 className="font-bold text-lg">{viewingKycProfile.profiles?.full_name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" /> 
                          {viewingKycProfile.base_city}, {viewingKycProfile.base_state}
                        </div>
                     </div>
                  </div>
                  
                  <div className="space-y-1 pt-2">
                     <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground"/> {viewingKycProfile.profiles?.email}</div>
                     <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground"/> {viewingKycProfile.profiles?.phone || 'N/A'}</div>
                     <div className="text-sm text-muted-foreground break-words mt-2 p-2 bg-background border rounded">
                         <span className="font-semibold text-foreground">Address:</span> {viewingKycProfile.address || 'N/A'}
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-background p-3 rounded-lg border">
                      <div className="text-xs text-muted-foreground uppercase font-bold">Experience</div>
                      <div className="text-lg font-semibold">{viewingKycProfile.experience_years || 0} Years</div>
                   </div>
                   <div className="bg-background p-3 rounded-lg border">
                      <div className="text-xs text-muted-foreground uppercase font-bold">GST Number</div>
                      <div className="font-medium">{viewingKycProfile.gst_number || 'N/A'}</div>
                   </div>
                   <div className="bg-background p-3 rounded-lg border col-span-2">
                      <div className="text-xs text-muted-foreground uppercase font-bold">Core Competency</div>
                      <div className="font-medium text-primary">{viewingKycProfile.core_competency || 'N/A'}</div>
                   </div>
                </div>
              </div>

              {/* Detailed Capabilities & Logistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-4">
                    <div>
                       <Label className="flex items-center gap-2 mb-2"><GraduationCap className="h-4 w-4"/> Qualifications</Label>
                       <div className="flex flex-wrap gap-2">
                          {viewingKycProfile.qualifications?.length > 0 ? viewingKycProfile.qualifications.map((q: string) => (
                             <Badge key={q} variant="secondary">{q}</Badge>
                          )) : <span className="text-sm text-muted-foreground">None listed</span>}
                       </div>
                    </div>

                    <div>
                       <Label className="flex items-center gap-2 mb-2"><Briefcase className="h-4 w-4"/> Competencies</Label>
                       <div className="flex flex-wrap gap-2">
                          {viewingKycProfile.competencies?.length > 0 ? viewingKycProfile.competencies.map((c: string) => (
                             <Badge key={c} variant="outline">{c}</Badge>
                          )) : <span className="text-sm text-muted-foreground">None listed</span>}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div>
                       <Label className="flex items-center gap-2 mb-2"><Users className="h-4 w-4"/> Team Availability</Label>
                       <div className="p-3 border rounded-md text-sm">
                          {viewingKycProfile.has_manpower ? (
                             <span className="text-green-600 font-medium flex items-center gap-2">
                                <Users className="h-4 w-4"/> Yes, Team of {viewingKycProfile.manpower_count}
                             </span>
                          ) : (
                             <span className="text-muted-foreground">Individual Auditor (No Manpower)</span>
                          )}
                       </div>
                    </div>

                    <div>
                       <Label className="flex items-center gap-2 mb-2"><Navigation className="h-4 w-4"/> Travel & Logistics</Label>
                       <div className="p-3 border rounded-md text-sm space-y-2">
                          <div className="flex justify-between">
                             <span className="text-muted-foreground">Travel Radius:</span>
                             <span className="font-medium">{viewingKycProfile.willing_to_travel_radius || 0} km</span>
                          </div>
                          <div className="flex justify-between items-start">
                             <span className="text-muted-foreground whitespace-nowrap mr-2">Preferred States:</span>
                             <span className="font-medium text-right flex flex-wrap justify-end gap-1">
                                {viewingKycProfile.preferred_states?.length > 0 ? viewingKycProfile.preferred_states.map((s: string) => <Badge variant="secondary" className="text-[10px]" key={s}>{s}</Badge>) : 'None'}
                             </span>
                          </div>
                          
                          <div className="border-t pt-2 mt-2">
                             <span className="text-muted-foreground block mb-1">Available Assets:</span>
                             <div className="flex gap-4">
                                <span className={viewingKycProfile.has_smartphone ? "text-green-600 font-medium" : "text-muted-foreground line-through opacity-50"}>Smartphone</span>
                                <span className={viewingKycProfile.has_laptop ? "text-green-600 font-medium" : "text-muted-foreground line-through opacity-50"}>Laptop</span>
                                <span className={viewingKycProfile.has_bike ? "text-green-600 font-medium" : "text-muted-foreground line-through opacity-50"}>Two-Wheeler</span>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <Separator />
              
              {/* Documents */}
              <div>
                <Label className="mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> Uploaded Documents</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  {viewingKycProfile.resume_url ? (
                    <Button variant="outline" className="h-auto py-3 justify-start" onClick={() => handleDownloadResume(viewingKycProfile.resume_url)}>
                      <Download className="mr-2 h-4 w-4" /> Download Resume
                    </Button>
                  ) : (
                    <div className="p-3 border rounded text-sm text-muted-foreground italic text-center">No Resume Uploaded</div>
                  )}
                  
                  {viewingKycProfile.profile_photo_url ? (
                    <Button variant="outline" className="h-auto py-3 justify-start" onClick={() => handleDownloadResume(viewingKycProfile.profile_photo_url)}>
                      <Eye className="mr-2 h-4 w-4" /> View Profile Photo
                    </Button>
                  ) : (
                    <div className="p-3 border rounded text-sm text-muted-foreground italic text-center">No Photo Uploaded</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground">Loading details...</div>
          )}
          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setKycDetailOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setKycDetailOpen(false); setSelectedKycUser(viewingKycProfile?.user_id); setRejectionDialogOpen(true); }}>Reject KYC</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleKycApproval(viewingKycProfile?.user_id, 'approved')}>Approve KYC</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Application</DialogTitle></DialogHeader>
          <textarea className="w-full border rounded p-2" placeholder="Reason..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectionDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleKycApproval(selectedKycUser!, 'rejected', rejectionReason)}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* General Rating Dialog */}
      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rate Auditor</DialogTitle></DialogHeader>
          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map((r) => (
              <button key={r} onClick={() => setTempRating(r)}>
                <Star className={`h-10 w-10 ${r <= tempRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={submitRating} disabled={tempRating === 0}>Complete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      <EditAssignmentDialog 
        assignment={editingAssignment}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchData}
      />
      
    </DashboardLayout>
  );
}