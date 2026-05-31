import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authService } from '@/services/api';
import type { User } from '@/types';

// AuthContext is the single source of truth for the signed-in user. It hits
// /auth/me ONCE at app mount, then anything that mutates the user (sign-in,
// complete profile, avatar selection, profile edit) pushes the fresh User
// into here via setUser. ProtectedRoute reads from here instead of refetching
// per-mount — that was the source of the "select-avatar bounces to
// profile-details" race: each route remount re-called /auth/me and could
// catch a transient backend hiccup.
export type AuthState =
  | { status: 'pending' }
  | { status: 'anonymous' }
  | { status: 'needs-profile'; firebaseUid?: string; email?: string }
  | { status: 'authenticated'; user: User };

interface AuthContextValue {
  state: AuthState;
  /** Replace the current user (e.g. after PATCH /user/me returns the new row).
   *  Flips status to 'authenticated' regardless of prior status. */
  setUser: (user: User) => void;
  /** Mark as anonymous, e.g. after logout. */
  clear: () => void;
  /** Force a re-fetch of /auth/me. Use sparingly — most callers should just
   *  push the User they already have via setUser. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'pending' });

  const refresh = useCallback(async () => {
    const result = await authService.me();
    if (result === null) {
      setState({ status: 'anonymous' });
      return;
    }
    if ('needsProfile' in result && result.needsProfile === true) {
      setState({
        status: 'needs-profile',
        firebaseUid: result.firebaseUid,
        email: result.email,
      });
      return;
    }
    setState({ status: 'authenticated', user: result as User });
  }, []);

  // Initial hydration. Errors just leave us in 'pending' → effectively
  // anonymous on first render; the user will land on /auth.
  useEffect(() => {
    let cancelled = false;
    authService
      .me()
      .then((result) => {
        if (cancelled) return;
        if (result === null) {
          setState({ status: 'anonymous' });
          return;
        }
        if ('needsProfile' in result && result.needsProfile === true) {
          setState({
            status: 'needs-profile',
            firebaseUid: result.firebaseUid,
            email: result.email,
          });
          return;
        }
        setState({ status: 'authenticated', user: result as User });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'anonymous' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setUser = useCallback((user: User) => {
    setState({ status: 'authenticated', user });
  }, []);

  const clear = useCallback(() => {
    setState({ status: 'anonymous' });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, setUser, clear, refresh }),
    [state, setUser, clear, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
