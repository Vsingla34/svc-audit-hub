import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export default function Dashboard() {
  const { userRole, loading } = useAuth();

  // Show absolutely nothing while auth is resolving
  if (loading) return null;
  
  // Safely check role
  const role = (userRole || 'auditor').toLowerCase();
  
  // Instantly redirect without rendering an intermediate blank screen
  if (role === 'admin' || role === 'super_admin') {
    return <Navigate to="/admin/overview" replace />;
  } else {
    return <Navigate to="/auditor/overview" replace />;
  }
}