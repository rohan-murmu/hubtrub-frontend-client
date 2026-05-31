import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/ui/AppShell';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import Alert from '@/components/ui/Alert';
import { errorMessage } from '@/utils/errorMessage';
import type { AuthType } from '@/types';
import './auth.css';

/** Strip all whitespace — usernames must contain no spaces. */
const sanitizeUsername = (value: string) => value.replace(/\s+/g, '');

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const navState = location.state as { authType?: AuthType; email?: string } | null;
  const passedAuthType = navState?.authType;
  const passedEmail = navState?.email ?? '';

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Debounced username availability check.
  useEffect(() => {
    if (!username) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    const handle = setTimeout(async () => {
      try {
        const ok = await authService.usernameAvailable(username);
        setUsernameStatus(ok ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [username]);

  const onSubmit = async () => {
    if (!passedAuthType) {
      setError('Missing auth context — please sign in again.');
      navigate('/auth');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const created = await authService.completeProfile({
        name: name.trim(),
        username: username.trim(),
        email: passedEmail || undefined,
        authType: passedAuthType,
      });
      setUser(created);
      navigate('/auth/select-avatar', { replace: true });
    } catch (e) {
      setError(errorMessage(e, 'Failed to save profile'));
    } finally {
      setBusy(false);
    }
  };

  const usernameHint =
    usernameStatus === 'checking'
      ? 'Checking availability…'
      : usernameStatus === 'available'
        ? '✓ Available'
        : usernameStatus === 'taken'
          ? '✗ Taken'
          : 'No spaces — letters, numbers, and symbols only.';

  return (
    <AppShell>
      <div className="auth-wrap">
        <Panel className="auth-card">
          <div className="auth-head">
            <h1 className="auth-title">Profile Details</h1>
            <p className="auth-sub">
              Tell us your name and pick a username — you'll choose your in-world
              avatar next.
            </p>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <div className="auth-fields">
            <TextField
              id="name"
              label="Name"
              placeholder="How others see you"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
            <TextField
              id="username"
              label="Username"
              placeholder="no spaces"
              maxLength={20}
              showCount
              value={username}
              onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
              disabled={busy}
              hint={username ? usernameHint : undefined}
              hintState={
                usernameStatus === 'available'
                  ? 'ok'
                  : usernameStatus === 'taken'
                    ? 'bad'
                    : 'neutral'
              }
            />
            <Button
              block
              loading={busy}
              onClick={onSubmit}
              disabled={busy || !name || !username || usernameStatus !== 'available'}
            >
              Continue
            </Button>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
