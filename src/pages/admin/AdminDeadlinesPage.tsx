import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';
import { DeadlineReminders } from '@/components/DeadlineReminders';

export default function AdminDeadlinesPage() {
  return (
    <DashboardLayout title="Deadlines & Reminders" navItems={adminNavItems} activeTab="deadlines">
      <div className="max-w-7xl mx-auto py-6">
        <DeadlineReminders />
      </div>
    </DashboardLayout>
  );
}