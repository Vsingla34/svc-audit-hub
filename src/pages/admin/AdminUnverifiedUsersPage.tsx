import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';
import { UserRoleManagement } from '@/components/UserRoleManagement';

export default function AdminUnverifiedUsersPage() {
  return (
    <DashboardLayout title="Unverified & Pending Users" navItems={adminNavItems} activeTab="unverified-users">
      <div className="max-w-7xl mx-auto py-6">
        <UserRoleManagement filterType="unverified" />
      </div>
    </DashboardLayout>
  );
}