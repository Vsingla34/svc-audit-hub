import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: string | null;
  isProfileComplete: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true, userRole: null, isProfileComplete: false, signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const navigate = useNavigate();

  const isFetchingContext = useRef(false);
  const isInitialized = useRef(false);

  const fetchUserContext = async (userId: string, userEmail?: string) => {
    if (isFetchingContext.current) return;
    isFetchingContext.current = true;

    if (userEmail === 'info.stockcheck360@gmail.com') {
      setUserRole('admin');
      setIsProfileComplete(true);
      isFetchingContext.current = false;
      return;
    }

    try {
      const fetchPromise = Promise.all([
        supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("auditor_profiles").select("id").eq("user_id", userId).maybeSingle(),
      ]);

      const [profileRoleRes, userRoleRes, auditorProfileRes] = await Promise.race([
        fetchPromise,
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Context timeout")), 5000))
      ]);

      let finalRole = 'auditor';
      const pRole = profileRoleRes?.data?.role?.toLowerCase().trim();
      const uRole = userRoleRes?.data?.role?.toLowerCase().trim();

      if (uRole === 'admin' || uRole === 'super_admin') finalRole = uRole;
      else if (pRole === 'admin' || pRole === 'super_admin') finalRole = pRole;
      else if (pRole) finalRole = pRole;
      else if (uRole) finalRole = uRole;

      setUserRole(finalRole);
      setIsProfileComplete(!!auditorProfileRes?.data);
    } catch (e: any) {
      console.error("Context fetch failed:", e.message);
      setUserRole('auditor');
    } finally {
      isFetchingContext.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
        ]);

        if (!mounted) return;
        if (sessionResult?.error) return; 
        
        if (!sessionResult?.data?.session) {
          setUser(null); setSession(null); setUserRole(null); setIsProfileComplete(false);
          navigate('/auth', { replace: true });
        } else {
          setSession(sessionResult.data.session);
          setUser(sessionResult.data.session.user);
        }
      } catch (e) {}
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (event === 'INITIAL_SESSION') {
        if (currentSession) {
          const isExpired = (currentSession.expires_at ?? 0) * 1000 < Date.now();
          if (isExpired) {
            Object.keys(localStorage).forEach((k) => { if (k.startsWith('sb-')) localStorage.removeItem(k); });
            setSession(null); setUser(null);
          } else {
            setSession(currentSession); setUser(currentSession.user);
            await fetchUserContext(currentSession.user.id, currentSession.user.email);
          }
        } else {
          setSession(null); setUser(null);
        }
        isInitialized.current = true;
        if (mounted) setLoading(false);
        return;
      }

      if (!isInitialized.current) return;

      if (event === 'SIGNED_IN') {
        // MOBILE FIX: If user already exists, this is just a background reconnect. DO NOT show a loading spinner!
        // Showing a spinner unmounts the form and deletes all unsaved typed data.
        const isBackgroundReconnect = !!user;
        if (!isBackgroundReconnect) setLoading(true);
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          await fetchUserContext(currentSession.user.id, currentSession.user.email);
        }
        
        if (mounted && !isBackgroundReconnect) setLoading(false);

      } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user && event === 'USER_UPDATED') {
          isFetchingContext.current = false;
          await fetchUserContext(currentSession.user.id, currentSession.user.email);
        }

      } else if (event === 'SIGNED_OUT') {
        setSession(null); setUser(null); setUserRole(null); setIsProfileComplete(false);
        setLoading(false);
        if (mounted) navigate("/auth", { replace: true });
      }
    });

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const signOut = async () => {
    try {
      setUser(null); setSession(null); setUserRole(null); setIsProfileComplete(false);
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("signOut timed out")), 3000)),
      ]);
    } catch (error) {
    } finally {
      Object.keys(localStorage).forEach((key) => { if (key.startsWith('sb-')) localStorage.removeItem(key); });
      navigate("/auth", { replace: true });
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, isProfileComplete, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};