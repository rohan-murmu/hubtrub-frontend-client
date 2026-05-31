import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/ui/AppShell';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import './auth.css';
import './NotFoundPage.css';

/** Catch-all route. Anything that doesn't match a real route lands here. */
export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <div className="auth-wrap">
        <Panel className="auth-card not-found">
          <div className="not-found__code" aria-hidden="true">404</div>
          <h1 className="not-found__title">Are you lost?</h1>
          <p className="not-found__msg">
            We couldn't find the page you were looking for. It may have moved, been
            renamed, or never existed. Let's get you back to familiar ground.
          </p>
          <Button icon="pi pi-home" onClick={() => navigate('/')}>
            Take me home
          </Button>
        </Panel>
      </div>
    </AppShell>
  );
}
