import type { ReactNode } from 'react';
import Header from './Header';
import './ui.css';

interface AppShellProps {
  children: ReactNode;
  /** Content rendered on the right side of the header (menu, buttons…). */
  headerRight?: ReactNode;
  /** Hide the header entirely (rarely needed). */
  hideHeader?: boolean;
  className?: string;
}

/** Full-height themed surface + shared header used by every non-Room page. */
export default function AppShell({
  children,
  headerRight,
  hideHeader = false,
  className = '',
}: AppShellProps) {
  return (
    <div className={`sx-app-shell ${className}`.trim()}>
      {!hideHeader && <Header right={headerRight} />}
      {children}
    </div>
  );
}
