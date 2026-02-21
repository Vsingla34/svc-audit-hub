import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, IndianRupee, Briefcase, GraduationCap, Clock, Calendar, ArrowRight, Shield } from 'lucide-react';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';
import { format } from 'date-fns';

export default function AuditorAvailableJobsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Filters
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterAuditType, setFilterAuditType] = useState<string>('all');

  // 1. Get profile state (cached)
  const { data: profile } = useQuery({
    queryKey: ['auditor-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('auditor_profiles').select('base_state, preferred_states').eq('user_id', user?.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // 2. Fetch or load cached open jobs
  const { data: openAssignments = [], isLoading } = useQuery({
    queryKey: ['available-jobs', user?.id, profile?.base_state],
    queryFn: async () => {
      let query = supabase.from('assignments').select('*').eq('status', 'open').order('audit_date', { ascending: true });
      if (profile) {
        const allowedStates = [profile.base_state, ...(profile.preferred_states || [])].filter(Boolean);
        if (allowedStates.length > 0) {
          query = query.in('state', allowedStates);
        }
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 mins
  });

  // 3. Fast client-side filtering using useMemo
  const filteredOpenAssignments = useMemo(() => {
    return openAssignments.filter(a => {
      if (filterState !== 'all' && a.state !== filterState) return false;
      if (filterCity !== 'all' && a.city !== filterCity) return false;
      if (filterAuditType !== 'all' && a.audit_type !== filterAuditType) return false;
      return true;
    });
  }, [openAssignments, filterState, filterCity, filterAuditType]);
  
  // Extract unique dropdown options
  const uniqueStates = useMemo(() => [...new Set(openAssignments.map(a => a.state))].filter(Boolean).sort(), [openAssignments]);
  const uniqueCities = useMemo(() => [...new Set(openAssignments.map(a => a.city))].filter(Boolean).sort(), [openAssignments]);
  const uniqueAuditTypes = useMemo(() => [...new Set(openAssignments.map(a => a.audit_type))].filter(Boolean).sort(), [openAssignments]);

  return (
    <DashboardLayout title="Available Jobs" navItems={auditorNavItems} activeTab="available-jobs">
      <div className="space-y-6 max-w-7xl mx-auto py-6">
        
        {/* Filters Section */}
        <Card className="bg-muted/30 border-none shadow-sm">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>State</Label>
                <Select value={filterState} onValueChange={setFilterState}>
                  <SelectTrigger><SelectValue placeholder="All States" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {uniqueStates.map(s => <SelectItem key={s as string} value={s as string}>{s as string}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>City</Label>
                <Select value={filterCity} onValueChange={setFilterCity}>
                  <SelectTrigger><SelectValue placeholder="All Cities" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {uniqueCities.map(c => <SelectItem key={c as string} value={c as string}>{c as string}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Audit Type</Label>
                <Select value={filterAuditType} onValueChange={setFilterAuditType}>
                  <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueAuditTypes.map(t => <SelectItem key={t as string} value={t as string}>{t as string}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Listing */}
        {isLoading ? (
           <div className="flex justify-center py-12 text-muted-foreground animate-pulse">Loading available jobs...</div>
        ) : filteredOpenAssignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Briefcase className="h-10 w-10 opacity-20"/>
              <p>No assignments found matching your criteria.</p>
              {(filterState !== 'all' || filterCity !== 'all' || filterAuditType !== 'all') && (
                <Button variant="outline" className="mt-4" onClick={() => { setFilterState('all'); setFilterCity('all'); setFilterAuditType('all'); }}>
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredOpenAssignments.map(a => (
              <Card key={a.id} className="group hover:shadow-xl transition-all duration-300 border-none shadow-md bg-card overflow-hidden flex flex-col h-full relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4338CA] to-[#4338CA]/60" />
                  <CardHeader className="pb-3 pt-5">
                      <div className="flex justify-between items-start gap-2">
                          <Badge variant="outline" className="mb-2 w-fit border-[#4338CA]/20 text-[#4338CA] bg-[#4338CA]/5 uppercase text-[10px] tracking-wider font-semibold">
                            {a.audit_type}
                          </Badge>
                          <Badge variant="secondary" className="bg-[#4338CA]/10 text-[#4338CA] font-bold border border-[#4338CA]/20">
                            <IndianRupee className="h-3 w-3 mr-1" />{a.fees?.toLocaleString()}/day
                          </Badge>
                      </div>
                      <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono text-muted-foreground">
                              #{a.assignment_number || a.id.substring(0, 6).toUpperCase()}
                            </span>
                          </div>
                          <CardTitle className="text-lg font-bold leading-tight group-hover:text-[#4338CA] transition-colors flex items-center gap-2">
                            {a.industry || 'Confidential Client'}
                            {(!a.industry) && <Shield className="h-3.5 w-3.5 text-muted-foreground/60"/>}
                          </CardTitle>
                          <div className="flex items-center text-sm text-muted-foreground pt-1">
                            <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                            {a.city}, {a.state}
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent className="flex-1 pb-4">
                      <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                              <GraduationCap className="h-3.5 w-3.5" /><span>Qualification</span>
                            </div>
                            <div className="text-sm font-medium truncate" title={a.qualification_required}>
                              {a.qualification_required || 'Any'}
                            </div>
                          </div>
                          <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                              <Clock className="h-3.5 w-3.5" /><span>Duration</span>
                            </div>
                            <div className="text-sm font-medium">
                              {a.duration || 'Flexible'}
                            </div>
                          </div>
                          <div className="col-span-2 bg-muted/30 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" /><span>Start Date</span>
                            </div>
                            <div className="text-sm font-medium">
                              {a.audit_date ? format(new Date(a.audit_date), 'dd MMM yyyy') : 'N/A'}
                            </div>
                          </div>
                      </div>
                  </CardContent>
                  <CardFooter className="pt-0 pb-5 px-6">
                    <Button 
                      className="w-full shadow-sm hover:shadow group-hover:bg-[#4338CA] group-hover:text-white transition-all" 
                      onClick={() => navigate(`/assignment/${a.id}`)}
                    >
                      View Details 
                      <ArrowRight className="h-4 w-4 ml-2 opacity-70 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}