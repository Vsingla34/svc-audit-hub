import { useState, useEffect } from "react";
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
import { Search, Shield, UserCog, Eye, Mail, Phone, MapPin, Briefcase, Calendar } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type Role = "admin" | "auditor" | "client" | "none";

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export function UserRoleManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  
  // Role Change State
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [newRole, setNewRole] = useState<Role>("none");
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Profile View State
  const [viewProfileOpen, setViewProfileOpen] = useState(false);
  const [detailedProfile, setDetailedProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: UserRow[] =
        data?.map((p: any) => ({
          id: p.id,
          email: p.email ?? "",
          full_name: p.full_name ?? "",
          role: (p.role as Role) ?? "none",
          created_at: p.created_at,
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
        const { error: upsertErr } = await supabase
          .from("auditor_profiles")
          .upsert({ user_id: selectedUser.id }, { onConflict: "user_id" });

        if (upsertErr) {
          console.warn("auditor_profiles upsert warning:", upsertErr);
        }
      }

      toast.success(
        `Role updated to ${targetRole} for ${selectedUser.full_name || selectedUser.email || "user"}`
      );

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id ? { ...u, role: targetRole } : u
        )
      );

      setShowRoleDialog(false);
      setSelectedUser(null);
      setNewRole("none");
    } catch (err) {
      console.error("Error updating role:", err);
      toast.error("Failed to update role");
    } finally {
      setUpdating(false);
    }
  };

  const handleViewProfile = async (user: UserRow) => {
    setViewProfileOpen(true);
    setLoadingProfile(true);
    setDetailedProfile(null);

    try {
      // 1. Fetch Basic Profile Data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;

      let mergedData = { ...profileData, role: user.role, photoUrl: null };

      // 2. If Auditor, fetch professional details & Photo
      if (user.role === 'auditor') {
        const { data: auditorData } = await supabase
          .from('auditor_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (auditorData) {
          mergedData = { ...mergedData, auditorInfo: auditorData };

          // 3. Handle Profile Photo Signing
          if (auditorData.profile_photo_url) {
            const path = auditorData.profile_photo_url;
            if (path.startsWith('http') || path.startsWith('https')) {
              mergedData.photoUrl = path;
            } else {
              // Sign private URL
              const { data: signed } = await supabase.storage
                .from('kyc-documents')
                .createSignedUrl(path, 3600); // 1 hour valid
              
              if (signed?.signedUrl) {
                mergedData.photoUrl = signed.signedUrl;
              }
            }
          }
        }
      }

      setDetailedProfile(mergedData);

    } catch (error: any) {
      console.error("Error fetching details:", error);
      toast.error("Could not load full profile");
    } finally {
      setLoadingProfile(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const name = (u.full_name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = name.includes(q) || email.includes(q);
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeVariant = (role: Role) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "auditor":
        return "default";
      case "client":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading users...
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>User Role Management</CardTitle>
            <CardDescription>Manage user roles and permissions</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="auditor">Auditor</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name || "—"}
                    </TableCell>
                    <TableCell>{u.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(u.role)}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* View Profile Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewProfile(u)}
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {/* Change Role Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(u);
                            setNewRole(u.role ?? "none");
                            setShowRoleDialog(true);
                          }}
                          title="Change Role"
                        >
                          <UserCog className="h-4 w-4" />
                        </Button>
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
              <DialogDescription>
                Update the role for {selectedUser?.full_name || selectedUser?.email}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Current role:{" "}
                  <Badge
                    variant={getRoleBadgeVariant(selectedUser?.role || "none")}
                  >
                    {selectedUser?.role || "none"}
                  </Badge>
                </p>
              </div>

              <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="auditor">Auditor</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={handleRoleChange}
                disabled={updating || !selectedUser || newRole === selectedUser.role}
                className="w-full"
              >
                {updating ? "Updating..." : "Update Role"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Profile Dialog */}
        <Dialog open={viewProfileOpen} onOpenChange={setViewProfileOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>User Profile</DialogTitle>
            </DialogHeader>
            
            {loadingProfile ? (
              <div className="py-8 text-center text-muted-foreground">Loading details...</div>
            ) : detailedProfile ? (
              <div className="space-y-6 pt-2">
                {/* Header Section */}
                <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-lg">
                  <Avatar className="h-16 w-16 border-2 border-primary/20">
                    <AvatarImage src={detailedProfile.photoUrl || ''} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                      {detailedProfile.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h3 className="text-xl font-bold">{detailedProfile.full_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={getRoleBadgeVariant(detailedProfile.role)}>
                        {detailedProfile.role}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Joined {new Date(detailedProfile.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </span>
                    <div className="text-sm">{detailedProfile.email}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Phone
                    </span>
                    <div className="text-sm">{detailedProfile.phone || "N/A"}</div>
                  </div>
                </div>

                {/* Auditor Specific Details */}
                {detailedProfile.role === 'auditor' && detailedProfile.auditorInfo && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Briefcase className="h-4 w-4" /> Professional Details
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4 bg-card border rounded-md p-4">
                        <div>
                          <div className="text-xs text-muted-foreground">Base Location</div>
                          <div className="flex items-center gap-1 font-medium mt-1">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {detailedProfile.auditorInfo.base_city}, {detailedProfile.auditorInfo.base_state}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Experience</div>
                          <div className="font-medium mt-1">
                            {detailedProfile.auditorInfo.experience_years} Years
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-xs text-muted-foreground">Qualifications</div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {detailedProfile.auditorInfo.qualifications?.map((q: string) => (
                              <Badge key={q} variant="secondary" className="text-xs">{q}</Badge>
                            )) || <span className="text-sm text-muted-foreground">None listed</span>}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="border p-3 rounded bg-muted/10">
                          <div className="text-xs text-muted-foreground uppercase font-bold">PAN Number</div>
                          <div className="font-mono text-sm mt-1">{detailedProfile.auditorInfo.pan_card || "N/A"}</div>
                        </div>
                        <div className="border p-3 rounded bg-muted/10">
                          <div className="text-xs text-muted-foreground uppercase font-bold">KYC Status</div>
                          <div className="mt-1">
                            <Badge variant={detailedProfile.auditorInfo.kyc_status === 'approved' ? 'default' : 'outline'}>
                              {detailedProfile.auditorInfo.kyc_status || 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-destructive">User details not found</div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewProfileOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}