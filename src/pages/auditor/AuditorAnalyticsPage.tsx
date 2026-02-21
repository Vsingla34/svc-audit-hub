import { useAuth } from '@/lib/auth';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';
import { AuditorAnalytics } from '@/components/AuditorAnalytics';

export default function AuditorAnalyticsPage() {
  const { user } = useAuth();

  return (
    <DashboardLayout title="Analytics & Performance" navItems={auditorNavItems} activeTab="analytics">
      <div className="max-w-7xl mx-auto py-6">
        <AuditorAnalytics userId={user?.id || ''} />
      </div>
    </DashboardLayout>
  );
}