import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";

// 1. Eagerly loaded components (essential for first paint)
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

// 2. Lazy loaded Admin Pages (Code Splitting - only loads when visited)
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

// --- OPTIMIZATION: Global React Query Caching Rules ---
// This prevents 1000 users from spamming the DB simultaneously
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Data stays fresh for 5 minutes
      gcTime: 1000 * 60 * 30, // Keep unused data in memory for 30 minutes
      refetchOnWindowFocus: false, // Don't refetch every time the user clicks back to the tab
      retry: 1, // Only retry failed requests once to prevent infinite loops
    },
  },
});

const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode, requiredRole?: 'admin' | 'auditor' | 'client' }) => {
  const { user, loading, userRole, isProfileComplete } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading Auth...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  if (userRole === 'auditor' && !isProfileComplete && location.pathname !== '/profile-setup') {
    return <Navigate to="/profile-setup" replace />;
  }

  return <>{children}</>;
};

// UI for when a lazy-loaded chunk is being fetched
const SuspenseLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-[#4338CA] border-t-transparent rounded-full animate-spin"></div>
    <p className="mt-4 text-muted-foreground font-medium animate-pulse">Loading module...</p>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<SuspenseLoader />}>
              <Routes>
                {/* Public Route */}
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<Auth />} />

                {/* Main routing hub */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

                {/* --- ADMIN ROUTES --- */}
                <Route path="/admin/overview" element={<ProtectedRoute requiredRole="admin"><AdminOverviewPage /></ProtectedRoute>} />
                <Route path="/admin/assignments" element={<ProtectedRoute requiredRole="admin"><AdminAssignmentsPage /></ProtectedRoute>} />
                <Route path="/admin/applications" element={<ProtectedRoute requiredRole="admin"><AdminApplicationsPage /></ProtectedRoute>} />
                <Route path="/admin/deadlines" element={<ProtectedRoute requiredRole="admin"><AdminDeadlinesPage /></ProtectedRoute>} />
                <Route path="/admin/reports" element={<ProtectedRoute requiredRole="admin"><AdminReportsPage /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsersPage /></ProtectedRoute>} />

                {/* --- AUDITOR ROUTES --- */}
                <Route path="/auditor/overview" element={<ProtectedRoute requiredRole="auditor"><AuditorOverviewPage /></ProtectedRoute>} />
                <Route path="/auditor/available-jobs" element={<ProtectedRoute requiredRole="auditor"><AuditorAvailableJobsPage /></ProtectedRoute>} />
                <Route path="/auditor/assignments" element={<ProtectedRoute requiredRole="auditor"><AuditorMyAssignmentsPage /></ProtectedRoute>} />
                <Route path="/auditor/applications" element={<ProtectedRoute requiredRole="auditor"><AuditorMyApplicationsPage /></ProtectedRoute>} />
                <Route path="/auditor/analytics" element={<ProtectedRoute requiredRole="auditor"><AuditorAnalyticsPage /></ProtectedRoute>} />

                {/* --- SHARED ROUTES --- */}
                <Route path="/profile-setup" element={<ProtectedRoute><AuditorProfileSetup /></ProtectedRoute>} />
                <Route path="/profile-edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
                <Route path="/bank-kyc" element={<ProtectedRoute><BankKycDetails /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><PaymentsDashboard /></ProtectedRoute>} />
                <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
                <Route path="/assignment/:id" element={<ProtectedRoute><AssignmentDetail /></ProtectedRoute>} />
                
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