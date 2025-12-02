import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, Award, Calendar, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface AuditorProfile {
  id: string;
  user_id: string;
  kyc_status: string;
  rating: number;
  experience_years: number;
  qualifications: string[];
  base_city: string;
  base_state: string;
  preferred_cities: string[];
  preferred_states: string[];
  profiles: {
    full_name: string;
    email: string;
    phone: string;
  };
}

export function AuditorsList() {
  const [auditors, setAuditors] = useState<AuditorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, { total: number; completed: number }>>({});

  useEffect(() => {
    fetchAuditors();
  }, []);

  const fetchAuditors = async () => {
    try {
      const { data: auditorsData, error } = await supabase
        .from('auditor_profiles')
        .select(`
          *,
          profiles:user_id (full_name, email, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAuditors((auditorsData || []) as AuditorProfile[]);

      // Fetch assignment counts for each auditor
      if (auditorsData) {
        const counts: Record<string, { total: number; completed: number }> = {};
        
        for (const auditor of auditorsData) {
          const { data: assignments } = await supabase
            .from('assignments')
            .select('id, status')
            .eq('allotted_to', auditor.user_id);

          counts[auditor.user_id] = {
            total: assignments?.length || 0,
            completed: assignments?.filter(a => a.status === 'completed').length || 0,
          };
        }
        
        setAssignmentCounts(counts);
      }
    } catch (error: any) {
      toast.error('Failed to load auditors: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getKycStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
      approved: 'default',
      pending: 'secondary',
      rejected: 'destructive',
    };
    
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading auditors...</p>
        </CardContent>
      </Card>
    );
  }

  if (auditors.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No auditors registered yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registered Auditors</CardTitle>
        <CardDescription>View all auditors and their details</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name & Contact</TableHead>
              <TableHead>KYC Status</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Qualifications</TableHead>
              <TableHead>Experience</TableHead>
              <TableHead>Base Location</TableHead>
              <TableHead>Assignments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditors.map((auditor) => (
              <TableRow key={auditor.id}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      {auditor.profiles?.full_name || 'N/A'}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {auditor.profiles?.email || 'N/A'}
                    </div>
                    {auditor.profiles?.phone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {auditor.profiles.phone}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {getKycStatusBadge(auditor.kyc_status)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-warning text-warning" />
                    <span className="font-medium">
                      {auditor.rating ? auditor.rating.toFixed(1) : 'N/A'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {auditor.qualifications?.map((q: string) => (
                      <Badge key={q} variant="outline" className="text-xs">
                        <Award className="h-3 w-3 mr-1" />
                        {q}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>{auditor.experience_years} years</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {auditor.base_city}, {auditor.base_state}
                    </div>
                    {auditor.preferred_states && auditor.preferred_states.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Prefers: {auditor.preferred_states.slice(0, 2).join(', ')}
                        {auditor.preferred_states.length > 2 && ` +${auditor.preferred_states.length - 2}`}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div className="font-medium">
                      {assignmentCounts[auditor.user_id]?.total || 0} Total
                    </div>
                    <div className="text-muted-foreground">
                      {assignmentCounts[auditor.user_id]?.completed || 0} Completed
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
