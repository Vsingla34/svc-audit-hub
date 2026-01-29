import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { z } from 'zod';
import { Shield, ArrowLeft, Phone, Mail, User, Lock, KeyRound } from 'lucide-react';

// --- Validation Schemas ---
const emailSchema = z.string().trim().email('Please enter a valid email address').max(255);
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
const fullNameSchema = z.string().trim().min(2, 'Name must be at least 2 characters');
const phoneSchema = z.string().trim().min(10, 'Phone number must be at least 10 digits');
const otpSchema = z.string().trim().length(6, 'OTP must be 6 digits');

const signInSchema = z.object({ email: emailSchema, password: z.string().min(1) });
const signUpSchema = z.object({ email: emailSchema, password: passwordSchema, fullName: fullNameSchema, phone: phoneSchema });

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const validate = (schema: z.ZodObject<any>, data: any) => {
    const result = schema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => { fieldErrors[err.path[0] as string] = err.message; });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSignUpStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(signUpSchema, { email, password, fullName, phone })) return;
    
    setLoading(true);

    try {
      // 1. Sign Up
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
          },
        },
      });

      if (error) throw error;

      // Handle "Auto-Confirm" edge case (if settings are wrong)
      if (data.session) {
        toast.success("Account created! Logging you in...");
        navigate('/dashboard'); // Direct login if verification is OFF in Supabase
        return;
      }

      // Check if user is already confirmed but trying to sign up again
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        toast.error("This email is already registered. Please sign in.");
        return;
      }

      toast.success(`Verification code sent to ${email}`);
      setIsOtpSent(true);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(z.object({ otp: otpSchema }), { otp })) return;
    
    setLoading(true);

    try {
      // 2. Verify Email OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'signup',
      });

      if (verifyError) throw verifyError;

      toast.success('Account verified and created successfully!');
      // Navigation is handled by the useEffect auth listener
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Invalid OTP or Verification Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(signInSchema, { email, password })) return;
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      toast.success('Signed in successfully!');
    } catch (error: any) {
      toast.error(error.message || "Invalid login credentials");
    } finally {
      setLoading(false);
    }
  };

  const onTabChange = (v: string) => {
    setActiveTab(v); 
    setErrors({});
    setIsOtpSent(false);
    setOtp('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <header className="p-6">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 hover:bg-primary/10">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            <span className="font-heading text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">AuditHub</span>
          </div>

          <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm transition-all duration-300">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold text-center">Welcome</CardTitle>
              <CardDescription className="text-center">Sign in to manage your audits</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-0">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="signin-email" 
                          type="email" 
                          placeholder="your@email.com" 
                          className={`pl-9 ${errors.email ? 'border-destructive' : ''}`}
                          value={email} 
                          onChange={(e) => setEmail(e.target.value)} 
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="signin-password" 
                          type="password" 
                          placeholder="••••••••" 
                          className="pl-9" 
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)} 
                          required 
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={isOtpSent ? handleSignUpStep2 : handleSignUpStep1} className="space-y-4">
                    
                    {/* Step 1: Details */}
                    <div className={isOtpSent ? 'hidden' : 'space-y-4'}>
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Full Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="signup-name" 
                            value={fullName} 
                            onChange={(e) => setFullName(e.target.value)} 
                            className={`pl-9 ${errors.fullName ? 'border-destructive' : ''}`} 
                            placeholder="John Doe" 
                          />
                        </div>
                        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="signup-phone">Mobile Number</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="signup-phone" 
                            type="tel" 
                            value={phone} 
                            onChange={(e) => setPhone(e.target.value)} 
                            className={`pl-9 ${errors.phone ? 'border-destructive' : ''}`} 
                            placeholder="9876543210" 
                          />
                        </div>
                        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="signup-email" 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            className={`pl-9 ${errors.email ? 'border-destructive' : ''}`} 
                            placeholder="john@example.com" 
                          />
                        </div>
                        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="signup-password" 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            className={`pl-9 ${errors.password ? 'border-destructive' : ''}`} 
                            placeholder="Create a password" 
                          />
                        </div>
                        {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                      </div>
                    </div>

                    {/* Step 2: OTP */}
                    {isOtpSent && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <div className="text-center space-y-1 mb-4">
                          <p className="text-sm font-medium">Enter 6-digit code sent to {email}</p>
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setIsOtpSent(false)} type="button">Change Email</Button>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="otp">One-Time Password</Label>
                          <div className="relative">
                            <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                              id="otp" 
                              value={otp} 
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                              className={`pl-9 text-center tracking-widest text-lg ${errors.otp ? 'border-destructive' : ''}`} 
                              placeholder="000000" 
                              maxLength={6}
                            />
                          </div>
                          {errors.otp && <p className="text-xs text-destructive">{errors.otp}</p>}
                        </div>
                      </div>
                    )}

                    <Button type="submit" className="w-full" size="lg" disabled={loading}>
                      {loading 
                        ? (isOtpSent ? 'Verifying...' : 'Sending OTP...') 
                        : (isOtpSent ? 'Verify & Create Account' : 'Send OTP & Sign Up')
                      }
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