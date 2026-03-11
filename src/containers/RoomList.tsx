import type { Room } from "../types";
import RoomCard from "../components/common/RoomCard";
import "./RoomList.css";

interface RoomListProps {
  rooms: Room[];
  onEdit?: (room: Room) => void;
  onDelete?: (roomId: string) => void;
  userId?: string;
}

export default function RoomList({
  rooms,
  onEdit,
  onDelete,
}: RoomListProps) {

  const client = localStorage.getItem("client");
  const clientUserName = client ? JSON.parse(client).clientUserName : null;

  if (rooms.length === 0) {
    return (
      <div className="room-list-container">
        <div className="room-list-header">
          <h2>Available Hubs</h2>
        </div>
        <div className="room-list-empty">
          <p>No hubs available yet. Create one to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="room-list-container">
      <div className="room-list-header">
        <h2>All Hubs</h2>
      </div>
      <div className="room-list-grid">
        {rooms.map((room) => (
          <RoomCard
            key={room.roomId}
            room={room}
            isAdmin={room.roomAdmin === clientUserName}
            onEdit={() => onEdit?.(room)}
            onDelete={() => onDelete?.(room.roomId || "")}
          />
        ))}
      </div>
    </div>
  );
}
