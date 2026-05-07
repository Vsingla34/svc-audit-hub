import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';
import { UserRoleManagement } from '@/components/UserRoleManagement';

export default function AdminUsersPage() {
  return (
    <DashboardLayout title="Auditor Directory" navItems={adminNavItems} activeTab="users">
      <div className="max-w-7xl mx-auto py-2">
        <UserRoleManagement />
      </div>
    </DashboardLayout>
  );
}