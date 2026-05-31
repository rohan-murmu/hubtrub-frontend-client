import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signInAsGuest,
  sendPasswordReset,
} from '@/lib/firebase';
import AppShell from '@/components/ui/AppShell';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import Alert from '@/components/ui/Alert';
import { errorMessage } from '@/utils/errorMessage';
import type { AuthType, NeedsProfileResponse, User } from '@/types';
import './auth.css';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const navigate = useNavigate();
  const { setUser, refresh } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);
    if (!email) {
      setError('Enter your email above, then click "Forgot password?".');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setNotice(`Password reset email sent to ${email}. Check your inbox.`);
    } catch (e) {
      setError(errorMessage(e, 'Could not send reset email'));
    } finally {
      setBusy(false);
    }
  };

  const handleSessionResult = async (
    result: User | NeedsProfileResponse,
    authType: AuthType,
    firebaseEmail: string | null,
  ) => {
    if ('needsProfile' in result && result.needsProfile) {
      const email = result.email || firebaseEmail || '';
      await refresh();
      navigate('/auth/profile-details', { state: { authType, email } });
    } else {
      setUser(result as User);
      navigate('/hub');
    }
  };

  const handleEmailSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      const cred =
        mode === 'signin'
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(email, password);
      const idToken = await cred.user.getIdToken();
      const result = await authService.startSession(idToken);
      handleSessionResult(result, 'EMAIL', cred.user.email ?? email);
    } catch (e) {
      setError(errorMessage(e, 'Authentication failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      const cred = await signInWithGoogle();
      const idToken = await cred.user.getIdToken();
      const result = await authService.startSession(idToken);
      handleSessionResult(result, 'GOOGLE', cred.user.email ?? null);
    } catch (e) {
      setError(errorMessage(e, 'Authentication failed'));
    } finally {
      setBusy(false);
    }
  };

  // Anonymous sign-in. The backend recognizes the anonymous provider claim
  // and short-circuits the needsProfile flow, returning a fully-provisioned
  // GUEST user row. We don't expose the Name / username / avatar steps for
  // guests — there's nothing to fill in.
  const handleGuest = async () => {
    setError(null);
    setBusy(true);
    try {
      const cred = await signInAsGuest();
      const idToken = await cred.user.getIdToken();
      const result = await authService.startSession(idToken);
      // Guest sessions never need profile completion; treat any unexpected
      // needsProfile here as an error rather than dropping into the form.
      if ('needsProfile' in result && result.needsProfile) {
        setError('Guest session could not be created. Please try signing in.');
        return;
      }
      setUser(result as User);
      navigate('/hub');
    } catch (e) {
      setError(errorMessage(e, 'Could not start guest session'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="auth-wrap">
        <Panel className="auth-card">
          <div className="auth-head">
            <h1 className="auth-title">
              {mode === 'signin' ? 'Sign in' : 'Create your account'}
            </h1>
            <p className="auth-sub">
              {mode === 'signin'
                ? 'Welcome back — jump into your hubs.'
                : 'Set up your account to start building hubs.'}
            </p>
          </div>

          {error && <Alert tone="error">{error}</Alert>}
          {notice && <Alert tone="success">{notice}</Alert>}

          <Button
            variant="ghost"
            block
            icon="pi pi-google"
            onClick={handleGoogle}
            disabled={busy}
          >
            Continue with Google
          </Button>

          <div className="auth-divider">or</div>

          <div className="auth-fields">
            <TextField
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
            <TextField
              id="password"
              label="Password"
              password
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && email && password) handleEmailSubmit();
              }}
            />
            <Button
              block
              loading={busy}
              onClick={handleEmailSubmit}
              disabled={busy || !email || !password}
            >
              {mode === 'signin' ? 'Sign in' : 'Sign up'}
            </Button>
            {mode === 'signin' && (
              <button
                type="button"
                className="auth-link"
                onClick={handleForgotPassword}
                disabled={busy}
              >
                Forgot password?
              </button>
            )}
          </div>

          <div className="auth-toggle">
            {mode === 'signin' ? (
              <button type="button" onClick={() => setMode('signup')}>
                Don't have an account? Sign up
              </button>
            ) : (
              <button type="button" onClick={() => setMode('signin')}>
                Already have an account? Sign in
              </button>
            )}
          </div>

          <div className="auth-divider">or</div>

          <Button
            variant="ghost"
            block
            icon="pi pi-user"
            onClick={handleGuest}
            disabled={busy}
          >
            Continue as Guest
          </Button>
          <p className="auth-guest-hint">
            Browse hubs and chat without an account. Sign up to create your own.
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}
