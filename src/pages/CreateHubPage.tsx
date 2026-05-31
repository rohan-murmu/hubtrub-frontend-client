import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomService } from '@/services/api';
import AppShell from '@/components/ui/AppShell';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import HubDetailsForm, { type HubDetails } from '@/components/hub/HubDetailsForm';
import SceneSelector from '@/components/hub/SceneSelector';
import { errorMessage } from '@/utils/errorMessage';
import './CreateHubPage.css';

export default function CreateHubPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [details, setDetails] = useState<HubDetails>({
    name: '',
    description: '',
    visibility: 'PUBLIC',
  });
  const [sceneKey, setSceneKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openExplore = (key: string) => {
    window.open(`/explore?world=${encodeURIComponent(key)}`, '_blank', 'noopener');
  };

  const handleCreate = async () => {
    setError(null);
    if (!sceneKey) {
      setError('Pick a world scene to continue.');
      return;
    }
    setLoading(true);
    try {
      await roomService.createRoom({
        name: details.name.trim(),
        description: details.description,
        sceneKey,
        visibility: 'PUBLIC',
      });
      navigate('/hub');
    } catch (e) {
      setError(errorMessage(e, 'Failed to create hub'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="hub-page-wrap">
        <Panel className="hub-page-card">
          <div className="hub-page-head">
            <h1 className="hub-page-title">Create Hub</h1>
            <div className="hub-steps">
              <span className={`hub-step ${step === 1 ? 'is-active' : ''}`}>
                <span className="hub-step__dot">1</span> Hub details
              </span>
              <span className="hub-step__sep" />
              <span className={`hub-step ${step === 2 ? 'is-active' : ''}`}>
                <span className="hub-step__dot">2</span> World scene
              </span>
            </div>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          {step === 1 ? (
            <>
              <HubDetailsForm value={details} onChange={setDetails} disabled={loading} />
              <div className="hub-page-foot">
                <Button variant="subtle" onClick={() => navigate('/hub')}>
                  Cancel
                </Button>
                <Button onClick={() => setStep(2)} disabled={!details.name.trim()}>
                  Next: choose world
                </Button>
              </div>
            </>
          ) : (
            <>
              <SceneSelector
                value={sceneKey}
                onChange={setSceneKey}
                onExplore={openExplore}
                disabled={loading}
              />
              <div className="hub-page-foot">
                <Button variant="subtle" onClick={() => setStep(1)} disabled={loading}>
                  Back
                </Button>
                <Button onClick={handleCreate} loading={loading} disabled={loading || !sceneKey}>
                  Create Hub
                </Button>
              </div>
            </>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
