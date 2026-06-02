import { useNavigate } from 'react-router-dom';
import type { Room } from '@/types';
import { relativeTime } from '@/utils/relativeTime';
import { findScene } from '@/utils/scenes';
import './RoomCard.css';

interface RoomCardProps {
  room: Room;
  /** Show edit/delete controls (My Hubs tab only). */
  showAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function RoomCard({ room, showAdmin = false, onEdit, onDelete }: RoomCardProps) {
  const navigate = useNavigate();

  const creator = room.creatorUsername || room.userId || 'unknown';
  const members = room.activeMembers ?? 0;
  const capacity = room.capacity;
  // Prefer the server's isFull flag; fall back to count >= capacity if only the
  // raw numbers came through.
  const isFull = room.isFull ?? (capacity != null && members >= capacity);
  const scene = findScene(room.sceneKey);

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    // Block the join when the hub is full — the WebSocket would only be
    // refused server-side anyway, so we stop the user before the dead end.
    if (isFull) return;
    navigate(`/hub/${room.roomId}`);
  };

  // Show "N / capacity" when we know the cap, otherwise just the live count.
  const membersLabel = capacity != null ? `${members} / ${capacity}` : `${members}`;
  const membersTitle = isFull
    ? `Hub is full (${members}/${capacity})`
    : `${members} ${members === 1 ? 'member' : 'members'} active`;

  return (
    <article
      className={`room-card${isFull ? ' room-card--full' : ''}`}
      onClick={handleCardClick}
      aria-disabled={isFull}
    >
      <div className="room-card__preview" data-scene={room.sceneKey}>
        {scene?.image && (
          <img
            className="room-card__preview-img"
            src={scene.image}
            alt={scene.label}
            draggable={false}
          />
        )}
        <span className="room-card__scene">{scene?.label ?? room.sceneKey ?? 'world'}</span>
        {isFull && <span className="room-card__full-badge">Full</span>}
        <span
          className={`room-card__members${isFull ? ' room-card__members--full' : ''}`}
          title={membersTitle}
        >
          <i className="pi pi-users" aria-hidden="true" />
          {membersLabel}
        </span>
        {showAdmin && (
          <div className="room-card__actions">
            <button
              type="button"
              className="room-card__icon-btn"
              aria-label="Edit hub"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
            >
              <i className="pi pi-pencil" />
            </button>
            <button
              type="button"
              className="room-card__icon-btn room-card__icon-btn--danger"
              aria-label="Delete hub"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
            >
              <i className="pi pi-trash" />
            </button>
          </div>
        )}
      </div>

      <div className="room-card__body">
        <h3 className="room-card__name">{room.name}</h3>
        <p className="room-card__meta">
          <span className="room-card__author">@{creator}</span>
          {room.createdAt && (
            <>
              <span className="room-card__dot">·</span>
              <span>{relativeTime(room.createdAt)}</span>
            </>
          )}
        </p>
      </div>
    </article>
  );
}
