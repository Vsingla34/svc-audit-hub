import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import AdminDashboard from './AdminDashboard';
import AuditorDashboard from './AuditorDashboard';

export default function Dashboard() {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Route to appropriate dashboard based on role
  if (userRole === 'admin') {
    return <AdminDashboard />;
  } else if (userRole === 'auditor') {
    return <AuditorDashboard />;
  } else {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Role Not Assigned</h2>
          <p className="text-muted-foreground">Please contact an administrator.</p>
        </div>
      </div>
    );
  }
}
