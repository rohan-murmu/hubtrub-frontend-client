import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { Client, Room, AuthResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('client');
      window.location.href = '/';
    }
    
    // Handle specific error messages
    if (error.response?.status === 409) {
      // Conflict error - username already exists
      const errorData = error.response.data;
      const errorMessage = errorData?.error || 'Username already exists';
      const errorWithStatus = new Error(errorMessage);
      (errorWithStatus as any).status = 409;
      return Promise.reject(errorWithStatus);
    }
    
    return Promise.reject(error);
  }
);

export const authService = {
  createUser: async (data: Client): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/client', data);
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getToken: () => localStorage.getItem('token'),
};

export const roomService = {
  getRooms: async (): Promise<Room[]> => {
    const response = await api.get<Room[]>('/room');
    return response.data;
  },

  getRoomById: async (roomId: string): Promise<Room> => {
    const response = await api.get<Room>(`/room/${roomId}`);
    return response.data;
  },

  createRoom: async (data: Room): Promise<Room> => {
    const response = await api.post<Room>('/room', data);
    return response.data;
  },

  updateRoom: async (roomId: string, data: Room): Promise<Room> => {
    const response = await api.put<Room>(`/room/${roomId}`, data);
    return response.data;
  },

  deleteRoom: async (roomId: string): Promise<void> => {
    await api.delete(`/room/${roomId}`);
  },
};

export const userService = {
  updateProfile: async (data: Client, clientId?: string): Promise<Client> => {
    const response = await api.put<Client>(`/client/${clientId}`, data);
    return response.data;
  },

  getClientById: async (clientId: string): Promise<Client> => {
    const response = await api.get<Client>(`/client/${clientId}`);
    return response.data;
  },
};

export default api;
