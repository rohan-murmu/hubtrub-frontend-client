import type { ReactNode } from 'react';
import './ui.css';

type Tone = 'error' | 'success' | 'info';

const ICONS: Record<Tone, string> = {
  error: 'pi pi-exclamation-circle',
  success: 'pi pi-check-circle',
  info: 'pi pi-info-circle',
};

interface AlertProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

export default function Alert({ tone = 'error', children, className = '' }: AlertProps) {
  return (
    <div className={`sx-alert sx-alert--${tone} ${className}`.trim()} role="alert">
      <i className={`sx-alert__icon ${ICONS[tone]}`} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
