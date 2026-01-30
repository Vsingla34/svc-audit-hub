import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/StatusBadge';
import { Star, Download, Eye, MapPin, Phone, Mail, MessageSquare, Briefcase, GraduationCap, Users, Navigation } from 'lucide-react';
import { BulkUploadDialog } from '@/components/BulkUploadDialog';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { AssignmentSearchExport } from '@/components/AssignmentSearchExport';
import { UserRoleManagement } from '@/components/UserRoleManagement';
import { DeadlineReminders } from '@/components/DeadlineReminders';
import { ReportsManagement } from '@/components/ReportsManagement';
import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DashboardAnalytics } from '@/components/DashboardAnalytics';
import { AuditorsList } from '@/components/AuditorsList';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Import Avatar components

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

  const [selectedAssignmentForRating, setSelectedAssignmentForRating] = useState<string | null>(null);
  const [viewingKycProfile, setViewingKycProfile] = useState<any>(null);
  const [viewingApplication, setViewingApplication] = useState<any>(null);
  const [selectedKycUser, setSelectedKycUser] = useState<string | null>(null);
  
  // New State for the Reviewer's Profile Image URL
  const [applicantPhotoUrl, setApplicantPhotoUrl] = useState<string | null>(null);
  
  const [tempRating, setTempRating] = useState(0);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);

  useEffect(() => { fetchData(); }, []);

  // Effect to fetch/sign the profile image when opening the application review dialog
  useEffect(() => {
    const fetchImage = async () => {
      if (viewingApplication && auditorDetails[viewingApplication.auditor_id]) {
        const path = auditorDetails[viewingApplication.auditor_id].profile_photo_url;
        if (path) {
          if (path.startsWith('http') || path.startsWith('https')) {
            setApplicantPhotoUrl(path);
          } else {
            // It's a private bucket path, sign it
            const { data } = await supabase.storage
              .from('kyc-documents')
              .createSignedUrl(path, 3600); // 1 hour expiry
            if (data?.signedUrl) {
              setApplicantPhotoUrl(data.signedUrl);
            } else {
              setApplicantPhotoUrl(null);
            }
          }
        } else {
          setApplicantPhotoUrl(null);
        }
      }
    };
    
    if (appDetailOpen) {
      fetchImage();
    } else {
      setApplicantPhotoUrl(null); // Reset when closing
    }
  }, [viewingApplication, appDetailOpen, auditorDetails]);


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

  const groupedApplications = useMemo(() => {
    const grouped: Record<string, { assignment: any, applicants: any[] }> = {};
    
    applications.forEach(app => {
      const assignId = app.assignment_id;
      if (!grouped[assignId]) {
        grouped[assignId] = {
          assignment: app.assignment,
          applicants: []
        };
      }
      grouped[assignId].applicants.push(app);
    });
    
    return grouped;
  }, [applications]);

  const openApplicationDetail = (app: any) => { setViewingApplication(app); setAppDetailOpen(true); };

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

      const { data: rejectedApps } = await supabase
        .from('applications')
        .select('id, auditor_id')
        .eq('assignment_id', assignmentId)
        .neq('id', applicationId);

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

  const handleKycApproval = async (uid: string, status: string, reason?: string) => { try { await supabase.from('auditor_profiles').update({ kyc_status: status, rejection_reason: reason || null }).eq('user_id', uid); toast.success(`KYC ${status}`); setKycDetailOpen(false); setRejectionDialogOpen(false); fetchData(); } catch (err: any) { toast.error(err.message); } };
  
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
    } catch(e:any) { 
      toast.error(e.message); 
    } 
  };

  const handleDeleteAssignment = async (id: string) => { if(confirm('Delete?')) { await supabase.from('assignments').delete().eq('id', id); fetchData(); } };
  const handleChangeAllocation = async (id: string) => { await supabase.from('assignments').update({ allotted_to: null, status: 'open' }).eq('id', id); fetchData(); };
  const submitRating = async () => { if(selectedAssignmentForRating && tempRating > 0) { await supabase.from('assignments').update({ status: 'completed', auditor_rating: tempRating, completed_at: new Date().toISOString() }).eq('id', selectedAssignmentForRating); setRatingDialogOpen(false); fetchData(); toast.success('Rated!'); } };
  const openViewDetails = (p: any) => { setViewingKycProfile(p); setKycDetailOpen(true); };

  const filteredAssignments = assignments.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (searchQuery) return a.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) || a.city?.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });
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
          
          <AssignmentSearchExport assignments={filteredAssignments} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={selectedAssignments.length > 0 && selectedAssignments.length === filteredAssignments.length} onCheckedChange={toggleSelectAll} /></TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map(a => (
                    <TableRow key={a.id}>
                      <TableCell><Checkbox checked={selectedAssignments.includes(a.id)} onCheckedChange={() => toggleAssignmentSelection(a.id)} /></TableCell>
                      <TableCell>{a.client_name} - {a.branch_name}</TableCell>
                      <TableCell>{a.city}, {a.state}</TableCell>
                      <TableCell>{new Date(a.audit_date).toLocaleDateString()}</TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteAssignment(a.id)}>Delete</Button>
                          {a.status === 'allotted' && <Button size="sm" variant="outline" onClick={() => handleChangeAllocation(a.id)}>Change</Button>}
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
                        <span>ID: {group.assignment.assignment_number || 'N/A'}</span>
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

      {/* ... Other tabs ... */}
      {activeTab === 'kyc-approvals' && (
        <Card>
          <CardHeader><CardTitle>Pending KYC</CardTitle></CardHeader>
          <CardContent>
            {pendingKyc.length === 0 ? <p className="text-center py-8 text-muted-foreground">No pending KYC</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Location</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                <TableBody>{pendingKyc.map(kyc => (<TableRow key={kyc.id}><TableCell>{kyc.profiles?.full_name}</TableCell><TableCell>{kyc.base_city}</TableCell><TableCell><Button size="sm" onClick={() => openViewDetails(kyc)}><Eye className="h-4 w-4 mr-1"/> View</Button></TableCell></TableRow>))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'deadlines' && <DeadlineReminders />}
      {activeTab === 'auditors' && <AuditorsList />}
      {activeTab === 'reports' && <ReportsManagement />}
      {activeTab === 'user-roles' && <UserRoleManagement />}

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
                     {/* UPDATED: Image Display */}
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
                       <div className="p-3 border rounded-md text-sm space-y-1">
                          <div className="flex justify-between">
                             <span className="text-muted-foreground">Travel Radius:</span>
                             <span className="font-medium">{auditorDetails[viewingApplication.auditor_id].willing_to_travel_radius} km</span>
                          </div>
                          <div className="flex justify-between">
                             <span className="text-muted-foreground">Preferred States:</span>
                             <span className="font-medium text-right max-w-[200px] truncate">
                                {auditorDetails[viewingApplication.auditor_id].preferred_states?.join(', ') || 'None'}
                             </span>
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
      
      {/* ... Other Dialogs (KYC, Rejection, Rating) remain the same ... */}
      <Dialog open={kycDetailOpen} onOpenChange={setKycDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Auditor Profile</DialogTitle></DialogHeader>
          {viewingKycProfile && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Name</Label><div>{viewingKycProfile.profiles?.full_name}</div></div>
                <div><Label>Email</Label><div>{viewingKycProfile.profiles?.email}</div></div>
                <div><Label>Phone</Label><div>{viewingKycProfile.profiles?.phone || 'N/A'}</div></div>
                <div><Label>Location</Label><div>{viewingKycProfile.base_city}, {viewingKycProfile.base_state}</div></div>
              </div>
              <Separator />
              <div>
                <Label>Qualifications</Label>
                <div className="flex gap-2 mt-1">{viewingKycProfile.qualifications?.map((q: string) => <Badge key={q}>{q}</Badge>)}</div>
              </div>
              <div>
                <Label>Documents</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <Card className="p-3"><div className="text-sm text-muted-foreground">PAN</div><div className="font-mono">{viewingKycProfile.pan_card}</div></Card>
                  {viewingKycProfile.resume_url && (
                    <Button variant="outline" className="h-auto py-3 justify-start" onClick={() => handleDownloadResume(viewingKycProfile.resume_url)}>
                      <Download className="mr-2 h-4 w-4" /> Download Resume
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKycDetailOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setKycDetailOpen(false); setSelectedKycUser(viewingKycProfile.user_id); setRejectionDialogOpen(true); }}>Reject</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleKycApproval(viewingKycProfile.user_id, 'approved')}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Rate Auditor</DialogTitle></DialogHeader><div className="flex justify-center gap-2 py-4">{[1, 2, 3, 4, 5].map((r) => (<button key={r} onClick={() => setTempRating(r)}><Star className={`h-10 w-10 ${r <= tempRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} /></button>))}</div><DialogFooter><Button onClick={submitRating} disabled={tempRating === 0}>Complete</Button></DialogFooter></DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}