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

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    navigate(`/hub/${room.roomId}`);
  };

  const creator = room.creatorUsername || room.userId || 'unknown';
  const members = room.activeMembers ?? 0;
  const scene = findScene(room.sceneKey);

  return (
    <article className="room-card" onClick={handleCardClick}>
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
        <span
          className="room-card__members"
          title={`${members} ${members === 1 ? 'member' : 'members'} active`}
        >
          <i className="pi pi-users" aria-hidden="true" />
          {members}
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
