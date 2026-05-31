import { useEffect, type ReactNode } from 'react';
import Panel from './Panel';
import Button from './Button';
import Alert from './Alert';
import './ui.css';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Shared confirmation dialog (replaces window.confirm). Used for destructive
 *  actions like deleting a hub or an account. */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className="sx-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <Panel className="sx-modal">
        <h2 className="sx-modal__title">{title}</h2>
        <div className="sx-modal__body">{message}</div>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="sx-modal__actions">
          <Button variant="subtle" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
