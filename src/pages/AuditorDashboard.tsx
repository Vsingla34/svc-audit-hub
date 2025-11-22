import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { AssignmentCard } from '@/components/AssignmentCard';
import { LogOut, Briefcase, Clock, CheckCircle } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

export default function AuditorDashboard() {
  const { signOut, user } = useAuth();
  const [openAssignments, setOpenAssignments] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch open assignments
      const { data: openData, error: openError } = await supabase
        .from('assignments')
        .select('*')
        .eq('status', 'open')
        .order('audit_date', { ascending: true });

      if (openError) throw openError;
      setOpenAssignments(openData || []);

      // Fetch my applications
      const { data: applicationsData, error: applicationsError } = await supabase
        .from('applications')
        .select(`
          *,
          assignment:assignments(*)
        `)
        .eq('auditor_id', user?.id)
        .order('applied_at', { ascending: false });

      if (applicationsError) throw applicationsError;
      setMyApplications(applicationsData || []);

      // Fetch my allotted assignments
      const { data: myData, error: myError } = await supabase
        .from('assignments')
        .select('*')
        .eq('allotted_to', user?.id)
        .order('audit_date', { ascending: true });

      if (myError) throw myError;
      setMyAssignments(myData || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (assignmentId: string) => {
    try {
      // Check if already applied
      const existingApplication = myApplications.find(
        app => app.assignment_id === assignmentId
      );

      if (existingApplication) {
        toast.error('You have already applied for this assignment');
        return;
      }

      const { error } = await supabase.from('applications').insert({
        assignment_id: assignmentId,
        auditor_id: user?.id,
      });

      if (error) throw error;

      toast.success('Application submitted successfully!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Auditor Dashboard</h1>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available Jobs</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-primary" />
                {openAssignments.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Applications</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Clock className="h-6 w-6 text-warning" />
                {myApplications.filter(app => app.status === 'pending').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Assignments</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-accent" />
                {myAssignments.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="available" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="available">Available Jobs</TabsTrigger>
            <TabsTrigger value="applications">My Applications</TabsTrigger>
            <TabsTrigger value="assignments">My Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-4">
            {openAssignments.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No open assignments available at the moment.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {openAssignments.map((assignment) => {
                  const hasApplied = myApplications.some(
                    app => app.assignment_id === assignment.id
                  );
                  
                  return (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      onApply={handleApply}
                      showApplyButton={!hasApplied}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="applications" className="space-y-4">
            {myApplications.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  You haven't applied for any assignments yet.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {myApplications.map((app) => (
                  <Card key={app.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{app.assignment.client_name}</CardTitle>
                          <CardDescription>{app.assignment.branch_name}</CardDescription>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <div>Location: {app.assignment.city}, {app.assignment.state}</div>
                      <div>Applied: {new Date(app.applied_at).toLocaleDateString()}</div>
                      <div>Audit Date: {new Date(app.assignment.audit_date).toLocaleDateString()}</div>
                      <div className="font-semibold text-primary mt-2">Fees: ₹{app.assignment.fees.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            {myAssignments.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No assignments allotted yet.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myAssignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
