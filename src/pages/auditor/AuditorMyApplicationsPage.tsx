import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clock, MapPin, Building2, IndianRupee, XCircle, ArrowRight } from 'lucide-react';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';
import { format } from 'date-fns';

export default function AuditorMyApplicationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Load from the same shared cache established in the Overview page
  const { data: myApplications = [], isLoading } = useQuery({
    queryKey: ['auditor-applications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select('*, assignment:assignments(*)')
        .eq('auditor_id', user?.id)
        .order('applied_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const handleWithdrawApplication = async (applicationId: string) => {
    if (!confirm('Are you sure you want to withdraw this application?')) return;
    
    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', applicationId);
        
      if (error) throw error;
      
      toast.success('Application withdrawn successfully.');
      
      // Tell React Query to fetch fresh data in the background
      queryClient.invalidateQueries({ queryKey: ['auditor-applications', user?.id] });
      // We also update the specific cache for this assignment in case they look at the job details
      queryClient.invalidateQueries({ queryKey: ['assignment'] }); 
    } catch (error: any) {
      toast.error(error.message || 'Failed to withdraw application');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20">Pending Review</Badge>;
      case 'accepted':
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Not Selected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout title="My Applications" navItems={auditorNavItems} activeTab="my-applications">
      <div className="space-y-6 max-w-7xl mx-auto py-6">
        
        <Card className="border-none shadow-md">
          <CardHeader className="bg-muted/10 border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Clock className="h-5 w-5 text-[#4338CA]" />
                  Application History
                </CardTitle>
                <CardDescription className="mt-1">
                  Track the status of jobs you have applied for
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-sm">
                {myApplications.length} Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12 text-muted-foreground animate-pulse">Loading applications...</div>
            ) : myApplications.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center">
                <Clock className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <h3 className="text-lg font-medium text-foreground">No applications yet</h3>
                <p className="text-muted-foreground mb-4">You haven't applied to any assignments.</p>
                <Button onClick={() => navigate('/auditor/available-jobs')} className="bg-[#4338CA] hover:bg-[#4338CA]/90">
                  Browse Available Jobs
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Client / Industry</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Applied On</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myApplications.map((app) => (
                    <TableRow key={app.id} className="hover:bg-muted/10">
                      <TableCell>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {app.assignment?.client_name || 'Unknown Client'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px] uppercase font-semibold text-[#4338CA] border-[#4338CA]/30">
                            {app.assignment?.audit_type}
                          </Badge>
                          <span className="font-medium text-foreground ml-1">
                            ₹{app.assignment?.fees?.toLocaleString()}/day
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                          {app.assignment?.city}, {app.assignment?.state}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(app.applied_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(app.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => navigate(`/assignment/${app.assignment_id}`)}
                            title="View Job Details"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          
                          {app.status === 'pending' && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleWithdrawApplication(app.id)}
                              title="Withdraw Application"
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Withdraw
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}