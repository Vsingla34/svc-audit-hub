import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { 
  Search, 
  Shield, 
  UserCog, 
  Eye, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Star, 
  FileText, 
  Download,
  Filter,
  X,
  Users,
  Navigation,
  GraduationCap
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

type Role = "admin" | "auditor" | "client" | "none";

interface AuditorProfile {
  id: string;
  user_id: string;
  base_city: string | null;
  base_state: string | null;
  experience_years: number | null;
  qualifications: string[] | null;
  competencies: string[] | null;
  core_competency: string | null;
  preferred_states: string[] | null;
  willing_to_travel_radius: number | null;
  has_manpower: boolean | null;
  manpower_count: number | null;
  address: string | null;
  gst_number: string | null;
  rating: number | null;
  profile_photo_url: string | null;
  resume_url: string | null;
  profile_status: string | null; // FIX: Changed from kyc_status to match DB
  pan_card: string | null;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  created_at: string;
  auditor_profile?: AuditorProfile | null;
}

export function UserRoleManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  
  // Role Change State
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [newRole, setNewRole] = useState<Role>("none");
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Profile View State
  const [viewProfileOpen, setViewProfileOpen] = useState(false);
  const [detailedProfile, setDetailedProfile] = useState<UserRow | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // 1. Fetch user roles mapping
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
        
      if (rolesError) throw rolesError;

      // 2. Fetch all auditor profiles for their details
      const { data: auditorProfiles, error: auditorError } = await supabase
        .from("auditor_profiles")
        .select("*");
        
      if (auditorError) throw auditorError;

      // 3. Map the data together
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]));
      const auditorMap = new Map(auditorProfiles?.map(ap => [ap.user_id, ap]));
      
      const { data: profilesWithRole, error: profilesWithRoleError } = await supabase
          .from("profiles")
          .select("id, email, full_name, role, phone, created_at")
          .order("created_at", { ascending: false });
          
      if (profilesWithRoleError) throw profilesWithRoleError;

      const mapped: UserRow[] = profilesWithRole?.map((p: any) => ({
          id: p.id,
          email: p.email ?? "",
          full_name: p.full_name ?? "",
          phone: p.phone ?? null,
          role: (p.role as Role) ?? "none",
          created_at: p.created_at,
          auditor_profile: auditorMap.get(p.id) || null,
      })) ?? [];

      setUsers(mapped);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async () => {
    if (!selectedUser) return;

    const targetRole: Role = newRole || "none";
    if (targetRole === selectedUser.role) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: targetRole === "none" ? null : targetRole })
        .eq("id", selectedUser.id);
        
      if (error) throw error;

      if (targetRole === "auditor") {
        await supabase.from("auditor_profiles").upsert({ user_id: selectedUser.id }, { onConflict: "user_id" });
      }

      toast.success(`Role updated to ${targetRole}`);
      
      setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, role: targetRole } : u));
      
      setShowRoleDialog(false);
      setSelectedUser(null);
      setNewRole("none");
      
      if (targetRole === 'auditor') fetchUsers();
    } catch (err) {
      toast.error("Failed to update role");
    } finally {
      setUpdating(false);
    }
  };

  const handleViewProfile = async (user: UserRow) => {
    setDetailedProfile(user);
    setViewProfileOpen(true);
    setProfilePhotoUrl(null);
    setResumeUrl(null);

    // Fetch Signed URLs for Documents and Photos so they can be viewed
    if (user.auditor_profile) {
      if (user.auditor_profile.profile_photo_url) {
        const path = user.auditor_profile.profile_photo_url;
        if (path.startsWith('http')) {
          setProfilePhotoUrl(path);
        } else {
          const { data } = await supabase.storage.from('kyc-documents').createSignedUrl(path, 3600);
          if (data?.signedUrl) setProfilePhotoUrl(data.signedUrl);
        }
      }
      
      if (user.auditor_profile.resume_url) {
          const path = user.auditor_profile.resume_url;
          if (path.startsWith('http')) {
            setResumeUrl(path);
          } else {
            const { data } = await supabase.storage.from('kyc-documents').createSignedUrl(path, 3600);
            if (data?.signedUrl) setResumeUrl(data.signedUrl);
          }
      }
    }
  };

  // Generate unique states for dropdowns
  const uniqueStates = useMemo(() => {
    const states = new Set<string>();
    users.forEach(u => { if (u.auditor_profile?.base_state) states.add(u.auditor_profile.base_state); });
    return Array.from(states).sort();
  }, [users]);

  // Handle Search and Filter Logic
  const filteredUsers = users.filter((u) => {
    const name = (u.full_name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const state = (u.auditor_profile?.base_state || "").toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = name.includes(q) || email.includes(q) || state.includes(q);
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesState = stateFilter === "all" || u.auditor_profile?.base_state === stateFilter;
    
    let matchesRating = true;
    if (ratingFilter !== "all") {
        const rating = u.auditor_profile?.rating || 0;
        if (ratingFilter === "4+") matchesRating = rating >= 4;
        else if (ratingFilter === "3+") matchesRating = rating >= 3;
        else if (ratingFilter === "2+") matchesRating = rating >= 2;
    }

    return matchesSearch && matchesRole && matchesState && matchesRating;
  });

  const getRoleBadgeVariant = (role: Role) => {
    switch (role) {
      case "admin": return "destructive";
      case "auditor": return "default";
      case "client": return "secondary";
      default: return "outline";
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setStateFilter("all");
    setRatingFilter("all");
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground animate-pulse">Loading users and profiles...</div>;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage user roles, view details, and monitor performance</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers} title="Refresh List">Refresh</Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, email, state..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>

          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
            <SelectTrigger><div className="flex items-center gap-2"><UserCog className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Role" /></div></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="auditor">Auditor</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="State" /></div></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {uniqueStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger><div className="flex items-center gap-2"><Star className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Rating" /></div></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="4+">4.0 & Up</SelectItem>
              <SelectItem value="3+">3.0 & Up</SelectItem>
              <SelectItem value="2+">2.0 & Up</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {(searchQuery || roleFilter !== "all" || stateFilter !== "all" || ratingFilter !== "all") && (
             <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground h-8"><X className="h-3 w-3 mr-1" /> Clear Filters</Button>
             </div>
        )}

        {/* Users Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12"><div className="flex flex-col items-center gap-2"><Filter className="h-8 w-8 text-muted-foreground/50" /><p>No users found matching your filters</p></div></TableCell></TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell><div className="flex flex-col"><span className="font-medium">{u.full_name || "—"}</span><span className="text-xs text-muted-foreground">{u.email}</span></div></TableCell>
                    <TableCell><Badge variant={getRoleBadgeVariant(u.role)}>{u.role}</Badge></TableCell>
                    <TableCell>
                        {u.auditor_profile?.base_state ? (
                            <div className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{u.auditor_profile.base_city && `${u.auditor_profile.base_city}, `}{u.auditor_profile.base_state}</div>
                        ) : (<span className="text-muted-foreground text-xs">—</span>)}
                    </TableCell>
                    <TableCell>
                        {u.role === 'auditor' && u.auditor_profile?.rating ? (
                             <div className="flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /><span className="font-medium">{u.auditor_profile.rating.toFixed(1)}</span></div>
                        ) : (<span className="text-muted-foreground text-xs">—</span>)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleViewProfile(u)} title="View Full Details"><Eye className="h-4 w-4 text-primary" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(u); setNewRole(u.role ?? "none"); setShowRoleDialog(true); }} title="Change Role"><UserCog className="h-4 w-4 text-muted-foreground" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Role Change Dialog */}
        <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
              <DialogDescription>Update the role for {selectedUser?.full_name || selectedUser?.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><p className="text-sm text-muted-foreground">Current role:{" "}<Badge variant={getRoleBadgeVariant(selectedUser?.role || "none")}>{selectedUser?.role || "none"}</Badge></p></div>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                <SelectTrigger><SelectValue placeholder="Select new role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="auditor">Auditor</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleRoleChange} disabled={updating || !selectedUser || newRole === selectedUser.role} className="w-full">{updating ? "Updating..." : "Update Role"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* --- FULL VIEW PROFILE DIALOG (WITH ALL DOCUMENTS AND DETAILS) --- */}
        <Dialog open={viewProfileOpen} onOpenChange={setViewProfileOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-2xl">User Profile Details</DialogTitle></DialogHeader>
            {detailedProfile ? (
              <div className="space-y-6 py-4">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row items-start gap-4 bg-muted/20 p-4 rounded-xl border">
                  <Avatar className="h-20 w-20 border-2 border-primary/20">
                    <AvatarImage src={profilePhotoUrl || ''} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{detailedProfile.full_name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  
                  <div className="space-y-2 flex-1 w-full">
                    <div>
                      <h3 className="text-2xl font-bold">{detailedProfile.full_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={getRoleBadgeVariant(detailedProfile.role)}>{detailedProfile.role}</Badge>
                        <span className="text-sm text-muted-foreground">Joined {new Date(detailedProfile.created_at).toLocaleDateString()}</span>
                        {detailedProfile.auditor_profile?.rating && (
                          <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded text-yellow-700 border border-yellow-200 ml-2">
                              <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                              <span className="font-bold text-xs">{detailedProfile.auditor_profile.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm mt-2">
                       <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-4 w-4"/> {detailedProfile.email}</span>
                       <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-4 w-4"/> {detailedProfile.phone || detailedProfile.auditor_profile?.pan_card || "N/A"}</span>
                       {detailedProfile.auditor_profile && (
                         <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4"/> {detailedProfile.auditor_profile.base_city}, {detailedProfile.auditor_profile.base_state}</span>
                       )}
                    </div>
                  </div>
                </div>

                {/* Auditor Specific Details */}
                {detailedProfile.role === 'auditor' && detailedProfile.auditor_profile ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {/* Professional Info */}
                       <div className="space-y-4">
                          <h4 className="font-semibold flex items-center gap-2 border-b pb-2"><Briefcase className="h-4 w-4 text-primary" /> Professional Profile</h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                             <div className="bg-muted/10 p-3 rounded-lg border">
                                <div className="text-xs text-muted-foreground uppercase font-bold">Experience</div>
                                <div className="text-lg font-semibold">{detailedProfile.auditor_profile.experience_years || 0} Years</div>
                             </div>
                             <div className="bg-muted/10 p-3 rounded-lg border">
                                <div className="text-xs text-muted-foreground uppercase font-bold">GST Number</div>
                                <div className="font-medium">{detailedProfile.auditor_profile.gst_number || "N/A"}</div>
                             </div>
                             <div className="bg-muted/10 p-3 rounded-lg border col-span-2">
                                <div className="text-xs text-muted-foreground uppercase font-bold">Core Competency</div>
                                <div className="font-medium text-primary">{detailedProfile.auditor_profile.core_competency || "N/A"}</div>
                             </div>
                          </div>

                          <div>
                             <Label className="flex items-center gap-2 mb-2 text-sm"><GraduationCap className="h-4 w-4"/> Qualifications</Label>
                             <div className="flex flex-wrap gap-2">
                                {detailedProfile.auditor_profile.qualifications?.length ? detailedProfile.auditor_profile.qualifications.map(q => <Badge key={q} variant="secondary">{q}</Badge>) : <span className="text-sm text-muted-foreground">None</span>}
                             </div>
                          </div>
                          
                          <div>
                             <Label className="flex items-center gap-2 mb-2 text-sm"><Briefcase className="h-4 w-4"/> All Competencies</Label>
                             <div className="flex flex-wrap gap-2">
                                {detailedProfile.auditor_profile.competencies?.length ? detailedProfile.auditor_profile.competencies.map(c => <Badge key={c} variant="outline">{c}</Badge>) : <span className="text-sm text-muted-foreground">None</span>}
                             </div>
                          </div>
                       </div>

                       {/* Logistics Info */}
                       <div className="space-y-4">
                          <h4 className="font-semibold flex items-center gap-2 border-b pb-2"><Navigation className="h-4 w-4 text-primary" /> Logistics & Availability</h4>
                          
                          <div>
                             <Label className="flex items-center gap-2 mb-2 text-sm"><Users className="h-4 w-4"/> Team Availability</Label>
                             <div className="p-3 border rounded-md text-sm">
                                {detailedProfile.auditor_profile.has_manpower ? (
                                   <span className="text-green-600 font-medium flex items-center gap-2">
                                      <Users className="h-4 w-4"/> Yes, Team of {detailedProfile.auditor_profile.manpower_count}
                                   </span>
                                ) : (<span className="text-muted-foreground">Individual Auditor (No Manpower)</span>)}
                             </div>
                          </div>

                          <div>
                             <Label className="flex items-center gap-2 mb-2 text-sm"><Navigation className="h-4 w-4"/> Travel Preferences</Label>
                             <div className="p-3 border rounded-md text-sm space-y-2">
                                <div className="flex justify-between">
                                   <span className="text-muted-foreground">Travel Radius:</span>
                                   <span className="font-medium">{detailedProfile.auditor_profile.willing_to_travel_radius || 0} km</span>
                                </div>
                                <div className="flex justify-between items-start">
                                   <span className="text-muted-foreground whitespace-nowrap mr-2">Preferred States:</span>
                                   <span className="font-medium text-right flex flex-wrap justify-end gap-1">
                                      {detailedProfile.auditor_profile.preferred_states?.length ? detailedProfile.auditor_profile.preferred_states.map(s => <Badge variant="secondary" className="text-[10px]" key={s}>{s}</Badge>) : 'None'}
                                   </span>
                                </div>
                             </div>
                          </div>
                          
                          <div>
                             <Label className="flex items-center gap-2 mb-2 text-sm"><MapPin className="h-4 w-4"/> Full Address</Label>
                             <div className="p-3 border rounded-md text-sm text-muted-foreground bg-muted/5">
                                {detailedProfile.auditor_profile.address || "N/A"}
                             </div>
                          </div>
                       </div>
                    </div>

                    <Separator />

                    {/* Documents & Profile Status Section */}
                    <div className="space-y-4">
                       <h4 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Documents & Profile Status</h4>
                       <div className="flex flex-col sm:flex-row gap-4">
                          
                          <div className="border rounded p-4 flex-1 flex flex-col justify-center items-center bg-muted/5">
                              {/* FIX: Changed label to Profile Status instead of KYC Status */}
                              <div className="text-xs text-muted-foreground uppercase font-bold mb-2">Profile Status</div>
                              <div className="flex items-center gap-2">
                                  <div className={`h-2.5 w-2.5 rounded-full ${
                                      detailedProfile.auditor_profile.profile_status === 'approved' ? 'bg-green-500' : 
                                      detailedProfile.auditor_profile.profile_status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                                  }`} />
                                  {/* FIX: Use profile_status instead of kyc_status */}
                                  <span className="capitalize font-bold text-lg">{detailedProfile.auditor_profile.profile_status || 'Pending'}</span>
                              </div>
                          </div>

                          {/* RESUME DOWNLOAD BUTTON */}
                          {resumeUrl ? (
                              <Button variant="outline" className="flex-1 h-auto py-4" onClick={() => window.open(resumeUrl, '_blank')}>
                                  <Download className="h-5 w-5 mr-2 text-primary" />
                                  <div className="text-left">
                                      <div className="font-semibold">Download Resume</div>
                                      <div className="text-xs text-muted-foreground">View uploaded CV</div>
                                  </div>
                              </Button>
                          ) : (
                              <div className="border border-dashed rounded p-4 flex-1 flex items-center justify-center text-muted-foreground text-sm italic">
                                 No Resume Uploaded
                              </div>
                          )}

                          {/* PROFILE PHOTO DOWNLOAD BUTTON */}
                          {profilePhotoUrl ? (
                              <Button variant="outline" className="flex-1 h-auto py-4" onClick={() => window.open(profilePhotoUrl, '_blank')}>
                                  <Eye className="h-5 w-5 mr-2 text-primary" />
                                  <div className="text-left">
                                      <div className="font-semibold">View Profile Photo</div>
                                      <div className="text-xs text-muted-foreground">View uploaded photo</div>
                                  </div>
                              </Button>
                          ) : (
                              <div className="border border-dashed rounded p-4 flex-1 flex items-center justify-center text-muted-foreground text-sm italic">
                                 No Photo Uploaded
                              </div>
                          )}

                       </div>
                    </div>
                  </>
                ) : (
                    detailedProfile.role === 'auditor' && (
                        <div className="p-4 bg-amber-50 text-amber-800 rounded-md border border-amber-200 text-sm">
                            This user has the 'Auditor' role but no auditor profile details were found. They need to complete their profile setup.
                        </div>
                    )
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-destructive">User details not found</div>
            )}
            
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setViewProfileOpen(false)}>Close Profile</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}