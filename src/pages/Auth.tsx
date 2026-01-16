import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';
import { z } from 'zod';
import { Shield, ArrowLeft, Phone, Mail, User, Lock } from 'lucide-react';

// Validation schemas
const emailSchema = z.string().trim().email('Please enter a valid email address').max(255, 'Email must be less than 255 characters');

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const fullNameSchema = z.string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

const phoneSchema = z.string()
  .trim()
  .min(10, 'Mobile number must be at least 10 digits')
  .max(15, 'Mobile number must be less than 15 digits')
  .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number');

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  phone: phoneSchema,
});

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string; phone?: string }>({});
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const validateSignUp = (): boolean => {
    const result = signUpSchema.safeParse({ email, password, fullName, phone });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string; fullName?: string; phone?: string } = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        if (!fieldErrors[field as keyof typeof fieldErrors]) {
          fieldErrors[field as keyof typeof fieldErrors] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const validateSignIn = (): boolean => {
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        if (!fieldErrors[field as keyof typeof fieldErrors]) {
          fieldErrors[field as keyof typeof fieldErrors] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSignUp()) {
      return;
    }
    
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Update the profile with phone number
        await supabase.from('profiles').update({ phone: phone.trim() }).eq('id', data.user.id);
        
        toast.success('Account created successfully! Please complete your profile after signing in.');
        setEmail('');
        setPassword('');
        setFullName('');
        setPhone('');
        setErrors({});
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSignIn()) {
      return;
    }
    
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      toast.success('Signed in successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearErrors = () => {
    if (Object.keys(errors).length > 0) {
      setErrors({});
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="p-6">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 hover:bg-primary/10">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            <span className="font-heading text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">AuditHub</span>
          </div>

          <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold text-center">Welcome</CardTitle>
              <CardDescription className="text-center">
                Sign in to manage your audits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin" className="w-full" onValueChange={clearErrors}>
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                  <TabsTrigger value="signin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Sign In</TabsTrigger>
                  <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-0">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        Email
                      </Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                        required
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password" className="flex items-center gap-2 text-sm font-medium">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        Password
                      </Label>
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                        }}
                        className={errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}
                        required
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={loading}>
                      {loading ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="flex items-center gap-2 text-sm font-medium">
                        <User className="h-4 w-4 text-muted-foreground" />
                        Full Name
                      </Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
                        }}
                        className={errors.fullName ? 'border-destructive focus-visible:ring-destructive' : ''}
                        required
                      />
                      {errors.fullName && (
                        <p className="text-sm text-destructive">{errors.fullName}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone" className="flex items-center gap-2 text-sm font-medium">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        Mobile Number <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setPhone(value);
                          if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                        }}
                        className={errors.phone ? 'border-destructive focus-visible:ring-destructive' : ''}
                        required
                      />
                      {errors.phone && (
                        <p className="text-sm text-destructive">{errors.phone}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        Email
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                        required
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="flex items-center gap-2 text-sm font-medium">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        Password
                      </Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                        }}
                        className={errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}
                        required
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        At least 8 characters with uppercase, lowercase, and a number
                      </p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-xl border border-border/50">
                      <p className="text-sm text-muted-foreground">
                        📋 All new accounts are created as Auditors. Contact your admin for role changes.
                      </p>
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={loading}>
                      {loading ? 'Creating account...' : 'Create Account'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}