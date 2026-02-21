import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';
import { UserRoleManagement } from '@/components/UserRoleManagement';

export default function AdminUsersPage() {
  return (
    <DashboardLayout title="User Management" navItems={adminNavItems} activeTab="user-roles">
      <div className="max-w-7xl mx-auto py-6">
        <UserRoleManagement />
      </div>
    </DashboardLayout>
  );
}