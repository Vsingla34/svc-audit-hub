import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Index from "./pages/Index"; // You can remove this if you no longer use the Index page anywhere
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AuditorProfileSetup from "./pages/AuditorProfileSetup";
import PaymentsDashboard from "./pages/PaymentsDashboard";
import MapView from "./pages/MapView";
import AssignmentDetail from "./pages/AssignmentDetail";
import ProfileEdit from "./pages/ProfileEdit";
import BankKycDetails from "./pages/BankKycDetails";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// This component handles the redirection logic
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, userRole, isProfileComplete } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // 1. If not logged in, go to Auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 2. If Auditor AND Profile Incomplete AND trying to access restricted pages
  // Allowed pages for incomplete profiles: /profile-setup
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
              {/* Public Route - CHANGED: Redirect root to /auth */}
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />

              {/* Protected Routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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