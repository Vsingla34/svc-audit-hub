import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, ShieldAlert, ShieldCheck, Eye, MapPin, Star, 
  Briefcase, Mail, Phone, User, FileText, ExternalLink, 
  Landmark, GraduationCap, Users, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

interface UserRoleManagementProps {
  filterType: 'verified' | 'unverified';
}

// Helper Component: Safely renders secure expiring links for private KYC documents
function SecureFileLink({ path, label = "View Document" }: { path: string | null, label?: string }) {
  const [url, setUrl] = useState<string>('#');
  
  useEffect(() => {
    if (!path) return;
    if (path.startsWith('http')) { 
      setUrl(path); 
      return; 
    }
    supabase.storage.from('kyc-documents').createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [path]);

  if (!path) return <span className="text-xs text-muted-foreground italic">Not uploaded</span>;
  if (url === '#') return <span className="text-xs text-muted-foreground animate-pulse">Securing link...</span>;
  
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#4338CA] hover:underline flex items-center gap-1 text-sm font-medium w-fit">
      <FileText className="h-3.5 w-3.5" /> {label} <ExternalLink className="h-3 w-3 opacity-70" />
    </a>
  );
}

// Helper Component: Safely renders private profile photos
function SecureAvatar({ path, fallback }: { path: string | null, fallback: string }) {
  const [url, setUrl] = useState<string>('');
  
  useEffect(() => {
    if (!path) return;
    if (path.startsWith('http')) { 
      setUrl(path); 
      return; 
    }
    supabase.storage.from('kyc-documents').createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [path]);

  return (
    <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-sm">
      {url ? <AvatarImage src={url} className="object-cover" /> : null}
      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">{fallback}</AvatarFallback>
    </Avatar>
  );
}

export function UserRoleManagement({ filterType }: UserRoleManagementProps) {
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Fetch users based on their verification status
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users-list', filterType],
    queryFn: async () => {
      // Query auditor_profiles directly and grab ALL extra details, plus join bank_kyc_details
      const { data, error } = await supabase
        .from('auditor_profiles')
        .select(`
          *,
          profiles (
            id,
            full_name,
            email,
            phone,
            bank_kyc_details (*)
          )
        `);

      if (error) {
        toast.error('Failed to load users: ' + error.message);
        throw error;
      }

      // Map the nested data into a clean object, then filter it
      return (data || [])
        .map((row: any) => {
          // Handle potential array wrapping from Supabase joins
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          const bankDetails = profile?.bank_kyc_details 
            ? (Array.isArray(profile.bank_kyc_details) ? profile.bank_kyc_details[0] : profile.bank_kyc_details) 
            : null;
          
          return {
            ...row,
            id: row.user_id, // Normalize ID
            full_name: profile?.full_name,
            email: profile?.email,
            phone: profile?.phone,
            bank_details: bankDetails
          };
        })
        .filter((user: any) => {
          const isProfileApproved = user.profile_status === 'approved';
          const isBankApproved = user.bank_status === 'approved';
          
          // A user is ONLY fully verified if BOTH statuses are approved
          const isFullyVerified = isProfileApproved && isBankApproved;

          if (filterType === 'verified') return isFullyVerified;
          return !isFullyVerified;
        });
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const getStatusBadge = (status: string | undefined | null) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none px-2 py-0.5"><CheckCircle2 className="h-3 w-3 mr-1"/> Approved</Badge>;
      case 'pending':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none px-2 py-0.5">Pending Review</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="px-2 py-0.5">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-500 px-2 py-0.5">Unverified</Badge>;
    }
  };

  return (
    <>
      <Card className="border-t-4 border-t-primary shadow-md">
        <CardHeader className="bg-muted/10 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${filterType === 'verified' ? 'bg-green-100' : 'bg-amber-100'}`}>
              {filterType === 'verified' ? (
                <ShieldCheck className="h-6 w-6 text-green-600" />
              ) : (
                <ShieldAlert className="h-6 w-6 text-amber-600" />
              )}
            </div>
            <div>
              <CardTitle className="text-xl">
                {filterType === 'verified' ? 'Verified Auditors' : 'Unverified & Pending Auditors'}
              </CardTitle>
              <CardDescription className="mt-1">
                {filterType === 'verified'
                  ? 'Auditors who have fully completed their profile and bank KYC.'
                  : 'Auditors with missing, pending, or rejected information.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              <p>Loading user directory...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground bg-muted/5">
              No {filterType} auditors found in the system.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Auditor Details</TableHead>
                  <TableHead>Profile Status</TableHead>
                  <TableHead>Bank & KYC Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: any) => (
                  <TableRow key={user.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary font-bold">
                            {user.full_name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-bold text-foreground">{user.full_name || 'Unknown Name'}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{user.phone || 'No phone provided'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(user.profile_status)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(user.bank_status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedUser(user)}
                        className="text-primary border-primary/20 hover:bg-primary/5"
                      >
                        <Eye className="h-4 w-4 mr-1.5" /> View Full Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* COMPREHENSIVE USER VIEW DIALOG */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <User className="h-6 w-6 text-primary" />
              Comprehensive Auditor Profile
            </DialogTitle>
            <DialogDescription>
              Complete details and verification status for {selectedUser?.full_name || 'this user'}.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6 py-2">
              
              {/* Top Profile Banner */}
              <div className="flex flex-col sm:flex-row gap-5 p-5 bg-muted/10 rounded-xl border items-start sm:items-center">
                <SecureAvatar 
                  path={selectedUser.profile_photo_url} 
                  fallback={selectedUser.full_name?.charAt(0).toUpperCase() || 'U'} 
                />
                <div className="flex-1 space-y-1">
                  <h3 className="font-bold text-xl">{selectedUser.full_name || 'Unknown Name'}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {selectedUser.email || 'N/A'}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {selectedUser.phone || 'N/A'}</span>
                    {selectedUser.rating > 0 && (
                      <span className="flex items-center gap-1 font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Star className="h-3 w-3 fill-amber-500" /> {selectedUser.rating} Rating
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0 bg-white p-3 rounded-lg border shadow-sm w-full sm:w-auto">
                  <div className="flex justify-between items-center gap-4 text-sm">
                    <span className="text-muted-foreground font-medium">Profile</span>
                    {getStatusBadge(selectedUser.profile_status)}
                  </div>
                  <div className="flex justify-between items-center gap-4 text-sm">
                    <span className="text-muted-foreground font-medium">Bank/KYC</span>
                    {getStatusBadge(selectedUser.bank_status)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* LOCATION & CONTACT */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" /> Location & Contact
                  </h4>
                  <div className="space-y-3 bg-muted/5 p-4 rounded-xl border text-sm">
                    <div>
                      <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">Full Address</span>
                      <span className="font-medium">{selectedUser.address || 'Not provided'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">Base Location</span>
                        <span className="font-medium">{selectedUser.base_city || 'N/A'}, {selectedUser.base_state || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">Travel Radius</span>
                        <span className="font-medium">{selectedUser.willing_to_travel_radius ? `${selectedUser.willing_to_travel_radius} KM` : 'N/A'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1 text-xs uppercase tracking-wider font-semibold">Preferred States/Cities</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedUser.preferred_states?.length > 0 || selectedUser.preferred_cities?.length > 0 ? (
                          <>
                            {selectedUser.preferred_states?.map((s: string) => <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>)}
                            {selectedUser.preferred_cities?.map((c: string) => <Badge key={c} variant="outline" className="font-normal">{c}</Badge>)}
                          </>
                        ) : (
                          <span className="italic text-muted-foreground">None specified</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* PROFESSIONAL DETAILS */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" /> Professional Background
                  </h4>
                  <div className="space-y-3 bg-muted/5 p-4 rounded-xl border text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">Experience</span>
                        <span className="font-medium">{selectedUser.experience_years ? `${selectedUser.experience_years} Years` : '0 Years'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">GST Number</span>
                        <span className="font-medium uppercase">{selectedUser.gst_number || 'N/A'}</span>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground block mb-1 text-xs uppercase tracking-wider font-semibold">Core Competency</span>
                      <span className="font-medium text-primary">{selectedUser.core_competency || 'Not specified'}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block mb-1 text-xs uppercase tracking-wider font-semibold">Qualifications</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedUser.qualifications?.length > 0 ? (
                          selectedUser.qualifications.map((q: string) => <Badge key={q} className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none font-medium">{q}</Badge>)
                        ) : (
                          <span className="italic text-muted-foreground">None specified</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground block mb-1 text-xs uppercase tracking-wider font-semibold">Other Competencies</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedUser.competencies?.length > 0 ? (
                          selectedUser.competencies.map((c: string) => <Badge key={c} variant="outline" className="font-normal bg-white">{c}</Badge>)
                        ) : (
                          <span className="italic text-muted-foreground">None specified</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t mt-2 flex justify-between items-center">
                      <div>
                        <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">Manpower / Team</span>
                        <span className="font-medium">
                          {selectedUser.has_manpower ? `Yes (${selectedUser.manpower_count} people)` : 'No additional team'}
                        </span>
                      </div>
                      <SecureFileLink path={selectedUser.resume_url} label="View Resume" />
                    </div>
                  </div>
                </div>

                {/* BANK & IDENTITY DETAILS */}
                <div className="col-span-1 md:col-span-2 space-y-4">
                  <h4 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-primary" /> Bank & Identity Verification
                  </h4>
                  
                  {selectedUser.bank_details ? (
                    <div className="bg-muted/5 p-4 rounded-xl border space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">Account Number</span>
                          <span className="font-medium">{selectedUser.bank_details.bank_account_no || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">IFSC Code</span>
                          <span className="font-medium uppercase">{selectedUser.bank_details.ifsc_code || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">PAN Number</span>
                          <span className="font-medium uppercase">{selectedUser.bank_details.pan_number || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">Aadhaar Number</span>
                          <span className="font-medium">{selectedUser.bank_details.aadhaar_number || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t">
                        <div className="p-3 bg-white border rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                          <span className="text-xs font-semibold mb-2">PAN Card</span>
                          <SecureFileLink path={selectedUser.bank_details.pan_card_url} label="View PDF/IMG" />
                        </div>
                        <div className="p-3 bg-white border rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                          <span className="text-xs font-semibold mb-2">Aadhaar Front</span>
                          <SecureFileLink path={selectedUser.bank_details.aadhaar_front_url} label="View PDF/IMG" />
                        </div>
                        <div className="p-3 bg-white border rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                          <span className="text-xs font-semibold mb-2">Aadhaar Back</span>
                          <SecureFileLink path={selectedUser.bank_details.aadhaar_back_url} label="View PDF/IMG" />
                        </div>
                        <div className="p-3 bg-white border rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                          <span className="text-xs font-semibold mb-2">Cancelled Cheque</span>
                          <SecureFileLink path={selectedUser.bank_details.cancelled_cheque_url} label="View PDF/IMG" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 text-center">
                      <ShieldAlert className="h-8 w-8 text-amber-500 mx-auto mb-2 opacity-50" />
                      <p className="text-amber-700 font-medium">This auditor has not submitted their Bank & Identity documents yet.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
          
          <Separator className="my-2" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Close Profile View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}