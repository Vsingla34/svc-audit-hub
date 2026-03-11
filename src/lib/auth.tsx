import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
  user: null,
  session: null,
  loading: true,
  userRole: null,
  isProfileComplete: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const navigate = useNavigate();

  const fetchUserContext = async (userId: string, userEmail?: string) => {
    
    // --- THE SUPER ADMIN BYPASS ---
    // This guarantees the owner account NEVER gets locked out of the admin panel,
    // even if Supabase Row Level Security (RLS) accidentally blocks database reads.
    if (userEmail === 'info.stockcheck360@gmail.com') {
      setUserRole('admin');
      setIsProfileComplete(true);
      return; 
    }

    try {
      const [profileRoleRes, userRoleRes, auditorProfileRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("auditor_profiles").select("id").eq("user_id", userId).maybeSingle()
      ]);

      let finalRole = 'auditor'; // Default fallback
      const pRole = profileRoleRes.data?.role?.toLowerCase().trim();
      const uRole = userRoleRes.data?.role?.toLowerCase().trim();

      if (uRole === 'admin' || uRole === 'super_admin') finalRole = uRole;
      else if (pRole === 'admin' || pRole === 'super_admin') finalRole = pRole;
      else if (pRole) finalRole = pRole;
      else if (uRole) finalRole = uRole;

      setUserRole(finalRole);
      setIsProfileComplete(!!auditorProfileRes.data);
    } catch (e: any) {
      console.error("Context fetch failed:", e.message);
      if (!userRole) setUserRole('auditor');
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Pass both ID and Email to the context fetcher
          await fetchUserContext(session.user.id, session.user.email);
        }
      } catch (e) {
        console.error("Auth init error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Load session safely on mount
    initializeAuth();

    // Listen for auth changes cleanly
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;
      if (event === 'INITIAL_SESSION') return; 

      // FIX 1: Listen for TOKEN_REFRESHED so the sidebar items don't drop out
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setLoading(true);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          await fetchUserContext(currentSession.user.id, currentSession.user.email);
        }
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setUserRole(null);
        setIsProfileComplete(false);
        setLoading(false);
        navigate("/auth", { replace: true });
      } else {
        // Fallback
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  // FIX 2: Bulletproof SignOut function
  const signOut = async () => {
    try {
        setLoading(true); 
        
        // Step 1: Instantly wipe React state so the UI reacts without waiting
        setUser(null);
        setSession(null);
        setUserRole(null);
        setIsProfileComplete(false);

        // Step 2: Manually kill localStorage keys so session is dead even if offline
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });

        // Step 3: Tell server to sign out, but force a 3-second timeout so it NEVER hangs
        await Promise.race([
            supabase.auth.signOut(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
    } catch (error) {
        console.warn("Server logout bypassed due to timeout or network block.");
    } finally {
        setLoading(false);
        navigate("/auth", { replace: true });
        // Optional: Force a hard reload to completely scrub browser memory
        window.location.reload();
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, isProfileComplete, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};