import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function Dashboard() {
  const { user, loading, userRole, signOut } = useAuth();

  if (loading) return null;

  // 1. If we are logged in and have a specific role, redirect to their specific overview
  if (user && userRole === 'admin') {
    return <Navigate to="/admin/overview" replace />;
  }
  
  if (user && userRole === 'auditor') {
    return <Navigate to="/auditor/overview" replace />;
  }
  
  if (user && userRole === 'client') {
    return <div className="p-8 text-center">Client Dashboard (Coming Soon)</div>;
  }

  // 2. Prevent infinite loops! If the user is logged in but their role is 'none' or missing
  if (user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-4 border-t-4 border-amber-500">
          <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Account Under Review</h2>
          <p className="text-muted-foreground">
            Your account has been created successfully, but an administrator has not assigned you a role yet. 
          </p>
          <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md border">
            Please wait for admin approval. Once your role is assigned to 'Auditor', you will automatically be redirected to your dashboard upon login.
          </p>
          <div className="pt-4 flex justify-center">
            <Button onClick={() => signOut()} variant="outline" className="w-full gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Fallback if not logged in at all
  return <Navigate to="/auth" replace />;
}