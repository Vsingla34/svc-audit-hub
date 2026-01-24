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

  // If we are logged in and have a role, show the dashboard
  if (user && userRole === 'admin') return <AdminDashboard />;
  if (user && userRole === 'auditor') return <AuditorDashboard />;
  if (user && userRole === 'client') return <div className="p-8 text-center">Client Dashboard (Coming Soon)</div>;

  // Otherwise return null (no loading screen, no error screen)
  return null;
}