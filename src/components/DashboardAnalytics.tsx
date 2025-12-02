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

  // Completion rate over time
  const completionRateData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const monthYear = date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const month = date.getMonth();
    const year = date.getFullYear();
    
    const monthAssignments = assignments.filter(a => {
      const assignmentDate = new Date(a.created_at);
      return assignmentDate.getMonth() === month && assignmentDate.getFullYear() === year;
    });

    const completed = monthAssignments.filter(a => a.status === 'completed' || a.status === 'paid').length;
    const total = monthAssignments.length;
    const rate = total > 0 ? (completed / total) * 100 : 0;

    return { month: monthYear, rate: Number(rate.toFixed(1)), completed, total };
  });

  // Average fees by audit type
  const feesByTypeData = Object.entries(
    assignments.reduce((acc, a) => {
      if (!acc[a.audit_type]) {
        acc[a.audit_type] = { total: 0, count: 0 };
      }
      acc[a.audit_type].total += Number(a.fees);
      acc[a.audit_type].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>)
  ).map(([type, data]: [string, { total: number; count: number }]) => ({
    type,
    avgFees: Number((data.total / data.count).toFixed(0))
  }));

  // Performance metrics
  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter(a => a.status === 'completed' || a.status === 'paid').length;
  const overallCompletionRate = totalAssignments > 0 ? ((completedAssignments / totalAssignments) * 100).toFixed(1) : '0';
  const totalRevenue = assignments.reduce((sum, a) => sum + Number(a.fees), 0);
  const avgFees = totalAssignments > 0 ? (totalRevenue / totalAssignments).toFixed(0) : '0';
  const avgRating = assignments.filter(a => a.auditor_rating).length > 0
    ? (assignments.reduce((sum, a) => sum + (Number(a.auditor_rating) || 0), 0) / assignments.filter(a => a.auditor_rating).length).toFixed(1)
    : 'N/A';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Analytics & Insights</h2>
      
      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completion Rate</CardDescription>
            <CardTitle className="text-3xl">{overallCompletionRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {completedAssignments} of {totalAssignments} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-3xl">₹{totalRevenue.toLocaleString('en-IN')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across all assignments
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Fees</CardDescription>
            <CardTitle className="text-3xl">₹{Number(avgFees).toLocaleString('en-IN')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Per assignment
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Auditor Rating</CardDescription>
            <CardTitle className="text-3xl">{avgRating}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Out of 5 stars
            </p>
          </CardContent>
        </Card>
      </div>
      
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

        {/* Completion Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Completion Rate Trend</CardTitle>
            <CardDescription>Percentage of assignments completed over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={completionRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="rate" stroke="hsl(var(--accent-foreground))" strokeWidth={2} name="Completion %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Average Fees by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Average Fees by Audit Type</CardTitle>
            <CardDescription>Comparison of average fees across audit types</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={feesByTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                <Bar dataKey="avgFees" fill="hsl(var(--chart-4))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}