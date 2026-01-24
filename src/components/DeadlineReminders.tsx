import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AlertTriangle, Clock, Send, RefreshCw } from 'lucide-react';
import { format, differenceInDays, isPast, isToday } from 'date-fns';

interface Assignment {
  id: string;
  assignment_number: string;
  client_name: string;
  branch_name: string;
  city: string;
  state: string;
  deadline_date: string;
  status: string;
  allotted_to: string | null;
  auditor?: {
    full_name: string;
    email: string;
  };
}

export function DeadlineReminders() {
  const [overdueAssignments, setOverdueAssignments] = useState<Assignment[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReminders, setSendingReminders] = useState(false);

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const fetchDeadlines = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(today.getDate() + 7);

      // Fetch allotted assignments with deadlines
      // We explicitly join on the 'allotted_to' column to avoid ambiguity
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          auditor:profiles!allotted_to(full_name, email)
        `)
        .in('status', ['allotted', 'in_progress'])
        .not('allotted_to', 'is', null)
        .lte('deadline_date', sevenDaysFromNow.toISOString().split('T')[0])
        .order('deadline_date', { ascending: true });

      if (error) {
        console.error('Fetch error:', error);
        throw error;
      }

      const overdue: Assignment[] = [];
      const upcoming: Assignment[] = [];

      (data || []).forEach((assignment: Assignment) => {
        const deadlineDate = new Date(assignment.deadline_date);
        
        // Logic: Past AND Not Today = Overdue
        // Logic: Today OR Future = Upcoming (within the 7-day query limit)
        if (isPast(deadlineDate) && !isToday(deadlineDate)) {
          overdue.push(assignment);
        } else {
          upcoming.push(assignment);
        }
      });

      setOverdueAssignments(overdue);
      setUpcomingDeadlines(upcoming);
    } catch (error: any) {
      toast.error('Failed to fetch deadlines');
    } finally {
      setLoading(false);
    }
  };

  const sendDeadlineReminders = async () => {
    setSendingReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-deadline-reminder');
      
      if (error) throw error;
      
      toast.success(data?.message || 'Deadline reminders sent successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reminders');
    } finally {
      setSendingReminders(false);
    }
  };

  const getDeadlineStatus = (deadlineDate: string) => {
    const deadline = new Date(deadlineDate);
    const daysUntil = differenceInDays(deadline, new Date());

    if (isPast(deadline) && !isToday(deadline)) {
      return { label: 'Overdue', variant: 'destructive' as const, daysText: `${Math.abs(daysUntil)} days overdue` };
    }
    if (isToday(deadline)) {
      return { label: 'Due Today', variant: 'destructive' as const, daysText: 'Due today!' };
    }
    if (daysUntil <= 3) {
      return { label: 'Critical', variant: 'destructive' as const, daysText: `${daysUntil} days left` };
    }
    return { label: 'Upcoming', variant: 'secondary' as const, daysText: `${daysUntil} days left` };
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Deadline Management</h2>
          <p className="text-muted-foreground">Monitor and manage assignment deadlines</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDeadlines} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={sendDeadlineReminders} disabled={sendingReminders}>
            <Send className="h-4 w-4 mr-2" />
            {sendingReminders ? 'Sending...' : 'Send All Reminders'}
          </Button>
        </div>
      </div>

      {/* Overdue Section */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Overdue Assignments</CardTitle>
          </div>
          <CardDescription>
            Assignments that have passed their submission deadline
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && overdueAssignments.length === 0 ? (
             <div className="py-4 text-center text-muted-foreground">Loading...</div>
          ) : overdueAssignments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No overdue assignments</p>
          ) : (
            <div className="space-y-3">
              {overdueAssignments.map((assignment) => {
                const status = getDeadlineStatus(assignment.deadline_date);
                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-card"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{assignment.client_name}</span>
                        <Badge variant="outline" className="text-xs">
                          #{assignment.assignment_number?.substring(0, 8)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {assignment.branch_name} • {assignment.city}, {assignment.state}
                      </div>
                      <div className="text-sm">
                        Auditor: <span className="font-medium">{assignment.auditor?.full_name || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <div className="text-sm text-destructive font-medium">
                        {status.daysText}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Deadline: {format(new Date(assignment.deadline_date), 'dd MMM yyyy')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Deadlines */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            <CardTitle>Upcoming Deadlines (Next 7 Days)</CardTitle>
          </div>
          <CardDescription>
            Assignments expiring in one week
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && upcomingDeadlines.length === 0 ? (
             <div className="py-4 text-center text-muted-foreground">Loading...</div>
          ) : upcomingDeadlines.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No upcoming deadlines</p>
          ) : (
            <div className="space-y-3">
              {upcomingDeadlines.map((assignment) => {
                const status = getDeadlineStatus(assignment.deadline_date);
                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{assignment.client_name}</span>
                        <Badge variant="outline" className="text-xs">
                          #{assignment.assignment_number?.substring(0, 8)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {assignment.branch_name} • {assignment.city}, {assignment.state}
                      </div>
                      <div className="text-sm">
                        Auditor: <span className="font-medium">{assignment.auditor?.full_name || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <div className="text-sm font-medium">
                        {status.daysText}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Deadline: {format(new Date(assignment.deadline_date), 'dd MMM yyyy')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}