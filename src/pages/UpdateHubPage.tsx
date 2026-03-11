import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Room } from "../types";
import RoomFormTemplate from "../templates/RoomFormTemplate";
import { roomService } from "../services/api";

export default function UpdateHubPage() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const [loading, setLoading] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (roomId) {
      fetchRoom();
    }
  }, [roomId]);

  const fetchRoom = async () => {
    try {
      setFetching(true);
      if (roomId) {
        const data = await roomService.getRoomById(roomId);
        setRoom(data);
      }
    } catch (error: unknown) {
      navigate("/hub");
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (data: Room) => {
    try {
      setLoading(true);
      if (roomId) {
        await roomService.updateRoom(roomId, data);

        // Redirect after 2 seconds
        setTimeout(() => {
          navigate("/hub");
        }, 2000);
      }
    } catch (error: unknown) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>Loading...</div>
    );
  }

  return (
    <>
      {room && (
        <RoomFormTemplate
          title="Update Hub"
          onSubmit={handleSubmit}
          loading={loading}
          initialData={room}
        />
      )}
    </>
  );
}
