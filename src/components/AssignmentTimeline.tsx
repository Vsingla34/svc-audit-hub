import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { 
  CheckCircle, MapPin, FileText, Clock, User, 
  AlertCircle, Star, Truck, Send, Eye
} from 'lucide-react';

interface Activity {
  id: string;
  activity_type: string;
  description: string;
  metadata: any;
  created_at: string;
  user_id: string;
}

interface AssignmentTimelineProps {
  assignmentId: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  reportUrl?: string | null;
  completedAt?: string | null;
  status?: string;
}

const activityIcons: Record<string, any> = {
  'created': CheckCircle,
  'allotted': User,
  'check_in': MapPin,
  'check_out': MapPin,
  'report_submitted': FileText,
  'completed': Star,
  'status_change': Clock,
  'document_uploaded': FileText,
  'application_received': Send,
  'viewed': Eye,
  'default': AlertCircle,
};

const activityColors: Record<string, string> = {
  'created': 'bg-blue-500/10 text-blue-600',
  'allotted': 'bg-green-500/10 text-green-600',
  'check_in': 'bg-emerald-500/10 text-emerald-600',
  'check_out': 'bg-amber-500/10 text-amber-600',
  'report_submitted': 'bg-purple-500/10 text-purple-600',
  'completed': 'bg-green-500/10 text-green-600',
  'status_change': 'bg-blue-500/10 text-blue-600',
  'document_uploaded': 'bg-indigo-500/10 text-indigo-600',
  'application_received': 'bg-cyan-500/10 text-cyan-600',
  'default': 'bg-muted text-muted-foreground',
};

export function AssignmentTimeline({ 
  assignmentId, 
  checkInTime, 
  checkOutTime, 
  reportUrl, 
  completedAt,
  status 
}: AssignmentTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`assignment-activities-${assignmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assignment_activities',
          filter: `assignment_id=eq.${assignmentId}`,
        },
        (payload) => {
          setActivities(prev => [payload.new as Activity, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignmentId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('assignment_activities')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build timeline from activities + assignment data
  const buildTimelineItems = () => {
    const items: { type: string; description: string; time: string; metadata?: any }[] = [];

    // Add activities from database
    activities.forEach(activity => {
      items.push({
        type: activity.activity_type,
        description: activity.description,
        time: activity.created_at,
        metadata: activity.metadata,
      });
    });

    // Add milestone events from assignment data if not already in activities
    if (checkInTime && !activities.find(a => a.activity_type === 'check_in')) {
      items.push({
        type: 'check_in',
        description: 'Auditor checked in at location',
        time: checkInTime,
      });
    }

    if (checkOutTime && !activities.find(a => a.activity_type === 'check_out')) {
      items.push({
        type: 'check_out',
        description: 'Auditor checked out from location',
        time: checkOutTime,
      });
    }

    if (reportUrl && !activities.find(a => a.activity_type === 'report_submitted')) {
      items.push({
        type: 'report_submitted',
        description: 'Audit report submitted',
        time: completedAt || new Date().toISOString(),
      });
    }

    if (completedAt && !activities.find(a => a.activity_type === 'completed')) {
      items.push({
        type: 'completed',
        description: 'Assignment marked as completed',
        time: completedAt,
      });
    }

    // Sort by time descending
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  };

  const timelineItems = buildTimelineItems();

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {timelineItems.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No activities recorded yet</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border"></div>
            
            <div className="space-y-4">
              {timelineItems.map((item, index) => {
                const Icon = activityIcons[item.type] || activityIcons.default;
                const colorClass = activityColors[item.type] || activityColors.default;
                
                return (
                  <div key={index} className="relative pl-12">
                    {/* Icon */}
                    <div className={`absolute left-0 h-10 w-10 rounded-full flex items-center justify-center ${colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    
                    {/* Content */}
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="font-medium text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(item.time), 'dd MMM yyyy, hh:mm a')}
                      </p>
                      {item.metadata && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {typeof item.metadata === 'object' 
                            ? Object.entries(item.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')
                            : item.metadata}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
