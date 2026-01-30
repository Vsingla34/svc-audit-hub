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

// Helper: Forces a promise to reject if it takes too long
const withTimeout = async <T,>(p: Promise<T>, ms = 4000): Promise<T> => {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms)),
  ]);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const navigate = useNavigate();

  const fetchUserContext = async (userId: string) => {
    try {
      console.log("Fetching context for user:", userId);

      // Wrap the entire batch fetch in a timeout
      // This ensures the app NEVER gets stuck on "Loading..."
      const [profileRoleData, userRoleData, auditorProfileData] = await withTimeout(
        Promise.all([
          supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
          supabase.from("auditor_profiles").select("id").eq("user_id", userId).maybeSingle()
        ]), 
        5000 // 5 Second Hard Timeout
      );

      // 1. Determine Role
      let role = 'auditor'; // Default fallback
      if (profileRoleData.data?.role) {
        role = profileRoleData.data.role;
      } else if (userRoleData.data?.role) {
        role = userRoleData.data.role;
      }
      setUserRole(role);

      // 2. Determine Profile Completion (Success)
      setIsProfileComplete(!!auditorProfileData.data);

    } catch (e: any) {
      console.error("Context fetch failed or timed out:", e.message);
      
      // FALLBACKS ON ERROR/TIMEOUT:
      // We allow the user in as an 'auditor' with incomplete profile
      // so they can at least see the setup page or dashboard.
      if (!userRole) setUserRole('auditor');
      // We keep isProfileComplete false to be safe, so they are directed to check profile
      setIsProfileComplete(false); 
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        // 1. Get Session
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        const s = data.session ?? null;
        setSession(s);
        setUser(s?.user ?? null);

        // 2. If User exists, fetch details
        if (s?.user?.id) {
          await fetchUserContext(s.user.id);
        } else {
          setUserRole(null);
          setIsProfileComplete(false);
        }
      } catch (e) {
        console.error("Auth bootstrap failed:", e);
      } finally {
        // 3. ALWAYS set loading to false, no matter what happens
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    // Listen for auth changes (login/logout/refresh)
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user?.id) {
        // Fetch context in background without blocking UI (loading is already false)
        fetchUserContext(currentSession.user.id);
      } else {
        setUserRole(null);
        setIsProfileComplete(false);
      }

      if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const signOut = async () => {
    try {
        setLoading(true); // Optional: show loading during sign out
        await supabase.auth.signOut();
        navigate("/auth");
    } finally {
        setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, isProfileComplete, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};