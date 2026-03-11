import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Room } from '../types';
import RoomFormTemplate from '../templates/RoomFormTemplate';
import { roomService } from '../services/api';

export default function CreateHubPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: Room) => {
    try {
      setLoading(true);
      await roomService.createRoom(data);

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/hub');
      }, 2000);
    } catch (error: unknown) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <RoomFormTemplate
        title="Create Hub"
        onSubmit={handleSubmit}
        loading={loading}
      />
    </>
  );
}
