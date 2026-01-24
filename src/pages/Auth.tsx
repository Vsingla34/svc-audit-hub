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
import { Shield, ArrowLeft, Phone, Mail, User, Lock } from 'lucide-react';

// --- Validation Schemas ---
const emailSchema = z.string().trim().email('Please enter a valid email address').max(255);
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
const fullNameSchema = z.string().trim().min(2, 'Name must be at least 2 characters');
const phoneSchema = z.string().trim().min(10, 'Invalid phone number').max(15);

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(signUpSchema, { email, password, fullName, phone })) return;
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
        },
      });

      if (error) throw error;

      if (data.user) {
        // SUCCESS: The SQL Trigger will handle profile creation automatically.
        // We sign out to force a clean login flow.
        await supabase.auth.signOut();
        
        toast.success('Account created! Please sign in.');
        
        // Reset and switch tab
        setEmail('');
        setPassword('');
        setFullName('');
        setPhone('');
        setActiveTab("signin");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to sign up");
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
      // Navigation is handled by the useEffect above
    } catch (error: any) {
      toast.error(error.message || "Invalid login credentials");
    } finally {
      setLoading(false);
    }
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

          <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold text-center">Welcome</CardTitle>
              <CardDescription className="text-center">Sign in to manage your audits</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setErrors({}); }} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-0">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input id="signin-email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input id="signin-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input id="signup-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={errors.fullName ? 'border-destructive' : ''} required />
                      {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">Mobile Number</Label>
                      <Input id="signup-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} className={errors.phone ? 'border-destructive' : ''} required />
                      {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={errors.email ? 'border-destructive' : ''} required />
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={errors.password ? 'border-destructive' : ''} required />
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</Button>
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