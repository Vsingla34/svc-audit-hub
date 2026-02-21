import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardLayout, adminNavItems } from '@/components/DashboardLayout';
import { DashboardAnalytics } from '@/components/DashboardAnalytics';
import { toast } from 'sonner';

export default function AdminOverviewPage() {
  
  // 1. React Query caches the data automatically
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['admin-assignments-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error("Error loading dashboard data");
        throw error;
      }
      return data || [];
    },
    // Data stays fresh for 5 minutes before fetching in background again
    staleTime: 1000 * 60 * 5, 
  });

  // 2. useMemo ensures we only calculate these stats when 'assignments' actually changes
  const stats = useMemo(() => ({
    total: assignments.length,
    open: assignments.filter(a => a.status === 'open').length,
    allotted: assignments.filter(a => a.status === 'allotted' || a.status === 'in_progress').length,
    completed: assignments.filter(a => a.status === 'completed' || a.status === 'paid').length
  }), [assignments]);

  if (isLoading) {
     return (
       <DashboardLayout title="Admin Dashboard Overview" navItems={adminNavItems} activeTab="overview">
          <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse">
            Loading overview data...
          </div>
       </DashboardLayout>
     );
  }

  return (
    <DashboardLayout title="Admin Dashboard Overview" navItems={adminNavItems} activeTab="overview">
      <div className="space-y-6 max-w-7xl mx-auto py-6">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
              <CardDescription>Total Assignments</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-3xl text-blue-600">{stats.open}</CardTitle>
              <CardDescription>Open Assignments</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-3xl text-amber-600">{stats.allotted}</CardTitle>
              <CardDescription>In Progress</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-3xl text-green-600">{stats.completed}</CardTitle>
              <CardDescription>Completed</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Analytics Component */}
        <DashboardAnalytics assignments={assignments} />

      </div>
    </DashboardLayout>
  );
}