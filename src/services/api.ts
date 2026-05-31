import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import type {
  AssetTypeEnum,
  AssetWithUrl,
  AuthType,
  NeedsProfileResponse,
  Room,
  User,
} from '@/types';

// Backend HTTP base. Single source of truth for axios *and* the Godot iframe
// (RoomPage forwards this into SET_CONNECTION_CONFIG → apiBaseUrl). Falls
// back to the local dev port the Go server defaults to.
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string) || 'http://localhost:9000';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // include the hub_session cookie on every request
  headers: { 'Content-Type': 'application/json' },
});

// Bounce to /auth on 401 from a protected route — except for /auth/me itself
// (which is allowed to 401 silently during initial hydration).
api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (
      error.response?.status === 401 &&
      !(error.config?.url ?? '').endsWith('/auth/me')
    ) {
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  },
);

// ---------- Auth ----------
export const authService = {
  /** Exchange a Firebase ID token for the HttpOnly session cookie. */
  startSession: async (idToken: string): Promise<User | NeedsProfileResponse> => {
    const { data } = await api.post<User | NeedsProfileResponse>('/auth/session', { idToken });
    return data;
  },

  completeProfile: async (input: {
    name: string;
    username: string;
    email?: string;
    avatarKey?: string;
    authType: AuthType;
  }): Promise<User> => {
    const { data } = await api.post<User>('/auth/profile', input);
    return data;
  },

  me: async (): Promise<User | NeedsProfileResponse | null> => {
    try {
      const { data, status } = await api.get<User | NeedsProfileResponse>('/auth/me');
      if (status === 202) return data;
      return data;
    } catch (err) {
      const e = err as AxiosError;
      if (e.response?.status === 401) return null;
      throw err;
    }
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  usernameAvailable: async (username: string): Promise<boolean> => {
    const { data } = await api.get<{ available: boolean }>(
      `/user/username/${encodeURIComponent(username)}/available`,
    );
    return data.available;
  },
};

// ---------- Users ----------
export const userService = {
  getById: async (userId: string): Promise<User | null> => {
    try {
      const { data } = await api.get<User>(`/user/${encodeURIComponent(userId)}`);
      return data;
    } catch {
      return null;
    }
  },

  /** Patch the current user. All fields optional; pass only what's changing. */
  updateMe: async (patch: {
    name?: string;
    username?: string;
    avatarKey?: string;
  }): Promise<User> => {
    const { data } = await api.patch<User>(`/user/me`, patch);
    return data;
  },

  /** Permanently delete the current user's account (cascades their hubs). */
  deleteMe: async (): Promise<void> => {
    await api.delete('/user/me');
  },
};

// ---------- Rooms ----------
export const roomService = {
  getRooms: async (): Promise<Room[]> => (await api.get<Room[]>('/room')).data,
  getMyRooms: async (): Promise<Room[]> => (await api.get<Room[]>('/me/room')).data,
  getRoomById: async (roomId: string): Promise<Room> =>
    (await api.get<Room>(`/room/${roomId}`)).data,
  createRoom: async (data: Pick<Room, 'name' | 'sceneKey' | 'description'> & {
    visibility?: Room['visibility'];
  }): Promise<Room> => (await api.post<Room>('/room', data)).data,
  updateRoom: async (
    roomId: string,
    data: Partial<Pick<Room, 'name' | 'sceneKey' | 'description' | 'visibility'>>,
  ): Promise<Room> => (await api.put<Room>(`/room/${roomId}`, data)).data,
  deleteRoom: async (roomId: string): Promise<void> => {
    await api.delete(`/room/${roomId}`);
  },
};

// ---------- Assets ----------
export interface UploadUrlFile {
  uploadUrl: string;
  /** GCS object key — pass to POST /asset in the `urls` array. */
  key: string;
}

export interface UploadUrlResponse {
  assetId: string;
  files: UploadUrlFile[];
  expiresAt: string;
}

/** Backend wire shape: the asset row + parallel signed URL list and likedByMe. */
interface AssetReadResponse extends Omit<AssetWithUrl, 'urls'> {
  urls?: string[];
  readUrl?: string;
}

function normaliseAsset(raw: AssetReadResponse): AssetWithUrl {
  return {
    ...raw,
    data: Array.isArray(raw.data) ? raw.data : [],
    urls: raw.urls ?? [],
    readUrl: raw.readUrl ?? (raw.urls?.[0] ?? ''),
    likedByMe: raw.likedByMe ?? false,
  };
}

export interface CreateAssetInput {
  assetId?: string;
  type: AssetTypeEnum;
  caption: string;
  roomId: string;
  /** GCS object keys returned from /asset/upload-url, OR a single external
   *  http(s) URL for LINK assets. */
  urls: string[];
}

export const assetService = {
  /** Step 1: ask the backend for N signed PUT URLs for the file batch. */
  getUploadUrls: async (input: {
    type: AssetTypeEnum;
    roomId: string;
    files: { contentType: string; filename: string }[];
  }): Promise<UploadUrlResponse> => {
    const { data } = await api.post<UploadUrlResponse>('/asset/upload-url', input);
    return data;
  },

  /** Step 2: PUT each file directly to GCS. */
  putToSignedUrl: async (signedUrl: string, file: File): Promise<void> => {
    await axios.put(signedUrl, file, {
      headers: { 'Content-Type': file.type },
    });
  },

  /** Step 3: record the asset row in our DB. The row starts in DRAFT status. */
  createAsset: async (input: CreateAssetInput): Promise<AssetWithUrl> => {
    const { data } = await api.post<AssetReadResponse>('/asset', input);
    return normaliseAsset(data);
  },

  /** End-to-end helper for IMAGE/VIDEO/AUDIO/DOC. For IMAGE, files may have length > 1. */
  uploadFiles: async (
    files: File[],
    roomId: string,
    type: AssetTypeEnum,
    caption: string,
  ): Promise<AssetWithUrl> => {
    const u = await assetService.getUploadUrls({
      type,
      roomId,
      files: files.map((f) => ({ contentType: f.type, filename: f.name })),
    });
    await Promise.all(
      u.files.map((entry, i) => assetService.putToSignedUrl(entry.uploadUrl, files[i])),
    );
    return assetService.createAsset({
      assetId: u.assetId,
      urls: u.files.map((f) => f.key),
      type,
      caption,
      roomId,
    });
  },

  /** Create a LINK asset — no GCS upload. */
  uploadLink: async (
    url: string,
    roomId: string,
    caption: string,
  ): Promise<AssetWithUrl> =>
    assetService.createAsset({
      urls: [url],
      type: 'LINK',
      caption,
      roomId,
    }),

  updateAsset: async (
    assetId: string,
    patch: { caption?: string },
  ): Promise<AssetWithUrl> => {
    const { data } = await api.put<AssetReadResponse>(`/asset/${assetId}`, patch);
    return normaliseAsset(data);
  },

  placeAsset: async (assetId: string, xpos: number, ypos: number): Promise<AssetWithUrl> => {
    const { data } = await api.post<AssetReadResponse>(`/asset/${assetId}/place`, { xpos, ypos });
    return normaliseAsset(data);
  },

  /** Caller's pending DRAFT assets in this room — used by AssetTab if a refresh
   *  happens mid-placement. */
  getMyDraftsInRoom: async (roomId: string): Promise<AssetWithUrl[]> => {
    const { data } = await api.get<AssetReadResponse[]>(`/room/${roomId}/asset/draft`);
    return data.map(normaliseAsset);
  },

  /** The caller's single active asset in the room (DRAFT or PLACED), or null. */
  getMyAssetInRoom: async (roomId: string): Promise<AssetWithUrl | null> => {
    const { data } = await api.get<AssetReadResponse | null>(`/room/${roomId}/asset/mine`);
    return data ? normaliseAsset(data) : null;
  },

  getAssetById: async (assetId: string): Promise<AssetWithUrl> => {
    const { data } = await api.get<AssetReadResponse>(`/asset/${assetId}`);
    return normaliseAsset(data);
  },

  getAssetsByRoom: async (roomId: string): Promise<AssetWithUrl[]> => {
    const { data } = await api.get<AssetReadResponse[]>(`/room/${roomId}/asset`);
    return data.map(normaliseAsset);
  },

  deleteAsset: async (assetId: string): Promise<void> => {
    await api.delete(`/asset/${assetId}`);
  },

  recordView: async (assetId: string): Promise<{ viewsCount: number }> => {
    const { data } = await api.post<{ viewsCount: number }>(`/asset/${assetId}/view`);
    return data;
  },

  toggleLike: async (assetId: string): Promise<{ liked: boolean; likesCount: number }> => {
    const { data } = await api.post<{ liked: boolean; likesCount: number }>(`/asset/${assetId}/like`);
    return data;
  },
};

// ---------- Conversations ----------
//
// Public chat is NOT persisted. These endpoints only cover PRIVATE
// conversation history (live messages still flow through the WebSocket).

export interface Conversation {
  convId: string;
  type: 'PRIVATE';
  roomId: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  messageId: string;
  convId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export const conversationService = {
  /** Fetch (or create-and-fetch) the PRIVATE conversation between the caller
   *  and `otherUserId` in this room. The conversation row is required before
   *  loading messages; the backend creates it idempotently. */
  getOrCreatePrivate: async (roomId: string, otherUserId: string): Promise<Conversation> => {
    const { data } = await api.get<Conversation>(`/room/${roomId}/conversation/private/${otherUserId}`);
    return data;
  },

  listMyPrivate: async (roomId: string): Promise<Conversation[]> => {
    const { data } = await api.get<Conversation[]>(`/room/${roomId}/conversation/private`);
    return data;
  },

  /** Returns most-recent messages in ascending order (oldest → newest). When
   *  `before` is supplied (ISO timestamp from a previously-loaded message),
   *  returns the page of messages strictly older than that — used for
   *  scroll-up pagination. */
  getMessages: async (
    convId: string,
    limit = 100,
    before?: string,
  ): Promise<ConversationMessage[]> => {
    const params: Record<string, string | number> = { limit };
    if (before) params.before = before;
    const { data } = await api.get<ConversationMessage[]>(`/conversation/${convId}/messages`, {
      params,
    });
    return data;
  },
};

// ---------- Reviews ----------
//
// Free-text product feedback collected by the in-app review popup. The popup
// only ever fires once per account; `status` backs that gate so a user who has
// already submitted is never re-prompted (even on a fresh device).
export const reviewService = {
  /** Whether the caller has already left a review. */
  status: async (): Promise<{ reviewed: boolean }> => {
    const { data } = await api.get<{ reviewed: boolean }>('/review/me/status');
    return data;
  },

  /** Submit (or update) the caller's free-text review. */
  submit: async (review: string): Promise<void> => {
    await api.post('/review', { review });
  },
};

export default api;
