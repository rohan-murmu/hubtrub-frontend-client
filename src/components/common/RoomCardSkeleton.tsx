import './RoomCardSkeleton.css';

// Placeholder that mirrors RoomCard's layout (210px preview + body) so the
// hub grid keeps its shape while rooms load, instead of a bare "Loading…" line.
export default function RoomCardSkeleton() {
  return (
    <div className="room-card-skeleton" aria-hidden="true">
      <div className="room-card-skeleton__preview">
        <span className="room-card-skeleton__pill room-card-skeleton__pill--members" />
        <span className="room-card-skeleton__pill room-card-skeleton__pill--scene" />
      </div>
      <div className="room-card-skeleton__body">
        <span className="room-card-skeleton__line room-card-skeleton__line--title" />
        <span className="room-card-skeleton__line room-card-skeleton__line--meta" />
      </div>
    </div>
  );
}
