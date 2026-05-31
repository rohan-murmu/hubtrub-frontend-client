import type { CSSProperties, ReactNode } from 'react';
import './ui.css';

interface PanelProps {
  children: ReactNode;
  solid?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Glassmorphic surface matching the RoomPage overlay cards. */
export default function Panel({ children, solid = false, className = '', style }: PanelProps) {
  return (
    <div
      className={`sx-panel ${solid ? 'sx-panel--solid' : ''} ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}
