import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '@/services/api';
import { AVATARS, findAvatar } from '@/utils/avatars';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/ui/AppShell';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import AvatarSelector from '@/components/avatar/AvatarSelector';
import { errorMessage } from '@/utils/errorMessage';
import './auth.css';

export default function SelectAvatarPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [selectedKey, setSelectedKey] = useState<string>(AVATARS[0]?.key ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = findAvatar(selectedKey);

  const onConfirm = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await userService.updateMe({ avatarKey: selected.key });
      setUser(updated);
      navigate('/hub', { replace: true });
    } catch (e) {
      setError(errorMessage(e, 'Failed to save avatar'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="auth-wrap">
        <Panel className="auth-card auth-card--wide">
          <div className="auth-head">
            <h1 className="auth-title">Choose your avatar</h1>
            <p className="auth-sub">
              This is how you'll appear in every hub. You can change it later from
              Settings.
            </p>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <AvatarSelector
            value={selectedKey}
            onChange={setSelectedKey}
            disabled={busy}
          />

          <Button block loading={busy} onClick={onConfirm} disabled={busy || !selected}>
            Confirm and continue
          </Button>
        </Panel>
      </div>
    </AppShell>
  );
}
