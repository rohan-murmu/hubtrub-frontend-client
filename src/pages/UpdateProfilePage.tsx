import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Client } from '../types';
import UserFormTemplate from '../templates/UserFormTemplate';
import { userService } from '../services/api';

export default function UpdateProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<Client | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    // Get user from localStorage
    const userData = localStorage.getItem('client');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Failed to parse user data:', error);
      }
    }
    setFetching(false);
  }, []);

  const handleSubmit = async (data: Client) => {
    try {
      setLoading(true);
      const updatedUser = await userService.updateProfile(data, user?.clientId);
      setUser(updatedUser);
      localStorage.setItem('client', JSON.stringify(updatedUser));

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

  if (fetching) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>;
  }

  return (
    <>
      {user && (
        <UserFormTemplate
          title="Update Profile"
          onSubmit={handleSubmit}
          loading={loading}
          initialData={user}
        />
      )}
    </>
  );
}
