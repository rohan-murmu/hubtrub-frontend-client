import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Room } from '@/types';
import { roomService } from '@/services/api';
import { findScene } from '@/utils/scenes';
import AppShell from '@/components/ui/AppShell';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import HubDetailsForm, { type HubDetails } from '@/components/hub/HubDetailsForm';
import { errorMessage } from '@/utils/errorMessage';
import './CreateHubPage.css';

export default function UpdateHubPage() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [sceneKey, setSceneKey] = useState('');
  const [details, setDetails] = useState<HubDetails>({
    name: '',
    description: '',
    visibility: 'PUBLIC',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    (async () => {
      try {
        const data: Room = await roomService.getRoomById(roomId);
        if (cancelled) return;
        setSceneKey(data.sceneKey);
        setDetails({
          name: data.name,
          description: data.description,
          visibility: data.visibility ?? 'PUBLIC',
        });
      } catch {
        navigate('/hub');
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, navigate]);

  const handleUpdate = async () => {
    if (!roomId) return;
    setError(null);
    setLoading(true);
    try {
      // Scene is immutable on update — only hub details change.
      await roomService.updateRoom(roomId, {
        name: details.name.trim(),
        description: details.description,
        visibility: details.visibility,
      });
      navigate('/hub');
    } catch (e) {
      setError(errorMessage(e, 'Failed to update hub'));
    } finally {
      setLoading(false);
    }
  };

  const scene = findScene(sceneKey);

  return (
    <AppShell>
      <div className="hub-page-wrap">
        <Panel className="hub-page-card">
          <div className="hub-page-head">
            <h1 className="hub-page-title">Update Hub</h1>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          {fetching ? (
            <div className="hub-state">Loading…</div>
          ) : (
            <>
              <HubDetailsForm value={details} onChange={setDetails} disabled={loading} />

              <div>
                <label className="hub-form__field-label">World scene (cannot be changed)</label>
                <div className="hub-readonly-scene">
                  {scene ? scene.label : sceneKey || '—'}
                </div>
              </div>

              <div className="hub-page-foot">
                <Button variant="subtle" onClick={() => navigate('/hub')} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} loading={loading} disabled={loading || !details.name.trim()}>
                  Update Hub
                </Button>
              </div>
            </>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
