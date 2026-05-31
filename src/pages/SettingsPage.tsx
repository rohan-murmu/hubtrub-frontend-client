import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, userService } from '@/services/api';
import { sendVerificationEmail, refreshIdToken, changePassword } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useCurrentUser } from '@/context/UserContext';
import { useTheme, type ThemePreference } from '@/context/ThemeContext';
import { AVATARS } from '@/utils/avatars';
import AppShell from '@/components/ui/AppShell';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import Alert from '@/components/ui/Alert';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AvatarSelector from '@/components/avatar/AvatarSelector';
import { errorMessage, errorStatus } from '@/utils/errorMessage';
import './SettingsPage.css';

type Tab = 'profile' | 'appearance' | 'account';

const sanitizeUsername = (value: string) => value.replace(/\s+/g, '');

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: string }> = [
  { value: 'light', label: 'Light', icon: 'pi pi-sun' },
  { value: 'dark', label: 'Dark', icon: 'pi pi-moon' },
  { value: 'system', label: 'System', icon: 'pi pi-desktop' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { setUser, clear } = useAuth();
  const { theme, setTheme } = useTheme();

  const [tab, setTab] = useState<Tab>('profile');

  // ── Profile tab ──────────────────────────────────────────────
  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState(false);

  const usernameUnchanged = username === user?.username;

  useEffect(() => {
    if (!username || usernameUnchanged) {
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
  }, [username, usernameUnchanged]);

  const saveProfile = async () => {
    setProfileError(null);
    setProfileOk(false);
    setProfileBusy(true);
    try {
      const updated = await userService.updateMe({
        name: name.trim(),
        username: username.trim(),
      });
      setUser(updated);
      setProfileOk(true);
    } catch (e) {
      setProfileError(
        errorStatus(e) === 409
          ? 'Username already taken'
          : errorMessage(e, 'Failed to update profile'),
      );
    } finally {
      setProfileBusy(false);
    }
  };

  // ── Appearance tab ───────────────────────────────────────────
  const [avatarKey, setAvatarKey] = useState(user?.avatarKey ?? AVATARS[0]?.key ?? '');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarOk, setAvatarOk] = useState(false);

  const saveAvatar = async () => {
    setAvatarError(null);
    setAvatarOk(false);
    setAvatarBusy(true);
    try {
      const updated = await userService.updateMe({ avatarKey });
      setUser(updated);
      setAvatarOk(true);
    } catch (e) {
      setAvatarError(errorMessage(e, 'Failed to save avatar'));
    } finally {
      setAvatarBusy(false);
    }
  };

  // ── Account tab ──────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Email verification (EMAIL accounts only).
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const sendVerification = async () => {
    setVerifyNotice(null);
    setVerifyError(null);
    setVerifyBusy(true);
    try {
      await sendVerificationEmail();
      setVerifyNotice(
        `Verification email sent to ${user?.email}. Open the link, then click "I've verified".`,
      );
    } catch (e) {
      setVerifyError(errorMessage(e, 'Could not send verification email'));
    } finally {
      setVerifyBusy(false);
    }
  };

  // Change password (EMAIL accounts only).
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdNotice, setPwdNotice] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const submitPasswordChange = async () => {
    setPwdNotice(null);
    setPwdError(null);
    if (newPassword.length < 6) {
      setPwdError('New password must be at least 6 characters.');
      return;
    }
    setPwdBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setPwdNotice('Password updated.');
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setPwdError(
        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'Current password is incorrect.'
          : errorMessage(e, 'Could not change password'),
      );
    } finally {
      setPwdBusy(false);
    }
  };

  const refreshVerification = async () => {
    setVerifyNotice(null);
    setVerifyError(null);
    setVerifyBusy(true);
    try {
      const token = await refreshIdToken();
      if (!token) throw new Error('Please sign in again.');
      // Re-issue the session so the backend re-reads the email_verified claim.
      const res = await authService.startSession(token);
      if (!('needsProfile' in res)) {
        setUser(res);
        setVerifyNotice(
          res.emailVerified ? 'Your email is verified.' : 'Still not verified — check your inbox.',
        );
      }
    } catch (e) {
      setVerifyError(errorMessage(e, 'Could not refresh status'));
    } finally {
      setVerifyBusy(false);
    }
  };

  const deleteAccount = async () => {
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await userService.deleteMe();
      clear();
      navigate('/', { replace: true });
    } catch (e) {
      setDeleteError(errorMessage(e, 'Failed to delete account'));
      setDeleteBusy(false);
    }
  };

  const profileSavable =
    !!name.trim() &&
    !!username.trim() &&
    (usernameUnchanged || usernameStatus === 'available') &&
    !profileBusy;

  return (
    <AppShell>
      <div className="settings-wrap">
        <div className="settings-shell">
          <nav className="settings-tabs" aria-label="Settings sections">
            <button
              type="button"
              className={`settings-tab${tab === 'profile' ? ' is-active' : ''}`}
              onClick={() => setTab('profile')}
            >
              <i className="pi pi-user" aria-hidden="true" />
              Profile
            </button>
            <button
              type="button"
              className={`settings-tab${tab === 'appearance' ? ' is-active' : ''}`}
              onClick={() => setTab('appearance')}
            >
              <i className="pi pi-palette" aria-hidden="true" />
              Appearance
            </button>
            <button
              type="button"
              className={`settings-tab${tab === 'account' ? ' is-active' : ''}`}
              onClick={() => setTab('account')}
            >
              <i className="pi pi-shield" aria-hidden="true" />
              Account
            </button>
          </nav>

          <Panel className="settings-panel">
            {tab === 'profile' && (
              <>
                <h1 className="settings-title">Profile</h1>
                {profileError && <Alert tone="error">{profileError}</Alert>}
                {profileOk && <Alert tone="success">Profile updated.</Alert>}
                <TextField
                  id="name"
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={profileBusy}
                />
                <TextField
                  id="username"
                  label="Username"
                  placeholder="no spaces"
                  maxLength={20}
                  showCount
                  value={username}
                  onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                  disabled={profileBusy}
                  hint={
                    usernameUnchanged
                      ? undefined
                      : usernameStatus === 'checking'
                        ? 'Checking availability…'
                        : usernameStatus === 'available'
                          ? '✓ Available'
                          : usernameStatus === 'taken'
                            ? '✗ Taken'
                            : 'No spaces allowed.'
                  }
                  hintState={
                    usernameStatus === 'available'
                      ? 'ok'
                      : usernameStatus === 'taken'
                        ? 'bad'
                        : 'neutral'
                  }
                />
                <div className="settings-actions">
                  <Button onClick={saveProfile} loading={profileBusy} disabled={!profileSavable}>
                    Update
                  </Button>
                </div>
              </>
            )}

            {tab === 'appearance' && (
              <>
                <h1 className="settings-title">Appearance</h1>
                {avatarError && <Alert tone="error">{avatarError}</Alert>}
                {avatarOk && <Alert tone="success">Avatar saved.</Alert>}

                <div>
                  <p className="settings-section-label">Avatar</p>
                  <AvatarSelector
                    value={avatarKey}
                    onChange={setAvatarKey}
                    disabled={avatarBusy}
                  />
                  <div className="settings-actions">
                    <Button
                      onClick={saveAvatar}
                      loading={avatarBusy}
                      disabled={avatarBusy || avatarKey === user?.avatarKey}
                    >
                      Save avatar
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="settings-section-label">Theme</p>
                  <div className="theme-segment" role="radiogroup" aria-label="Theme">
                    {THEME_OPTIONS.map((opt) => (
                      <button
                        type="button"
                        key={opt.value}
                        role="radio"
                        aria-checked={theme === opt.value}
                        className={`theme-segment__option${theme === opt.value ? ' is-active' : ''}`}
                        onClick={() => setTheme(opt.value)}
                      >
                        <i className={opt.icon} aria-hidden="true" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'account' && (
              <>
                <h1 className="settings-title">Account</h1>

                <div>
                  <p className="settings-section-label">Sign-in method</p>
                  <div className="settings-readonly">
                    {user?.authType === 'GOOGLE' ? 'Google' : 'Email'}
                  </div>
                </div>

                <div>
                  <p className="settings-section-label">Email</p>
                  <div className="settings-readonly settings-email">
                    <span>{user?.email || '—'}</span>
                    <span
                      className={`settings-badge ${
                        user?.emailVerified ? 'is-ok' : 'is-warn'
                      }`}
                    >
                      <i className={user?.emailVerified ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'} />
                      {user?.emailVerified ? 'Verified' : 'Not verified'}
                    </span>
                  </div>
                </div>

                {user?.authType === 'EMAIL' && !user?.emailVerified && (
                  <div className="settings-verify">
                    {verifyNotice && <Alert tone="success">{verifyNotice}</Alert>}
                    {verifyError && <Alert tone="error">{verifyError}</Alert>}
                    <div className="settings-actions">
                      <Button onClick={sendVerification} loading={verifyBusy}>
                        Send verification email
                      </Button>
                      <Button variant="ghost" onClick={refreshVerification} disabled={verifyBusy}>
                        I've verified — refresh
                      </Button>
                    </div>
                  </div>
                )}

                {user?.authType === 'EMAIL' && (
                  <div className="settings-password">
                    <p className="settings-section-label">Change password</p>
                    {pwdNotice && <Alert tone="success">{pwdNotice}</Alert>}
                    {pwdError && <Alert tone="error">{pwdError}</Alert>}
                    <TextField
                      id="current-password"
                      label="Current password"
                      password
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={pwdBusy}
                    />
                    <TextField
                      id="new-password"
                      label="New password"
                      password
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={pwdBusy}
                    />
                    <div className="settings-actions">
                      <Button
                        onClick={submitPasswordChange}
                        loading={pwdBusy}
                        disabled={pwdBusy || !currentPassword || !newPassword}
                      >
                        Change password
                      </Button>
                    </div>
                  </div>
                )}

                <div className="settings-delete">
                  <p className="settings-section-label">Delete Account</p>
                  <div className="settings-danger-zone">
                    <p>
                      Deleting your account is permanent. All your hubs and data will
                      be removed and cannot be recovered.
                    </p>
                    <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                      Delete Account
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Panel>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Delete account?"
        message="This permanently deletes your account and all your hubs. This action cannot be undone."
        confirmLabel="Delete"
        danger
        loading={deleteBusy}
        error={deleteError}
        onConfirm={deleteAccount}
        onCancel={() => setConfirmOpen(false)}
      />
    </AppShell>
  );
}
