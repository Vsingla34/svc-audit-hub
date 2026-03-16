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
import { Phone, Mail, User, Lock, KeyRound, Loader2 } from 'lucide-react';

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
  const { user, loading: authLoading } = useAuth(); 

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

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

      if (data.session) {
        toast.success("Account created! Logging you in...");
        navigate('/dashboard'); 
        return;
      }

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
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'signup',
      });

      if (verifyError) throw verifyError;

      toast.success('Account verified and created successfully!');
      
      // Explicitly navigate as soon as the token is verified
      if (data?.session) {
        navigate('/dashboard');
      }
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
    <div className="min-h-screen flex flex-col bg-white relative overflow-hidden">
      {/* --- New Indigo Background Decor --- */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-[#4338CA]/10 blur-3xl" />
          <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] rounded-full bg-[#4338CA]/10 blur-3xl" />
      </div>

      <main className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-md">
          
          {/* --- BRANDING HEADER --- */}
          <div className="flex flex-col items-center justify-center gap-3 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* The actual logo displayed large and clean */}
            <img src="/logo.png" alt="StockCheck360 Logo" className="h-16 md:h-20 w-auto object-contain drop-shadow-sm" />
            
            <div className="flex items-center gap-3 mt-1">
              <div className="h-[2px] w-8 bg-[#4338CA]/30 rounded-full"></div>
              <span className="text-xs font-bold text-[#4338CA] uppercase tracking-[0.3em]">Audit Flow</span>
              <div className="h-[2px] w-8 bg-[#4338CA]/30 rounded-full"></div>
            </div>
          </div>

          <Card className="border-t-4 border-t-[#4338CA] shadow-xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold text-center text-gray-900">Welcome</CardTitle>
              <CardDescription className="text-center">Sign in to manage your account</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                  <TabsTrigger 
                    value="signin"
                    className="data-[state=active]:bg-white data-[state=active]:text-[#4338CA] data-[state=active]:shadow-sm"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger 
                    value="signup"
                    className="data-[state=active]:bg-white data-[state=active]:text-[#4338CA] data-[state=active]:shadow-sm"
                  >
                    Sign Up
                  </TabsTrigger>
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
                          className={`pl-9 focus-visible:ring-[#4338CA] ${errors.email ? 'border-destructive' : ''}`}
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
                          className="pl-9 focus-visible:ring-[#4338CA]" 
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)} 
                          required 
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-[#4338CA] hover:bg-[#4338CA]/90" size="lg" disabled={loading || authLoading}>
                      {(loading || authLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Sign In'}
                    </Button>
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
                            className={`pl-9 focus-visible:ring-[#4338CA] ${errors.fullName ? 'border-destructive' : ''}`} 
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
                            className={`pl-9 focus-visible:ring-[#4338CA] ${errors.phone ? 'border-destructive' : ''}`} 
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
                            className={`pl-9 focus-visible:ring-[#4338CA] ${errors.email ? 'border-destructive' : ''}`} 
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
                            className={`pl-9 focus-visible:ring-[#4338CA] ${errors.password ? 'border-destructive' : ''}`} 
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
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs text-[#4338CA]" onClick={() => setIsOtpSent(false)} type="button">Change Email</Button>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="otp">One-Time Password</Label>
                          <div className="relative">
                            <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                              id="otp" 
                              value={otp} 
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                              className={`pl-9 text-center tracking-widest text-lg focus-visible:ring-[#4338CA] ${errors.otp ? 'border-destructive' : ''}`} 
                              placeholder="000000" 
                              maxLength={6}
                            />
                          </div>
                          {errors.otp && <p className="text-xs text-destructive">{errors.otp}</p>}
                        </div>
                      </div>
                    )}

                    <Button type="submit" className="w-full bg-[#4338CA] hover:bg-[#4338CA]/90" size="lg" disabled={loading || authLoading}>
                      {(loading || authLoading) 
                        ? (isOtpSent ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Verifying...</> : <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Sending...</>) 
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