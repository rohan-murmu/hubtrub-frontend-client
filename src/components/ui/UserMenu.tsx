import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/api';
import { firebaseSignOut } from '@/lib/firebase';
import Avatar from '@/components/common/Avatar';
import type { User } from '@/types';
import { isGuest } from '@/utils/isGuest';
import './UserMenu.css';

interface UserMenuProps {
  user: User;
}

/** Avatar button that opens a profile-rich popover (replaces the old PrimeReact
 *  hamburger Menu). Dark-mode toggle intentionally lives in Settings now. */
export default function UserMenu({ user }: UserMenuProps) {
  const navigate = useNavigate();
  const { clear: clearAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const guest = isGuest(user);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleLogout = async () => {
    try { await authService.logout(); } catch { /* best-effort */ }
    // Guest sessions also need their Firebase anon credential cleared, else
    // a hot-reload will silently restore them.
    try { await firebaseSignOut(); } catch { /* best-effort */ }
    clearAuth();
    navigate('/');
  };

  const handleSignUp = async () => {
    setOpen(false);
    try { await authService.logout(); } catch { /* best-effort */ }
    try { await firebaseSignOut(); } catch { /* best-effort */ }
    clearAuth();
    navigate('/auth');
  };

  return (
    <div className="sx-usermenu" ref={rootRef}>
      <button
        type="button"
        className="sx-usermenu__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <Avatar
          name={user.name || user.username}
          avatarKey={user.avatarKey}
          size="sm"
        />
      </button>

      {open && (
        <div className="sx-usermenu__popover" role="menu">
          <div className="sx-usermenu__header">
            <Avatar
              name={user.name || user.username}
              avatarKey={user.avatarKey}
              size="md"
            />
            <div className="sx-usermenu__id">
              <span className="sx-usermenu__name">{user.name}</span>
              <span className="sx-usermenu__username">@{user.username}</span>
            </div>
          </div>

          <div className="sx-usermenu__divider" />

          {guest ? (
            <button
              type="button"
              className="sx-usermenu__item"
              role="menuitem"
              onClick={handleSignUp}
            >
              <i className="pi pi-user-plus" aria-hidden="true" />
              Sign up
            </button>
          ) : (
            <button
              type="button"
              className="sx-usermenu__item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/settings');
              }}
            >
              <i className="pi pi-cog" aria-hidden="true" />
              Settings
            </button>
          )}
          <button
            type="button"
            className="sx-usermenu__item sx-usermenu__item--danger"
            role="menuitem"
            onClick={handleLogout}
          >
            <i className="pi pi-sign-out" aria-hidden="true" />
            {guest ? 'Leave' : 'Logout'}
          </button>
        </div>
      )}
    </div>
  );
}
