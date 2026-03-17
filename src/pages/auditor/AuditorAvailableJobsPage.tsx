import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, IndianRupee, Briefcase, GraduationCap, Clock, Calendar, ArrowRight, Shield, AlertTriangle } from 'lucide-react';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';
import { format } from 'date-fns';

export default function AuditorAvailableJobsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Filters
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterAuditType, setFilterAuditType] = useState<string>('all');

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['auditor-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('auditor_profiles').select('base_state, preferred_states, profile_status').eq('user_id', user?.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: bankKyc, isLoading: isBankLoading } = useQuery({
    queryKey: ['bank-kyc', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('bank_kyc_details').select('*').eq('user_id', user?.id).maybeSingle();
      return data || null;
    },
    enabled: !!user?.id,
  });

  // 3. STEP 1 FIX: Filter out assignments that have reached the 5 application limit
  const { data: openAssignments = [], isLoading: isJobsLoading } = useQuery({
    queryKey: ['available-jobs', user?.id, profile?.base_state],
    queryFn: async () => {
      let query = supabase.from('assignments')
        .select('*')
        .eq('status', 'open')
        .or('applicant_count.lt.5,applicant_count.is.null') // Only fetch if under 5 applicants!
        .order('audit_date', { ascending: true });
        
      if (profile) {
        const allowedStates = [profile.base_state, ...(profile.preferred_states || [])].filter(Boolean);
        if (allowedStates.length > 0) {
          query = query.in('state', allowedStates);
        }
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id && profile?.profile_status === 'approved',
    staleTime: 1000 * 60 * 5, 
  });

  const isLoading = isProfileLoading || isBankLoading || isJobsLoading;

  const filteredOpenAssignments = useMemo(() => {
    return openAssignments.filter(a => {
      if (filterState !== 'all' && a.state !== filterState) return false;
      if (filterCity !== 'all' && a.city !== filterCity) return false;
      if (filterAuditType !== 'all' && a.audit_type !== filterAuditType) return false;
      return true;
    });
  }, [openAssignments, filterState, filterCity, filterAuditType]);
  
  const uniqueStates = useMemo(() => [...new Set(openAssignments.map(a => a.state))].filter(Boolean).sort(), [openAssignments]);
  const uniqueCities = useMemo(() => [...new Set(openAssignments.map(a => a.city))].filter(Boolean).sort(), [openAssignments]);
  const uniqueAuditTypes = useMemo(() => [...new Set(openAssignments.map(a => a.audit_type))].filter(Boolean).sort(), [openAssignments]);

  if (!isLoading && (profile?.profile_status !== 'approved' || !bankKyc || bankKyc?.status === 'rejected')) {
    return (
      <DashboardLayout title="Available Jobs" navItems={auditorNavItems} activeTab="available-jobs">
        <div className="space-y-6 max-w-7xl mx-auto py-10 px-4">
          <Card className="border-destructive/30 shadow-lg rounded-2xl overflow-hidden bg-destructive/5">
            <CardContent className="py-20 text-center flex flex-col items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                 <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold text-destructive">Verification Required</h2>
              <p className="text-muted-foreground max-w-lg text-sm md:text-base">
                Your profile or bank details are currently pending approval, rejected, or incomplete. 
                You must be fully verified by our admin team before you can view or apply for available assignments.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <Button variant="default" className="bg-destructive hover:bg-destructive/90" onClick={() => navigate('/profile-setup')}>
                  Review Profile Status
                </Button>
                <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => navigate('/bank-kyc')}>
                  Review Bank Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Available Jobs" navItems={auditorNavItems} activeTab="available-jobs">
      <div className="space-y-6 max-w-7xl mx-auto py-6">
        
        <Card className="bg-white border shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">State</Label>
                <Select value={filterState} onValueChange={setFilterState}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="All States" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {uniqueStates.map(s => <SelectItem key={s as string} value={s as string}>{s as string}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</Label>
                <Select value={filterCity} onValueChange={setFilterCity}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="All Cities" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {uniqueCities.map(c => <SelectItem key={c as string} value={c as string}>{c as string}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audit Type</Label>
                <Select value={filterAuditType} onValueChange={setFilterAuditType}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="All Types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueAuditTypes.map(t => <SelectItem key={t as string} value={t as string}>{t as string}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        {isLoading ? (
           <div className="flex justify-center py-12 text-muted-foreground animate-pulse">Loading available jobs...</div>
        ) : filteredOpenAssignments.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/10">
            <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-3">
              <Briefcase className="h-12 w-12 opacity-20"/>
              <p className="text-lg font-medium text-foreground">No matching assignments found.</p>
              <p className="text-sm max-w-sm">Assignments are automatically hidden once they reach their maximum application limit.</p>
              {(filterState !== 'all' || filterCity !== 'all' || filterAuditType !== 'all') && (
                <Button variant="outline" className="mt-4" onClick={() => { setFilterState('all'); setFilterCity('all'); setFilterAuditType('all'); }}>
                  Clear All Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {filteredOpenAssignments.map(a => {
              const totalPayout = (a.fees || 0) + (a.ope || 0) + (a.reimbursement_food || 0) + (a.reimbursement_courier || 0) + (a.reimbursement_conveyance || 0);
              
              return (
                <Card key={a.id} className="group hover:shadow-xl transition-all duration-200 border-border/60 shadow-sm bg-white overflow-hidden flex flex-col h-full relative rounded-xl">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#4338CA] opacity-90" />
                    
                    <div className="p-4 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                            <Badge variant="secondary" className="bg-[#4338CA]/10 text-[#4338CA] hover:bg-[#4338CA]/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                              {a.audit_type}
                            </Badge>
                            <div className="text-right">
                               <div className="text-sm font-extrabold text-green-600 flex items-center justify-end">
                                 <IndianRupee className="h-3.5 w-3.5" />{totalPayout.toLocaleString('en-IN')}
                               </div>
                               <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">Up to / day</div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <h3 className="text-base font-bold leading-tight text-foreground group-hover:text-[#4338CA] transition-colors line-clamp-1 mb-1.5" title={a.industry || 'Confidential Client'}>
                              {a.industry || 'Confidential Client'}
                              {(!a.industry) && <Shield className="h-3.5 w-3.5 inline ml-1.5 text-muted-foreground/50"/>}
                            </h3>
                            <div className="flex items-center text-xs text-muted-foreground font-medium">
                              <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground/70" />
                              <span className="truncate">{a.city}, {a.state}</span>
                            </div>
                        </div>

                        <div className="bg-muted/40 rounded-lg p-3 space-y-2.5 mt-auto border border-border/50">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5 mr-1.5" /> Start
                              </div>
                              <span className="font-semibold text-foreground">
                                {a.audit_date ? format(new Date(a.audit_date), 'dd MMM yyyy') : 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center text-muted-foreground">
                                <Clock className="h-3.5 w-3.5 mr-1.5" /> Duration
                              </div>
                              <span className="font-medium text-foreground">
                                {a.duration || 'Flexible'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center text-muted-foreground">
                                <GraduationCap className="h-3.5 w-3.5 mr-1.5" /> Qual.
                              </div>
                              <span className="font-medium text-foreground truncate max-w-[110px] text-right" title={a.qualification_required || 'Any'}>
                                {a.qualification_required || 'Any'}
                              </span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 pt-0">
                      <Button 
                        variant="outline"
                        size="sm"
                        className="w-full font-semibold border-[#4338CA]/20 text-[#4338CA] bg-white hover:bg-[#4338CA] hover:text-white transition-all group-hover:border-[#4338CA]" 
                        onClick={() => navigate(`/assignment/${a.id}`)}
                      >
                        View Details 
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5 opacity-70 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}