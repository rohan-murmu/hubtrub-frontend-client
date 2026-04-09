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

// Group chat types
export interface GroupInfo {
  groupId: string;
  groupName: string;
  members: string[];
  creatorId?: string;
  x: number;
  y: number;
}

export interface GroupMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
}
