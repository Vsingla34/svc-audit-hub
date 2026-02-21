import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Star, Download, Eye, MapPin, Phone, Mail, MessageSquare, Briefcase, GraduationCap, Users, Navigation, FileText, Landmark, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [pendingKyc, setPendingKyc] = useState<any[]>([]);
  const [auditorDetails, setAuditorDetails] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  
  // Dialog States
  const [appDetailOpen, setAppDetailOpen] = useState(false);
  const [kycDetailOpen, setKycDetailOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);

  // Viewing Data States
  const [viewingApplication, setViewingApplication] = useState<any>(null);
  const [viewingKycProfile, setViewingKycProfile] = useState<any>(null);
  const [selectedKycUser, setSelectedKycUser] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const [applicantPhotoUrl, setApplicantPhotoUrl] = useState<string | null>(null);
  const [kycPhotoUrl, setKycPhotoUrl] = useState<string | null>(null);
  
  // Store bank KYC details for the currently viewed user
  const [bankDetails, setBankDetails] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [applicationsResult, kycResult] = await Promise.allSettled([
        supabase.from('applications')
          .select(`*, interest_reason, assignment:assignments(client_name, branch_name, city, state, assignment_number), auditor:profiles(full_name, email, id, phone)`)
          .eq('status', 'pending')
          .order('applied_at', { ascending: false }),

        supabase.from('auditor_profiles')
          .select(`*, profiles(full_name, email, phone)`) 
          .eq('kyc_status', 'pending')
          .order('created_at', { ascending: false })
      ]);

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
      toast.error("Error loading applications data");
    } finally {
      setLoading(false);
    }
  };

  // Helper to fetch bank details reliably
  const fetchBankDetails = async (userId: string) => {
    setBankDetails(null); // Reset it first
    try {
      console.log("Admin requesting bank details for user:", userId);
      const { data, error } = await supabase
        .from('bank_kyc_details')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (error) throw error;
      
      console.log("Admin received bank details:", data);
      if (data) setBankDetails(data);
    } catch (error) {
      console.error("Failed to fetch bank details", error);
    }
  };

  // Helper to generate document links safely
  const getDocUrl = (path: string | null) => {
    if (!path) return null;
    return path.startsWith('http') 
      ? path 
      : `https://tcmtmznnjdqjmxetqvdq.supabase.co/storage/v1/object/public/kyc-documents/${path}`;
  };

  // Fetch Photos based on open dialogs
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

  // Open Handlers (Triggers the bank detail fetch)
  const openApplicationDetail = (app: any) => { 
    setViewingApplication(app); 
    setAppDetailOpen(true); 
    fetchBankDetails(app.auditor_id);
  };
  
  const openViewDetails = (p: any) => { 
    setViewingKycProfile(p); 
    setKycDetailOpen(true); 
    fetchBankDetails(p.user_id);
  };

  // Actions
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
      if (status === 'approved') {
         await supabase.from('profiles').update({ role: 'auditor' }).eq('id', uid);
      }
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

  // Reusable JSX rendering for Bank Details to avoid state loss issues
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
          <div><span className="text-muted-foreground block mb-1">Bank Account Number</span> <span className="font-medium">{bankDetails.bank_account_no}</span></div>
          <div><span className="text-muted-foreground block mb-1">IFSC Code</span> <span className="font-medium uppercase">{bankDetails.ifsc_code}</span></div>
          <div><span className="text-muted-foreground block mb-1">PAN Number</span> <span className="font-medium uppercase">{bankDetails.pan_number}</span></div>
          <div><span className="text-muted-foreground block mb-1">Aadhaar Number</span> <span className="font-medium">{bankDetails.aadhaar_number}</span></div>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Uploaded Documents</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-3 flex flex-col items-center justify-center text-center bg-white shadow-sm hover:shadow transition-shadow">
              <span className="text-sm font-semibold mb-2">PAN Card</span>
              {bankDetails.pan_card_url ? <a href={getDocUrl(bankDetails.pan_card_url)!} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4338CA] hover:underline font-medium">View Document</a> : <span className="text-xs text-muted-foreground">Not uploaded</span>}
            </div>
            <div className="border rounded-lg p-3 flex flex-col items-center justify-center text-center bg-white shadow-sm hover:shadow transition-shadow">
              <span className="text-sm font-semibold mb-2">Aadhaar Front</span>
              {bankDetails.aadhaar_front_url ? <a href={getDocUrl(bankDetails.aadhaar_front_url)!} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4338CA] hover:underline font-medium">View Document</a> : <span className="text-xs text-muted-foreground">Not uploaded</span>}
            </div>
            <div className="border rounded-lg p-3 flex flex-col items-center justify-center text-center bg-white shadow-sm hover:shadow transition-shadow">
              <span className="text-sm font-semibold mb-2">Aadhaar Back</span>
              {bankDetails.aadhaar_back_url ? <a href={getDocUrl(bankDetails.aadhaar_back_url)!} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4338CA] hover:underline font-medium">View Document</a> : <span className="text-xs text-muted-foreground">Not uploaded</span>}
            </div>
            <div className="border rounded-lg p-3 flex flex-col items-center justify-center text-center bg-white shadow-sm hover:shadow transition-shadow">
              <span className="text-sm font-semibold mb-2">Cancelled Cheque</span>
              {bankDetails.cancelled_cheque_url ? <a href={getDocUrl(bankDetails.cancelled_cheque_url)!} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4338CA] hover:underline font-medium">View Document</a> : <span className="text-xs text-muted-foreground">Not uploaded</span>}
            </div>
            <div className="border rounded-lg p-3 flex flex-col items-center justify-center text-center bg-white shadow-sm hover:shadow transition-shadow">
              <span className="text-sm font-semibold mb-2">UPI QR Code</span>
              {bankDetails.upi_qr_url ? <a href={getDocUrl(bankDetails.upi_qr_url)!} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4338CA] hover:underline font-medium">View Document</a> : <span className="text-xs text-muted-foreground">Optional</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
     return <DashboardLayout title="Applications & KYC" navItems={adminNavItems} activeTab="applications">
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading applications and KYC data...</div>
     </DashboardLayout>;
  }

  return (
    <DashboardLayout title="Applications & KYC" navItems={adminNavItems} activeTab="applications">
      <div className="space-y-8 max-w-7xl mx-auto py-6">
        
        {/* PENDING APPLICATIONS SECTION */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Assignment Applications</h2>
            <Badge variant="secondary" className="text-base">{applications.length} total pending</Badge>
          </div>

          {applications.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No pending assignment applications</CardContent></Card>
          ) : (
            <div className="grid gap-6">
              {Object.entries(groupedApplications).map(([assignmentId, group]) => (
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
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* KYC APPROVALS SECTION */}
        <div className="space-y-6">
           <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">KYC Approvals</h2>
            <Badge variant="secondary" className="text-base">{pendingKyc.length} pending</Badge>
          </div>
          <Card>
            <CardContent className="p-0">
              {pendingKyc.length === 0 ? <p className="text-center py-12 text-muted-foreground">No pending KYC applications</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Auditor Name</TableHead><TableHead>Location</TableHead><TableHead>Submitted On</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pendingKyc.map(kyc => (
                      <TableRow key={kyc.id}>
                        <TableCell className="font-medium">
                          {kyc.profiles?.full_name}
                          <div className="text-xs text-muted-foreground">{kyc.profiles?.email}</div>
                        </TableCell>
                        <TableCell>{kyc.base_city}, {kyc.base_state}</TableCell>
                        <TableCell>{new Date(kyc.updated_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => openViewDetails(kyc)}><Eye className="h-4 w-4 mr-1"/> Review KYC</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* --- DIALOGS --- */}

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

              {/* RENDER BANK DETAILS */}
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
              
              {/* Profile Documents */}
              <div>
                <Label className="mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> Profile Documents</Label>
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

              {/* RENDER BANK DETAILS */}
              {renderBankDetails()}

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
          <textarea className="w-full border rounded p-2 min-h-[100px]" placeholder="Reason for rejection..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectionDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleKycApproval(selectedKycUser!, 'rejected', rejectionReason)}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}