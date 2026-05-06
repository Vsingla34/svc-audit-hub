import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';
import { UserRoleManagement } from '@/components/UserRoleManagement';

export default function AdminVerifiedUsersPage() {
  return (
    <DashboardLayout title="Verified Users" navItems={adminNavItems} activeTab="verified-users">
      <div className="max-w-7xl mx-auto py-6">
        <UserRoleManagement filterType="verified" />
      </div>
    </DashboardLayout>
  );
}