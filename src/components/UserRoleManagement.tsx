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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Shield, UserCog } from "lucide-react";

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
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [newRole, setNewRole] = useState<Role>("none");
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // ✅ Single source of truth for roles: profiles.role
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
      // ✅ Update role directly in profiles table
      const { error } = await supabase
        .from("profiles")
        .update({ role: targetRole === "none" ? null : targetRole })
        .eq("id", selectedUser.id);

      if (error) throw error;

      // Optional: if changing to auditor, ensure auditor profile exists
      if (targetRole === "auditor") {
        const { error: upsertErr } = await supabase
          .from("auditor_profiles")
          .upsert({ user_id: selectedUser.id }, { onConflict: "user_id" });

        if (upsertErr) {
          // not blocking (role update already done), but helpful to know
          console.warn("auditor_profiles upsert warning:", upsertErr);
        }
      }

      toast.success(
        `Role updated to ${targetRole} for ${selectedUser.full_name || selectedUser.email || "user"}`
      );

      // Optimistic UI update
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(u);
                          setNewRole(u.role ?? "none");
                          setShowRoleDialog(true);
                        }}
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
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
      </CardContent>
    </Card>
  );
}
