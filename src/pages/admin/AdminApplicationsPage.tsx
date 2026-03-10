import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Star, MapPin, Phone, Mail, MessageSquare, Landmark, ShieldAlert, UserCheck, Building2, UserCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';
import { ApprovalDiffView } from '@/components/ApprovalDiffView';

export default function AdminApplicationsPage() {
  const queryClient = useQueryClient();
  const [applications, setApplications] = useState<any[]>([]);
  const [auditorDetails, setAuditorDetails] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  
  // Dialog States
  const [appDetailOpen, setAppDetailOpen] = useState(false);
  const [viewingApplication, setViewingApplication] = useState<any>(null);
  const [applicantPhotoUrl, setApplicantPhotoUrl] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<any>(null);

  // KYC States
  const [selectedKycAuditor, setSelectedKycAuditor] = useState<any>(null);
  const [reviewType, setReviewType] = useState<'Profile' | 'Bank' | null>(null);

  useEffect(() => {
    fetchJobApplications();
  }, []);

  const fetchJobApplications = async () => {
    setLoading(true);
    try {
      const { data: apps, error } = await supabase
        .from('applications')
        .select(`*, interest_reason, assignment:assignments(client_name, branch_name, city, state, assignment_number, audit_type), auditor:profiles(full_name, email, id, phone)`)
        .eq('status', 'pending')
        .order('applied_at', { ascending: false });

      if (error) throw error;

      if (apps) {
        // FIX: Normalize data so it never crashes if Supabase returns an array or null
        const normalizedApps = apps.map(app => ({
          ...app,
          assignment: Array.isArray(app.assignment) ? app.assignment[0] : (app.assignment || {}),
          auditor: Array.isArray(app.auditor) ? app.auditor[0] : (app.auditor || {})
        }));

        setApplications(normalizedApps);

        if (normalizedApps.length > 0) {
          const auditorIds = normalizedApps.map(app => app.auditor_id);
          const { data: profilesData } = await supabase
            .from('auditor_profiles')
            .select('*')
            .in('user_id', auditorIds);
            
          const detailsMap: Record<string, any> = {};
          profilesData?.forEach(profile => { detailsMap[profile.user_id] = profile; });
          setAuditorDetails(detailsMap);
        }
      }
    } catch (error: any) {
      toast.error("Error loading applications data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const { data: pendingKyc = [], isLoading: kycLoading } = useQuery({
    queryKey: ['pending-kyc-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auditor_profiles')
        .select(`*, profiles(full_name, email, phone)`)
        .or('profile_status.eq.pending,bank_status.eq.pending') 
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // FIX: Normalize joined profile data to prevent crashes
      return (data || []).map(kyc => ({
        ...kyc,
        profiles: Array.isArray(kyc.profiles) ? kyc.profiles[0] : (kyc.profiles || {})
      }));
    }
  });

  const pendingProfiles = pendingKyc.filter((k: any) => k.profile_status === 'pending');
  const pendingBanks = pendingKyc.filter((k: any) => k.bank_status === 'pending');

  const resolveApplication = useMutation({
    mutationFn: async ({ id, action, type, pendingData, userId }: { id: string, action: 'approve' | 'reject', type: 'Profile' | 'Bank', pendingData: any, userId: string }) => {
      const updatePayload: any = {};
      const safeData = pendingData || {}; // Prevent null pointer crash

      if (type === 'Profile') {
        if (action === 'approve') {
          Object.assign(updatePayload, safeData); 
          updatePayload.profile_status = 'approved';
          await supabase.from('profiles').update({ role: 'auditor' }).eq('id', userId);
        } else {
          updatePayload.profile_status = 'rejected';
        }
        updatePayload.pending_profile_data = {}; 
      } else {
        if (action === 'approve') {
          const { data: existingBank } = await supabase.from('bank_kyc_details').select('id').eq('user_id', userId).maybeSingle();
          if (existingBank) {
             await supabase.from('bank_kyc_details').update(safeData).eq('user_id', userId);
          } else {
             await supabase.from('bank_kyc_details').insert({ user_id: userId, ...safeData });
          }
          updatePayload.bank_status = 'approved';
        } else {
          updatePayload.bank_status = 'rejected';
        }
        updatePayload.pending_bank_data = {}; 
      }

      const { error } = await supabase
        .from('auditor_profiles')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`${variables.type} changes ${variables.action}d successfully.`);
      setSelectedKycAuditor(null);
      setReviewType(null);
      queryClient.invalidateQueries({ queryKey: ['pending-kyc-applications'] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to process application.");
    }
  });

  const handleReviewKycClick = async (auditor: any, type: 'Profile' | 'Bank') => {
    setSelectedKycAuditor(auditor);
    setReviewType(type);
    
    if (type === 'Bank') {
       await fetchBankDetails(auditor.user_id);
    }
  };

  const fetchBankDetails = async (userId: string) => {
    setBankDetails(null); 
    try {
      const { data, error } = await supabase.from('bank_kyc_details').select('*').eq('user_id', userId).maybeSingle();
      if (!error && data) setBankDetails(data);
    } catch (error) { console.error("Failed to fetch bank details", error); }
  };

  const getDocUrl = (path: string | null) => {
    if (!path) return null;
    return path.startsWith('http') ? path : `https://tcmtmznnjdqjmxetqvdq.supabase.co/storage/v1/object/public/kyc-documents/${path}`;
  };

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
        } else setApplicantPhotoUrl(null);
      }
    };
    if (appDetailOpen) fetchAppImage(); else setApplicantPhotoUrl(null);
  }, [viewingApplication, appDetailOpen, auditorDetails]);

  const groupedApplications = useMemo(() => {
    const grouped: Record<string, { assignment: any, applicants: any[] }> = {};
    applications.forEach(app => {
      const assignId = app.assignment_id;
      if (!grouped[assignId]) {
        grouped[assignId] = { assignment: app.assignment || {}, applicants: [] };
      }
      grouped[assignId].applicants.push(app);
    });
    return grouped;
  }, [applications]);

  const openApplicationDetail = (app: any) => { 
    setViewingApplication(app); 
    setAppDetailOpen(true); 
    fetchBankDetails(app.auditor_id);
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
        message: `You have been selected for the audit of ${assignment?.client_name || 'Client'} in ${assignment?.city || 'Location'}. Check 'My Assignments' for details.`,
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
          message: `Thank you for your interest in ${assignment?.client_name || 'the client'}. Another auditor was selected for this assignment.`,
          type: 'info',
          related_assignment_id: assignmentId,
          read: false
        }));
        await supabase.from('notifications').insert(notifications);
      }

      toast.success('Assignment allotted & notifications sent!');
      setAppDetailOpen(false);
      fetchJobApplications();
    } catch (error: any) { toast.error(error.message); }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    if (!confirm('Are you sure you want to reject this application?')) return;
    try {
      const { error } = await supabase.from('applications').delete().eq('id', applicationId);
      if (error) throw error;
      toast.success('Application rejected.');
      setAppDetailOpen(false);
      fetchJobApplications();
    } catch (error: any) { toast.error(error.message); }
  };

  const renderBankDetails = () => {
    if (!bankDetails) {
      return (
        <div className="text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-center gap-2 mt-4">
          <ShieldAlert className="h-5 w-5" /> This user has not submitted their Bank & Identity details yet.
        </div>
      );
    }

    return (
      <div className="space-y-4 mt-6 animate-in fade-in duration-300">
        <h3 className="text-lg font-bold flex items-center gap-2 border-b pb-2">
          <Landmark className="h-5 w-5 text-[#4338CA]" /> Bank & Identity Verification
        </h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm bg-muted/10 p-4 rounded-xl border">
          <div><span className="text-muted-foreground block mb-1">Bank Account Number</span> <span className="font-medium">{bankDetails.bank_account_no || 'N/A'}</span></div>
          <div><span className="text-muted-foreground block mb-1">IFSC Code</span> <span className="font-medium uppercase">{bankDetails.ifsc_code || 'N/A'}</span></div>
          <div><span className="text-muted-foreground block mb-1">PAN Number</span> <span className="font-medium uppercase">{bankDetails.pan_number || 'N/A'}</span></div>
          <div><span className="text-muted-foreground block mb-1">Aadhaar Number</span> <span className="font-medium">{bankDetails.aadhaar_number || 'N/A'}</span></div>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Uploaded Documents</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-3 flex flex-col items-center justify-center text-center bg-white shadow-sm">
              <span className="text-sm font-semibold mb-2">PAN Card</span>
              {bankDetails.pan_card_url ? <a href={getDocUrl(bankDetails.pan_card_url)!} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4338CA] hover:underline font-medium">View Document</a> : <span className="text-xs text-muted-foreground">Not uploaded</span>}
            </div>
            <div className="border rounded-lg p-3 flex flex-col items-center justify-center text-center bg-white shadow-sm">
              <span className="text-sm font-semibold mb-2">Aadhaar Front</span>
              {bankDetails.aadhaar_front_url ? <a href={getDocUrl(bankDetails.aadhaar_front_url)!} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4338CA] hover:underline font-medium">View Document</a> : <span className="text-xs text-muted-foreground">Not uploaded</span>}
            </div>
            <div className="border rounded-lg p-3 flex flex-col items-center justify-center text-center bg-white shadow-sm">
              <span className="text-sm font-semibold mb-2">Aadhaar Back</span>
              {bankDetails.aadhaar_back_url ? <a href={getDocUrl(bankDetails.aadhaar_back_url)!} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4338CA] hover:underline font-medium">View Document</a> : <span className="text-xs text-muted-foreground">Not uploaded</span>}
            </div>
            <div className="border rounded-lg p-3 flex flex-col items-center justify-center text-center bg-white shadow-sm">
              <span className="text-sm font-semibold mb-2">Cancelled Cheque</span>
              {bankDetails.cancelled_cheque_url ? <a href={getDocUrl(bankDetails.cancelled_cheque_url)!} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4338CA] hover:underline font-medium">View Document</a> : <span className="text-xs text-muted-foreground">Not uploaded</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading || kycLoading) {
     return <DashboardLayout title="Applications & KYC" navItems={adminNavItems} activeTab="applications">
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading applications and KYC data...</div>
     </DashboardLayout>;
  }

  return (
    <DashboardLayout title="Applications & KYC" navItems={adminNavItems} activeTab="applications">
      <div className="space-y-10 max-w-7xl mx-auto py-6">
        
        {/* --- SECTION 1: PENDING JOB APPLICATIONS --- */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Assignment Applications</h2>
            <Badge variant="secondary" className="text-base">{applications.length} pending</Badge>
          </div>

          {applications.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground bg-muted/10 border-dashed">No pending assignment applications</CardContent></Card>
          ) : (
            <div className="grid gap-6">
              {Object.entries(groupedApplications).map(([assignmentId, group]) => (
                <Card key={assignmentId} className="border-l-4 border-l-[#4338CA] shadow-sm overflow-hidden">
                  <CardHeader className="bg-muted/10 pb-3 border-b">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{group.assignment?.client_name || 'Unknown Client'} - {group.assignment?.branch_name || 'N/A'}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <MapPin className="h-3 w-3" /> {group.assignment?.city || 'Unknown'}, {group.assignment?.state || 'Unknown'}
                          <span className="text-muted-foreground/30">•</span>
                          <span>{group.assignment?.audit_type || 'Audit'}</span>
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
                                <div className="font-medium text-base">{app.auditor?.full_name || 'Unknown User'}</div>
                                <div className="text-xs text-muted-foreground flex flex-col gap-0.5 mt-0.5">
                                  <span className="flex items-center gap-1"><Mail className="h-3 w-3"/> {app.auditor?.email || 'N/A'}</span>
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
                                {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : 'Unknown'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" className="border-[#4338CA]/30 text-[#4338CA] hover:bg-[#4338CA]/10" onClick={() => openApplicationDetail(app)}>
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
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* --- SECTION 2: PROFILE APPROVALS --- */}
        <div className="space-y-4">
           <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <UserCircle className="h-6 w-6 text-blue-600" /> Auditor Profile Approvals
            </h2>
            <Badge variant="secondary" className="text-base bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">{pendingProfiles.length} pending</Badge>
          </div>
          
          <Card>
            <CardContent className="p-0">
              {pendingProfiles.length === 0 ? <p className="text-center py-12 text-muted-foreground bg-muted/10 border-dashed border">No pending profiles to review.</p> : (
                <div className="grid gap-0 divide-y">
                  {pendingProfiles.map((kyc: any) => (
                    <div key={kyc.id} className="flex flex-col md:flex-row items-center justify-between p-5 bg-card hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                          {kyc.profiles?.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{kyc.profiles?.full_name || 'Unknown Auditor'}</h4>
                          <p className="text-sm text-muted-foreground">{kyc.profiles?.email || 'No email'}</p>
                        </div>
                      </div>

                      <Button onClick={() => handleReviewKycClick(kyc, 'Profile')} variant="outline" className="w-full md:w-auto border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 shadow-sm">
                        <UserCheck className="h-4 w-4 mr-2" /> Review Profile Details
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* --- SECTION 3: BANK & KYC APPROVALS --- */}
        <div className="space-y-4">
           <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Landmark className="h-6 w-6 text-emerald-600" /> Bank & Identity Approvals
            </h2>
            <Badge variant="secondary" className="text-base bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">{pendingBanks.length} pending</Badge>
          </div>
          
          <Card>
            <CardContent className="p-0">
              {pendingBanks.length === 0 ? <p className="text-center py-12 text-muted-foreground bg-muted/10 border-dashed border">No pending bank details to review.</p> : (
                <div className="grid gap-0 divide-y">
                  {pendingBanks.map((kyc: any) => (
                    <div key={kyc.id} className="flex flex-col md:flex-row items-center justify-between p-5 bg-card hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
                          {kyc.profiles?.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{kyc.profiles?.full_name || 'Unknown Auditor'}</h4>
                          <p className="text-sm text-muted-foreground">{kyc.profiles?.email || 'No email'}</p>
                        </div>
                      </div>

                      <Button onClick={() => handleReviewKycClick(kyc, 'Bank')} variant="outline" className="w-full md:w-auto border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 shadow-sm">
                        <Building2 className="h-4 w-4 mr-2" /> Review Bank & KYC
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* --- DIALOGS --- */}

      {/* JOB Application Detail Dialog */}
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
                        <h3 className="font-bold text-lg">{viewingApplication.auditor?.full_name || 'Unknown Auditor'}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" /> 
                          {auditorDetails[viewingApplication.auditor_id].base_city || 'Unknown'}, {auditorDetails[viewingApplication.auditor_id].base_state || 'Unknown'}
                        </div>
                     </div>
                  </div>
                  <div className="space-y-1 pt-2">
                     <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground"/> {viewingApplication.auditor?.email || 'N/A'}</div>
                     <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground"/> {viewingApplication.auditor?.phone || 'N/A'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-background p-3 rounded-lg border">
                      <div className="text-xs text-muted-foreground uppercase font-bold">Experience</div>
                      <div className="text-lg font-semibold">{auditorDetails[viewingApplication.auditor_id].experience_years || 0} Years</div>
                   </div>
                   <div className="bg-background p-3 rounded-lg border">
                      <div className="text-xs text-muted-foreground uppercase font-bold">Rating</div>
                      <div className="flex items-center gap-1 text-lg font-semibold">
                         {auditorDetails[viewingApplication.auditor_id].rating || 0} <Star className="h-4 w-4 text-amber-500 fill-amber-500"/>
                      </div>
                   </div>
                   <div className="bg-background p-3 rounded-lg border col-span-2">
                      <div className="text-xs text-muted-foreground uppercase font-bold">Core Competency</div>
                      <div className="font-medium text-primary">{auditorDetails[viewingApplication.auditor_id].core_competency || 'N/A'}</div>
                   </div>
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2 text-primary font-semibold mb-2">
                  <MessageSquare className="h-4 w-4" /> Why they applied
                </Label>
                <div className="bg-muted/30 p-4 rounded-lg text-sm italic border border-l-4 border-l-primary">
                  "{viewingApplication.interest_reason || 'No specific reason provided.'}"
                </div>
              </div>

              {renderBankDetails()}

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
      
      {/* --- DIFF MODAL --- */}
      <Dialog open={!!selectedKycAuditor} onOpenChange={(open) => !open && setSelectedKycAuditor(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-0">
          {selectedKycAuditor && reviewType && (
            <ApprovalDiffView 
              type={reviewType}
              currentData={reviewType === 'Profile' ? selectedKycAuditor : (bankDetails || {})} 
              pendingData={reviewType === 'Profile' ? selectedKycAuditor.pending_profile_data : selectedKycAuditor.pending_bank_data}
              isProcessing={resolveApplication.isPending}
              onApprove={() => resolveApplication.mutate({ 
                id: selectedKycAuditor.id, 
                userId: selectedKycAuditor.user_id,
                action: 'approve', 
                type: reviewType, 
                pendingData: reviewType === 'Profile' ? selectedKycAuditor.pending_profile_data : selectedKycAuditor.pending_bank_data 
              })}
              onReject={() => resolveApplication.mutate({ 
                id: selectedKycAuditor.id, 
                userId: selectedKycAuditor.user_id,
                action: 'reject', 
                type: reviewType, 
                pendingData: null 
              })}
            />
          )}
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}