import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, User, Mail, Phone, Save, Shield, Loader2 } from 'lucide-react';
import { z } from 'zod';

const phoneSchema = z.string()
  .trim()
  .min(10, 'Mobile number must be at least 10 digits')
  .max(15, 'Mobile number must be less than 15 digits')
  .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number');

const fullNameSchema = z.string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

export default function ProfileEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
  });
  const [errors, setErrors] = useState<{ full_name?: string; phone?: string }>({});

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      
      setProfile(data);
      setFormData({
        full_name: data.full_name || '',
        phone: data.phone || '',
      });
    } catch (error: any) {
      toast.error('Failed to load profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { full_name?: string; phone?: string } = {};
    
    const nameResult = fullNameSchema.safeParse(formData.full_name);
    if (!nameResult.success) {
      newErrors.full_name = nameResult.error.errors[0].message;
    }

    if (formData.phone) {
      const phoneResult = phoneSchema.safeParse(formData.phone);
      if (!phoneResult.success) {
        newErrors.phone = phoneResult.error.errors[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error('Failed to update profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="gap-2 hover:bg-primary/10 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/50 pb-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Edit Profile</CardTitle>
                <CardDescription className="mt-1">
                  Update your personal information
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email (Read-only) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email Address
                </Label>
                <div className="relative">
                  <Input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="bg-muted/50 cursor-not-allowed"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Full Name
                </Label>
                <Input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => {
                    setFormData({ ...formData, full_name: e.target.value });
                    if (errors.full_name) setErrors({ ...errors, full_name: undefined });
                  }}
                  placeholder="Enter your full name"
                  className={errors.full_name ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.full_name && (
                  <p className="text-sm text-destructive">{errors.full_name}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Mobile Number
                </Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, phone: value });
                    if (errors.phone) setErrors({ ...errors, phone: undefined });
                  }}
                  placeholder="9876543210"
                  className={errors.phone ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Enter your 10-digit Indian mobile number
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Additional Actions Card */}
        <Card className="mt-6 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-lg">Account Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/profile-setup')}>
              <Shield className="h-4 w-4 mr-2" />
              Update Auditor Profile & KYC
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}