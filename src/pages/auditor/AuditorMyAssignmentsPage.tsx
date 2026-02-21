import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Lock, PlayCircle, Briefcase, Calendar, Clock, MapPin, Building2, XCircle, ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';
import { format, isPast, isToday } from 'date-fns';

export default function AuditorMyAssignmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // In-page navigation state
  const [activeView, setActiveView] = useState<'assignments' | 'applications'>('assignments');

  // 1. Fetch Assignments (Allotted/Won Jobs)
  const { data: myAssignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['auditor-assignments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('allotted_to', user?.id)
        .order('audit_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // 2. Fetch Applications (Pending/Rejected/Accepted history)
  const { data: myApplications = [], isLoading: loadingApps } = useQuery({
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
      const { error } = await supabase.from('applications').delete().eq('id', applicationId);
      if (error) throw error;
      
      toast.success('Application withdrawn successfully.');
      queryClient.invalidateQueries({ queryKey: ['auditor-applications', user?.id] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to withdraw application');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20">Pending Review</Badge>;
      case 'accepted': return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">Accepted</Badge>;
      case 'rejected': return <Badge variant="destructive">Not Selected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout title="My Jobs & Applications" navItems={auditorNavItems} activeTab="my-jobs">
      <div className="space-y-6 max-w-7xl mx-auto py-6">
        
        {/* IN-PAGE NAVIGATION (SUB-NAVBAR) */}
        <div className="flex p-1 space-x-1 bg-muted/50 rounded-xl w-fit mb-6">
          <Button
            variant={activeView === 'assignments' ? 'default' : 'ghost'}
            className={`rounded-lg px-6 ${activeView === 'assignments' ? 'bg-[#4338CA] text-white hover:bg-[#4338CA]/90 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveView('assignments')}
          >
            <Briefcase className="h-4 w-4 mr-2" />
            Allotted Audits
            <Badge variant="secondary" className={`ml-2 ${activeView === 'assignments' ? 'bg-white/20 text-white hover:bg-white/30' : ''}`}>
              {myAssignments.length}
            </Badge>
          </Button>
          
          <Button
            variant={activeView === 'applications' ? 'default' : 'ghost'}
            className={`rounded-lg px-6 ${activeView === 'applications' ? 'bg-[#4338CA] text-white hover:bg-[#4338CA]/90 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveView('applications')}
          >
            <Clock className="h-4 w-4 mr-2" />
            Application History
            <Badge variant="secondary" className={`ml-2 ${activeView === 'applications' ? 'bg-white/20 text-white hover:bg-white/30' : ''}`}>
              {myApplications.length}
            </Badge>
          </Button>
        </div>

        {/* ========================================= */}
        {/* VIEW 1: MY ASSIGNMENTS (ALLOTTED)         */}
        {/* ========================================= */}
        {activeView === 'assignments' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {loadingAssignments ? (
              <div className="flex justify-center py-12 text-muted-foreground animate-pulse">Loading assignments...</div>
            ) : myAssignments.length === 0 ? (
              <Card className="border-none shadow-md">
                <CardContent className="py-16 text-center flex flex-col items-center">
                  <Calendar className="h-12 w-12 text-muted-foreground/20 mb-3" />
                  <h3 className="text-lg font-medium text-foreground">No active assignments</h3>
                  <p className="text-muted-foreground mb-4">You have not been allotted any jobs yet.</p>
                  <Button onClick={() => navigate('/auditor/available-jobs')} className="bg-[#4338CA] hover:bg-[#4338CA]/90">Browse Jobs</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {myAssignments.map((a) => {
                  const auditDate = new Date(a.audit_date);
                  const isActive = isToday(auditDate) || isPast(auditDate);
                  const isCompleted = a.status === 'completed' || a.status === 'paid';

                  return (
                    <Card key={a.id} className={`hover:shadow-lg transition-all duration-300 cursor-pointer border-none shadow-md overflow-hidden relative flex flex-col h-full`} onClick={() => navigate(`/assignment/${a.id}`)}>
                      <div className={`absolute left-0 top-0 h-full w-1.5 ${isCompleted ? 'bg-green-500' : isActive ? 'bg-[#4338CA]' : 'bg-muted-foreground/30'}`} />
                      
                      <CardHeader className="pb-3 pt-5 pl-6">
                          <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold border-[#4338CA]/30 text-[#4338CA] bg-[#4338CA]/5">{a.audit_type}</Badge>
                                  {!isActive && !isCompleted && <Badge variant="secondary" className="text-[10px] flex gap-1 font-medium bg-muted text-muted-foreground"><Lock className="h-3 w-3"/> Scheduled</Badge>}
                                  {isActive && !isCompleted && <Badge className="text-[10px] bg-[#4338CA] flex gap-1 font-medium hover:bg-[#4338CA]/90 text-white"><PlayCircle className="h-3 w-3"/> Active</Badge>}
                              </div>
                          </div>
                          <CardTitle className={`text-lg leading-tight ${(!isActive && !isCompleted) ? 'text-muted-foreground' : 'text-foreground'}`}>{a.client_name}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">{a.city}, {a.state}</CardDescription>
                      </CardHeader>

                      <CardContent className="flex-1 pb-4 pl-6">
                        <div className="grid grid-cols-2 gap-3 text-sm bg-muted/20 p-3 rounded-lg border border-border/50">
                            <div>
                              <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold mb-0.5 block">Audit Date</span>
                              <div className="font-medium text-foreground">{format(auditDate, 'dd MMM yyyy')}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold mb-0.5 block">Deadline</span>
                              <div className="font-medium text-foreground">{format(new Date(a.deadline_date), 'dd MMM yyyy')}</div>
                            </div>
                        </div>
                      </CardContent>

                      <div className="px-6 pb-5 pt-2 flex items-center justify-between mt-auto">
                        <StatusBadge status={a.status} />
                        {a.status === 'allotted' && (
                            isActive ? (
                              <Button variant="outline" size="sm" className="border-[#4338CA] text-[#4338CA] hover:bg-[#4338CA] hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); navigate('/auditor/live-report'); }}>
                                Go to Live Report
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" disabled className="opacity-50 cursor-not-allowed text-xs"><Lock className="h-3 w-3 mr-1.5" /> Starts {format(auditDate, 'dd MMM')}</Button>
                            )
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ========================================= */}
        {/* VIEW 2: MY APPLICATIONS HISTORY           */}
        {/* ========================================= */}
        {activeView === 'applications' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card className="border-none shadow-md">
              <CardContent className="p-0">
                {loadingApps ? (
                  <div className="flex justify-center py-12 text-muted-foreground animate-pulse">Loading applications...</div>
                ) : myApplications.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center">
                    <Clock className="h-10 w-10 text-muted-foreground/20 mb-3" />
                    <p className="text-muted-foreground mb-4">You haven't applied to any assignments.</p>
                    <Button onClick={() => navigate('/auditor/available-jobs')} variant="outline">Browse Jobs</Button>
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
                              <Badge variant="outline" className="text-[10px] uppercase font-semibold text-[#4338CA] border-[#4338CA]/30">{app.assignment?.audit_type}</Badge>
                              <span className="font-medium text-foreground ml-1">₹{app.assignment?.fees?.toLocaleString()}/day</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm"><MapPin className="h-4 w-4 mr-1 text-muted-foreground" />{app.assignment?.city}, {app.assignment?.state}</div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(app.applied_at), 'dd MMM yyyy')}</TableCell>
                          <TableCell>{getStatusBadge(app.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => navigate(`/assignment/${app.assignment_id}`)} title="View Job Details"><ArrowRight className="h-4 w-4" /></Button>
                              {app.status === 'pending' && (
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleWithdrawApplication(app.id)} title="Withdraw Application">
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
          </section>
        )}

      </div>
    </DashboardLayout>
  );
}