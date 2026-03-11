export interface Client {
  clientId?: string;
  clientUserName: string;
  clientAvatar: string;
}

export interface Room {
  roomId?: string;
  roomName: string;
  roomScene: string;
  roomAdmin?: string;
  roomCreatedAt?: string;
}

export interface AuthResponse {
  token: string;
  client: Client;
}

export interface ErrorResponse {
  message: string;
  errors?: Record<string, string>;
}
