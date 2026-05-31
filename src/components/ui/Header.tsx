import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import './ui.css';

interface HeaderProps {
  right?: ReactNode;
  /** Where the logo links to. Defaults to the hub listing. */
  logoHref?: string;
}

/** Shared top bar with the pixel-font hubtrub logo. Used on every themed page
 *  except RoomPage and the landing screen. */
export default function Header({ right, logoHref = '/hub' }: HeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="sx-header">
      <button
        type="button"
        className="sx-logo"
        onClick={() => navigate(logoHref)}
        aria-label="hubtrub home"
      >
        hub<span className="sx-logo-accent">trub</span>
      </button>
      {right && <div className="sx-header__right">{right}</div>}
    </header>
  );
}
