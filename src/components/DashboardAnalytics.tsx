import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DashboardAnalyticsProps {
  assignments: any[];
}

export function DashboardAnalytics({ assignments }: DashboardAnalyticsProps) {
  // Status distribution for pie chart
  const statusData = [
    { name: 'Open', value: assignments.filter(a => a.status === 'open').length, color: 'hsl(var(--warning))' },
    { name: 'Allotted', value: assignments.filter(a => a.status === 'allotted').length, color: 'hsl(var(--primary))' },
    { name: 'In Progress', value: assignments.filter(a => a.status === 'in_progress').length, color: 'hsl(var(--chart-2))' },
    { name: 'Completed', value: assignments.filter(a => a.status === 'completed').length, color: 'hsl(var(--accent-foreground))' },
    { name: 'Paid', value: assignments.filter(a => a.status === 'paid').length, color: 'hsl(var(--chart-4))' },
  ].filter(item => item.value > 0);

  // State-wise distribution for bar chart
  const stateData = Object.entries(
    assignments.reduce((acc, a) => {
      acc[a.state] = (acc[a.state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([state, count]) => ({ state, count: Number(count) }))
    .sort((a, b) => Number(b.count) - Number(a.count))
    .slice(0, 10);

  // Audit type distribution
  const auditTypeData = Object.entries(
    assignments.reduce((acc, a) => {
      acc[a.audit_type] = (acc[a.audit_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, count]) => ({ type, count }));

  // Monthly trend (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const monthYear = date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const month = date.getMonth();
    const year = date.getFullYear();
    
    const count = assignments.filter(a => {
      const assignmentDate = new Date(a.created_at);
      return assignmentDate.getMonth() === month && assignmentDate.getFullYear() === year;
    }).length;

    return { month: monthYear, assignments: count };
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Analytics & Insights</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Status Distribution</CardTitle>
            <CardDescription>Current status breakdown of all assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Trend (6 Months)</CardTitle>
            <CardDescription>New assignments created over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="assignments" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top States */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 States by Assignments</CardTitle>
            <CardDescription>States with most audit assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="state" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Audit Types */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Type Distribution</CardTitle>
            <CardDescription>Breakdown by type of audit</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={auditTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}