import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardLayout, auditorNavItems } from '@/components/DashboardLayout';
import { Briefcase, Clock, CheckCircle, AlertCircle, Landmark, UserCheck, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { AuditorAnalytics } from '@/components/AuditorAnalytics';

export default function AuditorOverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 1. Fetch Profile
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['auditor-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('auditor_profiles')
        .select('profile_status, bank_status, base_state, preferred_states')
        .eq('user_id', user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 0, 
  });

  // 2. Fetch Available Jobs
  const { data: availableJobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['available-jobs', user?.id, profile?.base_state], 
    queryFn: async () => {
      let query = supabase.from('assignments').select('*').eq('status', 'open');
      if (profile) {
        const allowedStates = [profile.base_state, ...(profile.preferred_states || [])].filter(Boolean);
        if (allowedStates.length > 0) {
          query = query.in('state', allowedStates);
        }
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id && !loadingProfile, 
    staleTime: 1000 * 60 * 5,
  });

  // 3. Fetch Applications
  const { data: applications = [], isLoading: loadingApps } = useQuery({
    queryKey: ['auditor-applications', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('applications')
        .select('*, assignment:assignments(*)')
        .eq('auditor_id', user?.id)
        .order('applied_at', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // 4. Fetch Active Assignments
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['auditor-assignments', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('assignments')
        .select('*')
        .eq('allotted_to', user?.id)
        .order('audit_date', { ascending: true });
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = loadingProfile || loadingJobs || loadingApps || loadingAssignments;
  
  // Cleanly split statuses
  const profileStatus = profile?.profile_status || 'unverified';
  const bankStatus = profile?.bank_status || 'unverified';

  const openAssignmentsCount = availableJobs.length;
  const pendingApplicationsCount = applications.filter(a => a.status === 'pending').length;
  const activeAssignmentsCount = assignments.filter(a => ['allotted', 'in_progress'].includes(a.status)).length;

  return (
    <DashboardLayout title="Auditor Dashboard" navItems={auditorNavItems} activeTab="overview">
      <div className="space-y-8 max-w-7xl mx-auto py-6">
        
        {/* Only show alerts AFTER the profile data has finished loading */}
        {!loadingProfile && (
          <div className="space-y-4 animate-in fade-in duration-500">
            
            {/* --- PROFILE ALERTS --- */}
            {profileStatus === 'unverified' && (
              <Alert variant="destructive" className="border-l-4">
                <UserCheck className="h-4 w-4" />
                <AlertTitle>Complete Your Profile</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>You must complete your professional profile before applying for assignments.</span>
                  <Button size="sm" onClick={() => navigate('/profile-setup')}>Complete Profile</Button>
                </AlertDescription>
              </Alert>
            )}

            {profileStatus === 'pending' && (
              <Alert className="border-l-4 border-l-blue-500 bg-blue-50 text-blue-800 border-blue-200">
                <Clock className="h-4 w-4 text-blue-600" />
                <AlertTitle>Profile Under Review</AlertTitle>
                <AlertDescription>Your professional profile is currently being reviewed by an admin.</AlertDescription>
              </Alert>
            )}

            {profileStatus === 'rejected' && (
              <Alert variant="destructive" className="border-l-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Profile Rejected</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>Your profile update was rejected by the admin. Please update your details.</span>
                  <Button size="sm" variant="outline" onClick={() => navigate('/profile-setup')}>Update Profile</Button>
                </AlertDescription>
              </Alert>
            )}

            {/* --- BANK ALERTS --- */}
            {bankStatus === 'unverified' && (
              <Alert variant="destructive" className="border-l-4">
                <Landmark className="h-4 w-4" />
                <AlertTitle>Add Bank & KYC Details</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>We need your bank and identity details to process payouts.</span>
                  <Button size="sm" onClick={() => navigate('/bank-kyc')}>Add Bank Details</Button>
                </AlertDescription>
              </Alert>
            )}

            {bankStatus === 'pending' && (
              <Alert className="border-l-4 border-l-blue-500 bg-blue-50 text-blue-800 border-blue-200">
                <Clock className="h-4 w-4 text-blue-600" />
                <AlertTitle>Bank Details Under Review</AlertTitle>
                <AlertDescription>Your payout and KYC documents are currently being verified by an admin.</AlertDescription>
              </Alert>
            )}

            {bankStatus === 'rejected' && (
              <Alert variant="destructive" className="border-l-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Bank Details Rejected</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>Your KYC documents or bank details were rejected. Please check and update them.</span>
                  <Button size="sm" variant="outline" onClick={() => navigate('/bank-kyc')}>Update Bank Details</Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                  <CardDescription className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Available Jobs</CardDescription>
                  <CardTitle className="text-4xl flex items-center gap-3 mt-2">
                      <div className="p-3 bg-[#4338CA]/10 rounded-xl">
                         <Briefcase className="h-6 w-6 text-[#4338CA]" />
                      </div>
                      {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : openAssignmentsCount}
                  </CardTitle>
              </CardHeader>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                  <CardDescription className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Pending Applications</CardDescription>
                  <CardTitle className="text-4xl flex items-center gap-3 mt-2">
                      <div className="p-3 bg-amber-500/10 rounded-xl">
                         <Clock className="h-6 w-6 text-amber-500" />
                      </div>
                      {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : pendingApplicationsCount}
                  </CardTitle>
              </CardHeader>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                  <CardDescription className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Active Assignments</CardDescription>
                  <CardTitle className="text-4xl flex items-center gap-3 mt-2">
                      <div className="p-3 bg-green-500/10 rounded-xl">
                         <CheckCircle className="h-6 w-6 text-green-500" />
                      </div>
                      {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : activeAssignmentsCount}
                  </CardTitle>
              </CardHeader>
          </Card>
        </div>

        {/* ANALYTICS SECTION */}
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
            Performance Overview
          </h2>
          <AuditorAnalytics userId={user?.id || ''} />
        </div>

      </div>
    </DashboardLayout>
  );
}