import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyResetCode, confirmReset, applyVerifyCode } from '@/lib/firebase';
import { errorMessage } from '@/utils/errorMessage';
import AppShell from '@/components/ui/AppShell';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import Alert from '@/components/ui/Alert';
import './auth.css';

/** Custom landing page for Firebase email action links. Firebase's Console
 *  "Action URL" points here; it appends ?mode=...&oobCode=...&continueUrl=...
 *  We complete the action with the client SDK so the user never sees Firebase's
 *  default UI. Mounted as a PUBLIC route — links may be opened signed-out. */
export default function AuthActionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get('mode');
  const oobCode = params.get('oobCode') ?? '';

  // 'loading' until we know the code is valid (verify) / applied (verifyEmail).
  const [status, setStatus] = useState<'loading' | 'form' | 'done' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!oobCode || (mode !== 'resetPassword' && mode !== 'verifyEmail')) {
        setError('This link is invalid or unsupported.');
        setStatus('error');
        return;
      }
      try {
        if (mode === 'resetPassword') {
          const mail = await verifyResetCode(oobCode);
          if (cancelled) return;
          setEmail(mail);
          setStatus('form');
        } else {
          await applyVerifyCode(oobCode);
          if (cancelled) return;
          setStatus('done');
        }
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e, 'This link is invalid or has expired.'));
        setStatus('error');
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [mode, oobCode]);

  const submitReset = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await confirmReset(oobCode, password);
      setStatus('done');
    } catch (e) {
      setError(errorMessage(e, 'Could not reset password.'));
    } finally {
      setBusy(false);
    }
  };

  const isReset = mode === 'resetPassword';
  const title = isReset ? 'Reset password' : 'Verify email';

  return (
    <AppShell>
      <div className="auth-wrap">
        <Panel className="auth-card">
          <div className="auth-head">
            <h1 className="auth-title">{title}</h1>
            {status === 'form' && isReset && (
              <p className="auth-sub">Set a new password for {email}.</p>
            )}
          </div>

          {status === 'loading' && (
            <p className="auth-sub">Checking your link…</p>
          )}

          {status === 'error' && (
            <>
              <Alert tone="error">{error}</Alert>
              <Button block onClick={() => navigate('/auth')}>
                Back to sign in
              </Button>
            </>
          )}

          {status === 'form' && isReset && (
            <div className="auth-fields">
              {error && <Alert tone="error">{error}</Alert>}
              <TextField
                id="new-password"
                label="New password"
                password
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              <TextField
                id="confirm-password"
                label="Confirm password"
                password
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && password && confirm) submitReset();
                }}
              />
              <Button
                block
                loading={busy}
                onClick={submitReset}
                disabled={busy || !password || !confirm}
              >
                Reset password
              </Button>
            </div>
          )}

          {status === 'done' && (
            <>
              <Alert tone="success">
                {isReset
                  ? 'Your password has been reset. You can now sign in.'
                  : 'Your email is verified. You can now sign in.'}
              </Alert>
              <Button block onClick={() => navigate('/auth')}>
                Go to sign in
              </Button>
            </>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
