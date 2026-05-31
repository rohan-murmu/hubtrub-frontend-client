import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { UserProvider } from '@/context/UserContext';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  /** When true, allow access even if the user hasn't completed profile yet. */
  allowIncompleteProfile?: boolean;
}

// ProtectedRoute is a pure reader of the AuthContext state. Auth fetching
// happens once in AuthProvider — mounting a new ProtectedRoute does NOT
// trigger another /auth/me. That's deliberate: an earlier version re-fetched
// on every route mount and could catch a transient backend hiccup right after
// PATCH /user/me, which is what bounced "select-avatar → /hub" back to
// /profile-details.
export default function ProtectedRoute({ children, allowIncompleteProfile }: ProtectedRouteProps) {
  const { state } = useAuth();

  if (state.status === 'pending') return null;
  if (state.status === 'anonymous') return <Navigate to="/auth" replace />;
  if (state.status === 'needs-profile') {
    if (allowIncompleteProfile) return <>{children}</>;
    return <Navigate to="/auth/profile-details" replace />;
  }
  return <UserProvider user={state.user}>{children}</UserProvider>;
}
