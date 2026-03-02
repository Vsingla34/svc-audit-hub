import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";

// Public Pages
import Auth from "./pages/Auth";

// Generic Protected Pages
import Dashboard from "./pages/Dashboard";
import AuditorProfileSetup from "./pages/AuditorProfileSetup";
import PaymentsDashboard from "./pages/PaymentsDashboard";
import MapView from "./pages/MapView";
import AssignmentDetail from "./pages/AssignmentDetail";
import ProfileEdit from "./pages/ProfileEdit";
import BankKycDetails from "./pages/BankKycDetails";
import NotFound from "./pages/NotFound";

// Admin Separated Pages
import AdminOverviewPage from "./pages/admin/AdminOverviewPage";
import AdminAssignmentsPage from "./pages/admin/AdminAssignmentsPage";
import AdminApplicationsPage from "./pages/admin/AdminApplicationsPage";
import AdminDeadlinesPage from "./pages/admin/AdminDeadlinesPage";
import AdminReportsPage from "./pages/admin/AdminReportsPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";

// Auditor Separated Pages
import AuditorOverviewPage from "./pages/auditor/AuditorOverviewPage";
import AuditorAvailableJobsPage from "./pages/auditor/AuditorAvailableJobsPage";
import AuditorMyApplicationsPage from "./pages/auditor/AuditorMyApplicationsPage";
import AuditorMyAssignmentsPage from "./pages/auditor/AuditorMyAssignmentsPage";
import AuditorLiveReportPage from "./pages/auditor/AuditorLiveReportPage";
import AuditorAnalyticsPage from "./pages/auditor/AuditorAnalyticsPage";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode, requiredRole?: 'admin' | 'auditor' | 'client' }) => {
  const { user, loading, userRole, isProfileComplete } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // 1. If not logged in, go to Auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 2. Role Check (if a specific role is required for this route)
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  // 3. If Auditor AND Profile Incomplete AND trying to access restricted pages
  if (
    userRole === 'auditor' && 
    !isProfileComplete && 
    location.pathname !== '/profile-setup'
  ) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
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
              <Route path="/auditor/live-report" element={<ProtectedRoute requiredRole="auditor"><AuditorLiveReportPage /></ProtectedRoute>} />
            

              {/* --- SHARED ROUTES --- */}
              <Route path="/profile-setup" element={<ProtectedRoute><AuditorProfileSetup /></ProtectedRoute>} />
              <Route path="/profile-edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
              <Route path="/bank-kyc" element={<ProtectedRoute><BankKycDetails /></ProtectedRoute>} />
              <Route path="/payments" element={<ProtectedRoute><PaymentsDashboard /></ProtectedRoute>} />
              <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
              <Route path="/assignment/:id" element={<ProtectedRoute><AssignmentDetail /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;