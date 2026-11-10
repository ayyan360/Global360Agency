import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, homePathFor } from '../context/AuthContext.jsx';
import { PageLoader } from '../components/common/ui.jsx';

/**
 * Client-side route guards for navigation only. Every protected API endpoint independently
 * enforces authentication, roles and resource ownership on the server.
 */
export function RequireAuth({ roles, permissions }) {
  const { user, status, can } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/access-denied" replace />;
  if (permissions && !permissions.some((p) => can(p))) return <Navigate to="/access-denied" replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (user) {
    const next = new URLSearchParams(location.search).get('next');
    return <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : homePathFor(user)} replace />;
  }
  return <Outlet />;
}
