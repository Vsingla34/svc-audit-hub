import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';
import { ReportsManagement } from '@/components/ReportsManagement';

export default function AdminReportsPage() {
  return (
    <DashboardLayout title="Live Reports" navItems={adminNavItems} activeTab="reports">
      <div className="max-w-7xl mx-auto py-6">
        <ReportsManagement />
      </div>
    </DashboardLayout>
  );
}