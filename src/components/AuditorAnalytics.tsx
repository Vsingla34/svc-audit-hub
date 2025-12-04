import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, CheckCircle, Clock, Star } from 'lucide-react';

interface AuditorAnalyticsProps {
  userId: string;
}

export function AuditorAnalytics({ userId }: AuditorAnalyticsProps) {
  const [stats, setStats] = useState({
    totalAssignments: 0,
    completedAssignments: 0,
    pendingAssignments: 0,
    totalEarnings: 0,
    averageRating: 0,
    completionRate: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [userId]);

  const fetchAnalytics = async () => {
    try {
      // Fetch all assignments for this auditor
      const { data: assignments, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('allotted_to', userId);

      if (error) throw error;

      // Calculate stats
      const completed = assignments?.filter(a => a.status === 'completed') || [];
      const pending = assignments?.filter(a => a.status === 'allotted' || a.status === 'in_progress') || [];
      const totalEarnings = completed.reduce((sum, a) => sum + (a.fees || 0) + (a.ope || 0), 0);
      
      // Get auditor rating
      const { data: profile } = await supabase
        .from('auditor_profiles')
        .select('rating')
        .eq('user_id', userId)
        .single();

      setStats({
        totalAssignments: assignments?.length || 0,
        completedAssignments: completed.length,
        pendingAssignments: pending.length,
        totalEarnings,
        averageRating: profile?.rating || 0,
        completionRate: assignments?.length ? (completed.length / assignments.length) * 100 : 0,
      });

      // Calculate monthly data
      const monthlyMap = new Map<string, { count: number; earnings: number }>();
      assignments?.forEach(a => {
        const month = new Date(a.audit_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        const current = monthlyMap.get(month) || { count: 0, earnings: 0 };
        monthlyMap.set(month, {
          count: current.count + 1,
          earnings: current.earnings + (a.status === 'completed' ? (a.fees || 0) : 0),
        });
      });
      
      setMonthlyData(Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        assignments: data.count,
        earnings: data.earnings,
      })).slice(-6));

      // Status distribution
      const statusCount = {
        Completed: completed.length,
        'In Progress': assignments?.filter(a => a.status === 'in_progress').length || 0,
        Allotted: assignments?.filter(a => a.status === 'allotted').length || 0,
      };
      
      setStatusDistribution(Object.entries(statusCount).map(([name, value]) => ({ name, value })));

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <p className="text-2xl font-bold">{stats.completedAssignments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-chart-2" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold">{stats.pendingAssignments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-chart-3" />
              <span className="text-sm text-muted-foreground">Earnings</span>
            </div>
            <p className="text-2xl font-bold">₹{stats.totalEarnings.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-chart-4" />
              <span className="text-sm text-muted-foreground">Completion Rate</span>
            </div>
            <p className="text-2xl font-bold">{stats.completionRate.toFixed(0)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Rating</span>
            </div>
            <p className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Assignments</CardTitle>
            <CardDescription>Your assignment history</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="assignments" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assignment Status</CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Earnings Trend</CardTitle>
            <CardDescription>Monthly earnings from completed assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Earnings']} />
                <Line type="monotone" dataKey="earnings" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
