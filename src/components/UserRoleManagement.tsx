import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, ShieldAlert, Eye, MapPin, Star, 
  Briefcase, Mail, Phone, User, FileText, ExternalLink, 
  Landmark, CheckCircle2, Users, Search, Send, X
} from 'lucide-react';
import { toast } from 'sonner';

// Helper Component: Instantly resolves the public URL for bucket files
function PublicFileLink({ path, label = "View Document" }: { path: string | null, label?: string }) {
  if (!path) return <span className="text-xs text-muted-foreground italic">Not uploaded</span>;
  
  const url = path.startsWith('http') 
    ? path 
    : supabase.storage.from('kyc-documents').getPublicUrl(path).data.publicUrl;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#4338CA] hover:underline flex items-center gap-1 text-sm font-medium w-fit">
      <FileText className="h-3.5 w-3.5" /> {label} <ExternalLink className="h-3 w-3 opacity-70" />
    </a>
  );
}

// Helper Component: Instantly resolves public profile photos
function PublicAvatar({ path, fallback }: { path: string | null, fallback: string }) {
  const url = path 
    ? (path.startsWith('http') ? path : supabase.storage.from('kyc-documents').getPublicUrl(path).data.publicUrl)
    : '';

  return (
    <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-sm">
      {url ? <AvatarImage src={url} className="object-cover" /> : null}
      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">{fallback}</AvatarFallback>
    </Avatar>
  );
}

