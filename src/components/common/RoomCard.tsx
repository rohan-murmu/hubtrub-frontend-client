import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";
import type { Room } from "../../types";
import "./RoomCard.css";

interface RoomCardProps {
  room: Room;
  isAdmin: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function RoomCard({
  room,
  isAdmin,
  onEdit,
  onDelete,
}: RoomCardProps) {
  const navigate = useNavigate();

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    // Navigate to the room page
    navigate(`/hub/${room.roomId}`);
  };

  const footer = (
    <>
      {isAdmin && (
        <div className="room-card-footer">
          <Button
            label=""
            icon="pi pi-pencil"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            className="p-button-sm p-button-info"
          />
          <Button
            label=""
            icon="pi pi-trash"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="p-button-sm p-button-danger"
          />
        </div>
      )}
    </>
  );

  return (
    <Card
      className="room-card"
      footer={footer}
      onClick={handleCardClick}
      style={{ cursor: "pointer" }}
    >
      <div className="room-card-image">
        {room.roomScene ? (
          <img src={room.roomScene} alt={room.roomName} />
        ) : (
          <div className="room-card-placeholder">No Scene</div>
        )}
      </div>
      <div className="room-card-content">
        <h3 className="room-card-title">{room.roomName}</h3>
        <p className="room-card-meta">
          <small>
            By {room.roomAdmin || "Unknown"}
            {room.roomCreatedAt &&
              ` • ${new Date(room.roomCreatedAt).toLocaleDateString()}`}
          </small>
        </p>
      </div>
    </Card>
  );
}
