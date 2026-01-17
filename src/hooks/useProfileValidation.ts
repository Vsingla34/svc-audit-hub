import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface ProfileStatus {
  isComplete: boolean;
  kycStatus: string | null;
  missingFields: string[];
  canApply: boolean;
}

export function useProfileValidation() {
  const { user } = useAuth();
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>({
    isComplete: false,
    kycStatus: null,
    missingFields: [],
    canApply: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkProfile();
    }
  }, [user]);

  const checkProfile = async () => {
    if (!user) return;

    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Get auditor profile
      const { data: auditorProfile } = await supabase
        .from('auditor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const missingFields: string[] = [];

      // Check main profile fields
      if (!profile?.phone) missingFields.push('Mobile Number');
      if (!profile?.full_name) missingFields.push('Full Name');

      // Check auditor profile fields
      if (!auditorProfile) {
        missingFields.push('Auditor Profile (not created)');
      } else {
        if (!auditorProfile.pan_card) missingFields.push('PAN Card');
        if (!auditorProfile.base_city) missingFields.push('Base City');
        if (!auditorProfile.base_state) missingFields.push('Base State');
        if (!auditorProfile.qualifications || auditorProfile.qualifications.length === 0) {
          missingFields.push('Qualifications');
        }
        if (!auditorProfile.experience_years && auditorProfile.experience_years !== 0) {
          missingFields.push('Experience Years');
        }
      }

      const isComplete = missingFields.length === 0;
      const kycStatus = auditorProfile?.kyc_status || null;
      const canApply = isComplete && kycStatus === 'approved';

      setProfileStatus({
        isComplete,
        kycStatus,
        missingFields,
        canApply,
      });
    } catch (error) {
      console.error('Error checking profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return { ...profileStatus, loading, refreshProfile: checkProfile };
}
