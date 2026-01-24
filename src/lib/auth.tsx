import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  userRole: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const withTimeout = async <T,>(p: Promise<T>, ms = 3000): Promise<T> => {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms)),
  ]);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchRole = async (userId: string, retries = 2) => {
    try {
      console.log("Fetching role for user:", userId);

      // Try profiles table first with shorter timeout
      const { data: profileData, error: profileError } = await withTimeout(
        supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle(),
        3000
      );

      if (profileError && profileError.code !== 'PGRST116') {
        console.log("Profile error:", profileError.message);
      }

      if (profileData?.role) {
        console.log("Role from profiles:", profileData.role);
        setUserRole(profileData.role);
        return;
      }

      // Fallback to user_roles table
      const { data: roleData, error: roleError } = await withTimeout(
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle(),
        3000
      );

      if (roleError && roleError.code !== 'PGRST116') {
        console.log("User_roles error:", roleError.message);
      }

      const role = roleData?.role ?? 'auditor';
      console.log("Final role:", role);
      setUserRole(role);

    } catch (e: any) {
      console.error("Role fetch failed:", e.message);
      
      // Retry logic for timeouts
      if (retries > 0 && e.message === "Timeout") {
        console.log(`Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return fetchRole(userId, retries - 1);
      }
      
      // Default to auditor role on persistent failure
      console.log("Setting default 'auditor' role");
      setUserRole('auditor');
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        const s = data.session ?? null;
        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user?.id) {
          fetchRole(s.user.id);
        } else {
          setUserRole(null);
        }
      } catch (e) {
        console.error("Auth bootstrap failed:", e);
        if (mounted) setUserRole('auditor');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user?.id) {
        fetchRole(currentSession.user.id);
      } else {
        setUserRole(null);
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
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};