export function UserRoleManagement() {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedUserBank, setSelectedUserBank] = useState<any>(null);
  const [isLoadingBank, setIsLoadingBank] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  
  // Search & Pagination States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(50);

  // Bulk Email States
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Reset pagination when tab or search changes
  useEffect(() => {
    setVisibleCount(50);
  }, [activeTab, searchQuery]);

  // Clear selections ONLY when changing main tabs, NOT when searching!
  useEffect(() => {
    setSelectedUserIds(new Set()); 
  }, [activeTab]);

  // Fetch only lightweight profile data in bulk for extreme performance
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['admin-users-directory'],
    queryFn: async () => {
      const [profilesRes, audProfilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('auditor_profiles').select('*'),
        supabase.from('user_roles').select('*')
      ]);

      if (profilesRes.error) {
        toast.error('Failed to load users: ' + profilesRes.error.message);
        throw profilesRes.error;
      }

      const profiles = profilesRes.data || [];
      const auditorProfiles = audProfilesRes.data || [];
      const userRoles = rolesRes.data || [];

      // Map and Categorize Users
      const mappedUsers = profiles.map(profile => {
        const roleRecord = userRoles.find(r => r.user_id === profile.id);
        const audRecord = auditorProfiles.find(a => a.user_id === profile.id);

        const isProfileApproved = audRecord?.profile_status === 'approved';
        const isBankApproved = audRecord?.bank_status === 'approved';

        let category = 'unverified';
        if (isProfileApproved && isBankApproved) {
            category = 'fully_verified';
        } else if (isProfileApproved && !isBankApproved) {
            category = 'profile_verified';
        }

        let profileData = {
          profile_photo_url: audRecord?.profile_photo_url || null,
          rating: audRecord?.rating || 0,
          profile_status: audRecord?.profile_status || 'unverified',
          bank_status: audRecord?.bank_status || 'unverified',
          base_city: audRecord?.base_city || null,
          base_state: audRecord?.base_state || null,
          address: audRecord?.address || null,
          willing_to_travel_radius: audRecord?.willing_to_travel_radius || null,
          preferred_states: audRecord?.preferred_states || [],
          preferred_cities: audRecord?.preferred_cities || [],
          experience_years: audRecord?.experience_years || 0,
          gst_number: audRecord?.gst_number || null,
          core_competency: audRecord?.core_competency || null,
          qualifications: audRecord?.qualifications || [],
          competencies: audRecord?.competencies || [],
          has_manpower: audRecord?.has_manpower || false,
          manpower_count: audRecord?.manpower_count || 0,
          resume_url: audRecord?.resume_url || null,
          pending_bank_data: audRecord?.pending_bank_data || null
        };

        if (audRecord?.profile_status === 'pending' && audRecord?.pending_profile_data) {
           if (Object.keys(audRecord.pending_profile_data).length > 0) {
               profileData = { ...profileData, ...audRecord.pending_profile_data };
           }
        }

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          category,
          role: roleRecord?.role || 'auditor', 
          ...profileData
        };
      });

      return mappedUsers.filter(u => u.role !== 'admin' && u.role !== 'super_admin');
    },
    staleTime: 1000 * 60 * 5,
  });

  const handleViewProfile = async (user: any) => {
    setSelectedUser(user);
    setSelectedUserBank(null); 
    setIsLoadingBank(true);

    try {
      const { data, error } = await supabase
        .from('bank_kyc_details')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSelectedUserBank(data);
      } else if (user.pending_bank_data && Object.keys(user.pending_bank_data).length > 0) {
        setSelectedUserBank(user.pending_bank_data);
      } else {
        setSelectedUserBank(null);
      }
    } catch (err: any) {
      toast.error('Failed to load secure bank details: ' + err.message);
    } finally {
      setIsLoadingBank(false);
    }
  };

  const filteredUsers = allUsers
    .filter(u => activeTab === 'all' || u.category === activeTab)
    .filter(u => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.includes(q)
      );
    });

  const displayedUsers = filteredUsers.slice(0, visibleCount);

  // --- SELECTION LOGIC ---
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) newSet.delete(userId);
      else newSet.add(userId);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const displayedIds = displayedUsers.map(u => u.id);
    const allDisplayedSelected = displayedIds.every(id => selectedUserIds.has(id));

    setSelectedUserIds(prev => {
      const newSet = new Set(prev);
      if (allDisplayedSelected) {
        // If all currently visible are selected, unselect them
        displayedIds.forEach(id => newSet.delete(id));
      } else {
        // Otherwise, add all currently visible to the selection
        displayedIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  // --- EMAIL SENDING LOGIC (SUPABASE EDGE FUNCTIONS) ---
  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Subject and message are required.");
      return;
    }

    const recipientEmails = allUsers
      .filter(u => selectedUserIds.has(u.id) && u.email)
      .map(u => u.email);

    if (recipientEmails.length === 0) {
      toast.error("None of the selected users have a valid email address.");
      return;
    }

    setIsSendingEmail(true);
    const toastId = toast.loading(`Sending email to ${recipientEmails.length} users...`);

    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: recipientEmails,
          subject: emailSubject,
          body: emailBody
        }
      });

      if (error) throw error;

      toast.success("Emails sent successfully!", { id: toastId });
      setEmailDialogOpen(false);
      setEmailSubject('');
      setEmailBody('');
      setSelectedUserIds(new Set()); // Reset selections after sending
    } catch (error: any) {
      toast.error(`Failed to send emails: ${error.message}`, { id: toastId });
      console.error("Email Error:", error);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const observer = useRef<IntersectionObserver | null>(null);
  const lastUserElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < filteredUsers.length) {
        setVisibleCount(prev => prev + 50);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [isLoading, visibleCount, filteredUsers.length]);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'fully_verified':
        return <Badge className="bg-green-600 hover:bg-green-600 text-white border-none px-2.5 py-0.5"><CheckCircle2 className="h-3.5 w-3.5 mr-1"/> Fully Verified</Badge>;
      case 'profile_verified':
        return <Badge className="bg-blue-600 hover:bg-blue-600 text-white border-none px-2.5 py-0.5"><User className="h-3.5 w-3.5 mr-1"/> Profile Verified</Badge>;
      case 'unverified':
      default:
        return <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300 px-2.5 py-0.5"><ShieldAlert className="h-3.5 w-3.5 mr-1"/> OTP / Unverified</Badge>;
    }
  };

  const getStatusBadge = (status: string | undefined | null) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none px-2 py-0.5">Approved</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none px-2 py-0.5">Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="px-2 py-0.5">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-500 px-2 py-0.5">Unverified</Badge>;
    }
  };

  return (
    <>
      {/* FLOATING ACTION BAR FOR BULK EMAIL */}
      {selectedUserIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 flex items-center gap-4 bg-white/95 backdrop-blur-md px-6 py-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200">
          <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
            <Badge className="bg-[#4338CA] text-white hover:bg-[#4338CA] text-sm px-2.5">{selectedUserIds.size}</Badge>
            <span className="font-semibold text-sm text-gray-700">Selected</span>
          </div>
          
          <Button 
            onClick={() => setEmailDialogOpen(true)}
            className="bg-[#4338CA] hover:bg-[#4338CA]/90 text-white shadow-sm rounded-full px-6"
          >
            <Mail className="h-4 w-4 mr-2" />
            Compose Email
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-full text-muted-foreground hover:bg-gray-100 h-8 w-8 p-0 ml-1"
            onClick={() => setSelectedUserIds(new Set())}
            title="Clear Selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* FILTER TABS */}
      <Tabs defaultValue="all" onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full sm:max-w-[700px] grid-cols-4 h-12 shadow-sm">
          <TabsTrigger value="all" className="text-sm font-medium">All Auditors</TabsTrigger>
          <TabsTrigger value="fully_verified" className="text-sm font-medium">Fully Verified</TabsTrigger>
          <TabsTrigger value="profile_verified" className="text-sm font-medium">Profile Verified</TabsTrigger>
          <TabsTrigger value="unverified" className="text-sm font-medium">OTP / Unverified</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="border-t-4 border-t-primary shadow-md">
        <CardHeader className="bg-muted/10 border-b pb-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                 <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Auditor Directory</CardTitle>
                <div className="text-sm text-muted-foreground mt-1">
                   Showing <span className="font-bold text-foreground">{displayedUsers.length}</span> of <span className="font-bold text-foreground">{filteredUsers.length}</span> users.
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* OPTIMIZED SEARCH BAR */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search auditors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white shadow-sm border-muted-foreground/20"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              <p>Loading user directory...</p>
            </div>
          ) : displayedUsers.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground bg-muted/5">
              No auditors found matching the selected filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-12 text-center">
                    <Checkbox 
                      checked={displayedUsers.length > 0 && displayedUsers.every(u => selectedUserIds.has(u.id))}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all visible users"
                    />
                  </TableHead>
                  <TableHead>Auditor Details</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Verification Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedUsers.map((user: any) => (
                  <TableRow key={user.id} className={`hover:bg-muted/10 transition-colors ${selectedUserIds.has(user.id) ? 'bg-primary/5' : ''}`}>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={selectedUserIds.has(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                        aria-label={`Select ${user.full_name}`}
                      />
                    </TableCell>
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
                      {getCategoryBadge(user.category)}
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col gap-1.5 w-fit">
                          <div className="flex items-center justify-between gap-4 text-xs">
                             <span className="text-muted-foreground">Profile:</span> {getStatusBadge(user.profile_status)}
                          </div>
                          <div className="flex items-center justify-between gap-4 text-xs">
                             <span className="text-muted-foreground">Bank:</span> {getStatusBadge(user.bank_status)}
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewProfile(user)}
                        className="text-primary border-primary/20 hover:bg-primary/5"
                      >
                        <Eye className="h-4 w-4 mr-1.5" /> View Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                
                {/* INFINITE SCROLL TRIGGER ROW */}
                {visibleCount < filteredUsers.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center">
                      <div ref={lastUserElementRef} className="flex items-center justify-center text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin mr-2 text-primary" />
                        Loading more auditors...
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* COMPOSER: BULK EMAIL DIALOG */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#4338CA]" />
              Compose Email Broadcast
            </DialogTitle>
            <DialogDescription>
              Sending an email to <span className="font-bold text-foreground">{selectedUserIds.size}</span> selected users via Supabase Edge Functions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-semibold text-gray-700">Subject</Label>
              <Input 
                placeholder="Important: Update regarding your Audit Profile" 
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                disabled={isSendingEmail}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-gray-700">Message Body</Label>
              <Textarea 
                placeholder="Write your message here..." 
                className="min-h-[200px]"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                disabled={isSendingEmail}
              />
            </div>
          </div>
          
          <DialogFooter className="bg-muted/10 -mx-6 -mb-6 px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={isSendingEmail}>Cancel</Button>
            <Button onClick={handleSendEmail} className="bg-[#4338CA] hover:bg-[#4338CA]/90" disabled={isSendingEmail}>
              {isSendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} 
              {isSendingEmail ? 'Sending...' : 'Send Broadcast'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COMPREHENSIVE USER VIEW DIALOG */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <User className="h-6 w-6 text-primary" />
              Auditor Profile View
            </DialogTitle>
            <DialogDescription>
              Complete details and verification status for {selectedUser?.full_name || 'this user'}.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6 py-2">
              
              {/* Top Profile Banner */}
              <div className="flex flex-col sm:flex-row gap-5 p-5 bg-muted/10 rounded-xl border items-start sm:items-center">
                <PublicAvatar 
                  path={selectedUser.profile_photo_url} 
                  fallback={selectedUser.full_name?.charAt(0).toUpperCase() || 'U'} 
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-3">
                     <h3 className="font-bold text-xl">{selectedUser.full_name || 'Unknown Name'}</h3>
                     {getCategoryBadge(selectedUser.category)}
                  </div>
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
              </div>

              {selectedUser.category === 'unverified' && (!selectedUser.profile_status || selectedUser.profile_status === 'unverified') ? (
                 <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 text-center col-span-2">
                    <ShieldAlert className="h-8 w-8 text-amber-500 mx-auto mb-2 opacity-50" />
                    <p className="text-amber-700 font-medium text-lg mb-1">Incomplete Registration</p>
                    <p className="text-amber-600/80 text-sm">This user created an account via OTP but has not filled out their profile or uploaded any KYC documents yet.</p>
                 </div>
              ) : (
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

                      <div className="pt-2 border-t mt-2 flex justify-between items-center">
                        <div>
                          <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">Manpower / Team</span>
                          <span className="font-medium">
                            {selectedUser.has_manpower ? `Yes (${selectedUser.manpower_count} people)` : 'No additional team'}
                          </span>
                        </div>
                        <PublicFileLink path={selectedUser.resume_url} label="View Resume" />
                      </div>
                    </div>
                  </div>

                  {/* BANK & IDENTITY DETAILS */}
                  <div className="col-span-1 md:col-span-2 space-y-4 mt-2">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="font-semibold text-lg flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-primary" /> Bank & Identity Verification
                      </h4>
                      {selectedUser.bank_status === 'pending' && selectedUserBank && (
                         <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Viewing Draft Data</Badge>
                      )}
                    </div>
                    
                    {isLoadingBank ? (
                      <div className="bg-muted/5 p-12 rounded-xl border flex flex-col items-center justify-center text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                        <p>Fetching bank records...</p>
                      </div>
                    ) : selectedUserBank ? (
                      <div className="bg-muted/5 p-4 rounded-xl border space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">Account Number</span>
                            <span className="font-medium">{selectedUserBank.bank_account_no || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">IFSC Code</span>
                            <span className="font-medium uppercase">{selectedUserBank.ifsc_code || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">PAN Number</span>
                            <span className="font-medium uppercase">{selectedUserBank.pan_number || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider font-semibold">Aadhaar Number</span>
                            <span className="font-medium">{selectedUserBank.aadhaar_number || 'N/A'}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t">
                          <div className="p-3 bg-white border rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-semibold mb-2">PAN Card</span>
                            <PublicFileLink path={selectedUserBank.pan_card_url} label="View PDF/IMG" />
                          </div>
                          <div className="p-3 bg-white border rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-semibold mb-2">Aadhaar Front</span>
                            <PublicFileLink path={selectedUserBank.aadhaar_front_url} label="View PDF/IMG" />
                          </div>
                          <div className="p-3 bg-white border rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-semibold mb-2">Aadhaar Back</span>
                            <PublicFileLink path={selectedUserBank.aadhaar_back_url} label="View PDF/IMG" />
                          </div>
                          <div className="p-3 bg-white border rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-semibold mb-2">Cancelled Cheque</span>
                            <PublicFileLink path={selectedUserBank.cancelled_cheque_url} label="View PDF/IMG" />
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
              )}
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