import { useAuth } from '@/lib/auth';
import { DashboardLayout, adminNavItems, auditorNavItems } from '@/components/DashboardLayout';
import AuditorsMap from '@/components/AuditorsMap';
import { Loader2 } from 'lucide-react';

export default function MapView() {
  const { userRole, loading } = useAuth();

  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  const navItems = userRole === 'auditor' ? auditorNavItems : adminNavItems;

  return (
    <DashboardLayout 
      title="Auditors Map" 
      navItems={navItems} 
      activeTab="map-view"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Geographic Overview</h2>
          <p className="text-sm text-muted-foreground">
            Visualise the distribution of auditors across different states in India.
          </p>
        </div>
        
        
        <AuditorsMap />
      </div>
    </DashboardLayout>
  );
}