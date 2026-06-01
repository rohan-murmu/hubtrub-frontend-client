import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Room } from '@/types';
import { roomService } from '@/services/api';
import { useCurrentUser } from '@/context/UserContext';
import AppShell from '@/components/ui/AppShell';
import Button from '@/components/ui/Button';
import UserMenu from '@/components/ui/UserMenu';
import ConfirmModal from '@/components/ui/ConfirmModal';
import RoomCard from '@/components/common/RoomCard';
import RoomCardSkeleton from '@/components/common/RoomCardSkeleton';
import { errorMessage } from '@/utils/errorMessage';
import { isGuest } from '@/utils/isGuest';
import './MainPage.css';

type Tab = 'home' | 'mine';

export default function MainPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const guest = isGuest(user);

  const [tab, setTab] = useState<Tab>('home');
  const [homeRooms, setHomeRooms] = useState<Room[] | null>(null);
  const [myRooms, setMyRooms] = useState<Room[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Room | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (tab === 'home' && homeRooms === null) {
          const data = await roomService.getRooms();
          if (!cancelled) setHomeRooms(data);
        } else if (tab === 'mine' && myRooms === null) {
          const data = await roomService.getMyRooms();
          if (!cancelled) setMyRooms(data);
        }
      } catch {
        if (!cancelled) {
          if (tab === 'home') setHomeRooms([]);
          else setMyRooms([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [tab, homeRooms, myRooms]);

  const confirmDelete = async () => {
    const roomId = pendingDelete?.roomId;
    if (!roomId) return;
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await roomService.deleteRoom(roomId);
      setMyRooms((prev) => (prev ? prev.filter((r) => r.roomId !== roomId) : prev));
      // Keep the Home list fresh too if it was already loaded.
      setHomeRooms((prev) => (prev ? prev.filter((r) => r.roomId !== roomId) : prev));
      setPendingDelete(null);
    } catch (e) {
      setDeleteError(errorMessage(e, 'Failed to delete hub'));
    } finally {
      setDeleteBusy(false);
    }
  };

  const rooms = tab === 'home' ? homeRooms : myRooms;
  const title = tab === 'home' ? 'Latest hubs' : 'My Hubs';

  const headerRight = (
    <>
      {!guest && (
        <Button icon="pi pi-plus" onClick={() => navigate('/hub/create')}>
          Create Hub
        </Button>
      )}
      {user && <UserMenu user={user} />}
    </>
  );

  return (
    <AppShell headerRight={headerRight}>
      <div className="hub-layout">
        <aside className="hub-sidebar">
          <button
            type="button"
            className={`hub-sidebar__tab${tab === 'home' ? ' is-active' : ''}`}
            onClick={() => setTab('home')}
          >
            <i className="pi pi-home" aria-hidden="true" />
            Home
          </button>
          {!guest && (
            <button
              type="button"
              className={`hub-sidebar__tab${tab === 'mine' ? ' is-active' : ''}`}
              onClick={() => setTab('mine')}
            >
              <i className="pi pi-folder" aria-hidden="true" />
              My Hubs
            </button>
          )}
        </aside>

        <main className="hub-main">
          <h1 className="hub-main__title">{title}</h1>

          {loading && rooms === null ? (
            <div className="hub-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <RoomCardSkeleton key={i} />
              ))}
            </div>
          ) : rooms && rooms.length > 0 ? (
            <div className="hub-grid">
              {rooms.map((room) => (
                <RoomCard
                  key={room.roomId}
                  room={room}
                  showAdmin={tab === 'mine'}
                  onEdit={() => navigate(`/hub/${room.roomId}/edit`)}
                  onDelete={() => setPendingDelete(room)}
                />
              ))}
            </div>
          ) : (
            <div className="hub-state">
              {tab === 'mine'
                ? "You haven't created any hubs yet."
                : 'No hubs available yet. Create one to get started!'}
            </div>
          )}
        </main>
      </div>

      <ConfirmModal
        open={!!pendingDelete}
        title="Delete hub?"
        message={
          <>
            Delete <strong>{pendingDelete?.name}</strong>? This permanently removes
            the hub and cannot be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        loading={deleteBusy}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
      />
    </AppShell>
  );
}
