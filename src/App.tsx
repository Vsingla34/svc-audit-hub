import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { DashboardLayout } from "@/components/DashboardLayout";

// 1. Eagerly loaded components
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

// 2. Lazy loaded Admin Pages
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverviewPage"));
const AdminAssignmentsPage = lazy(() => import("./pages/admin/AdminAssignmentsPage"));
const AdminApplicationsPage = lazy(() => import("./pages/admin/AdminApplicationsPage"));
const AdminDeadlinesPage = lazy(() => import("./pages/admin/AdminDeadlinesPage"));
const AdminReportsPage = lazy(() => import("./pages/admin/AdminReportsPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));

// 3. Lazy loaded Auditor Pages
const AuditorOverviewPage = lazy(() => import("./pages/auditor/AuditorOverviewPage"));
const AuditorAvailableJobsPage = lazy(() => import("./pages/auditor/AuditorAvailableJobsPage"));
const AuditorMyApplicationsPage = lazy(() => import("./pages/auditor/AuditorMyApplicationsPage"));
const AuditorMyAssignmentsPage = lazy(() => import("./pages/auditor/AuditorMyAssignmentsPage"));
const AuditorAnalyticsPage = lazy(() => import("./pages/auditor/AuditorAnalyticsPage"));

// 4. Lazy loaded Shared Pages
const AuditorProfileSetup = lazy(() => import("./pages/AuditorProfileSetup"));
const ProfileEdit = lazy(() => import("./pages/ProfileEdit"));
const BankKycDetails = lazy(() => import("./pages/BankKycDetails"));
const PaymentsDashboard = lazy(() => import("./pages/PaymentsDashboard"));
const MapView = lazy(() => import("./pages/MapView"));
const AssignmentDetail = lazy(() => import("./pages/AssignmentDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// A real loading screen — shown while auth initializes on first paint.
// Kept minimal and instant so it never feels like a hang.
const GlobalLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 rounded-full border-4 border-[#4338CA] border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);


const ProtectedRoute = ({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: "admin" | "auditor" | "client";
}) => {
  const { user, loading, userRole, isProfileComplete } = useAuth();
  const location = useLocation();

  // Still initializing — render nothing, the shell's loader is already showing
  if (loading) return null;

  // Not logged in — send to auth, remembering where they wanted to go
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;

  const currentRole = (userRole || "auditor").toLowerCase();

  if (requiredRole) {
    const reqRole = requiredRole.toLowerCase();
    const isAdminPath = reqRole === "admin";
    const isUserAdmin = currentRole === "admin" || currentRole === "super_admin";

    if (isAdminPath && !isUserAdmin) return <Navigate to="/dashboard" replace />;
    if (!isAdminPath && !isUserAdmin && currentRole !== reqRole)
      return <Navigate to="/dashboard" replace />;
  }

  // Auditor with incomplete profile — force setup first
  if (
    currentRole === "auditor" &&
    !isProfileComplete &&
    location.pathname !== "/profile-setup"
  ) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <>{children}</>;
};


const ProtectedShell = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

 
  if (loading) return <GlobalLoader />;

  // Auth resolved but no user — redirect to login
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;

  // Auth resolved and user exists — render the full dashboard shell
  return (
    <DashboardLayout title="" navItems={[]} activeTab="">
      <Outlet />
    </DashboardLayout>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<GlobalLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<Auth />} />

                
                <Route element={<ProtectedShell />}>
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="/admin/overview" element={<ProtectedRoute requiredRole="admin"><AdminOverviewPage /></ProtectedRoute>} />
                  <Route path="/admin/assignments" element={<ProtectedRoute requiredRole="admin"><AdminAssignmentsPage /></ProtectedRoute>} />
                  <Route path="/admin/applications" element={<ProtectedRoute requiredRole="admin"><AdminApplicationsPage /></ProtectedRoute>} />
                  <Route path="/admin/deadlines" element={<ProtectedRoute requiredRole="admin"><AdminDeadlinesPage /></ProtectedRoute>} />
                  <Route path="/admin/reports" element={<ProtectedRoute requiredRole="admin"><AdminReportsPage /></ProtectedRoute>} />
                  <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsersPage /></ProtectedRoute>} />

                  <Route path="/auditor/overview" element={<ProtectedRoute requiredRole="auditor"><AuditorOverviewPage /></ProtectedRoute>} />
                  <Route path="/auditor/available-jobs" element={<ProtectedRoute requiredRole="auditor"><AuditorAvailableJobsPage /></ProtectedRoute>} />
                  <Route path="/auditor/assignments" element={<ProtectedRoute requiredRole="auditor"><AuditorMyAssignmentsPage /></ProtectedRoute>} />
                  <Route path="/auditor/applications" element={<ProtectedRoute requiredRole="auditor"><AuditorMyApplicationsPage /></ProtectedRoute>} />
                  <Route path="/auditor/analytics" element={<ProtectedRoute requiredRole="auditor"><AuditorAnalyticsPage /></ProtectedRoute>} />

                  <Route path="/profile-setup" element={<ProtectedRoute><AuditorProfileSetup /></ProtectedRoute>} />
                  <Route path="/profile-edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
                  <Route path="/bank-kyc" element={<ProtectedRoute><BankKycDetails /></ProtectedRoute>} />
                  <Route path="/payments" element={<ProtectedRoute><PaymentsDashboard /></ProtectedRoute>} />
                  <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
                  <Route path="/assignment/:id" element={<ProtectedRoute><AssignmentDetail /></ProtectedRoute>} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;