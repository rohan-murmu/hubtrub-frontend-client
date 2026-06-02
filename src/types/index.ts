export type AuthType = 'EMAIL' | 'GOOGLE' | 'GUEST';
export type AssetTypeEnum = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOC' | 'LINK';

export type RoomVisibility = 'PRIVATE' | 'PUBLIC';
export type AssetStatus = 'DRAFT' | 'PLACED' | 'EXPIRED';

export interface User {
  userId: string;
  name: string;
  username: string;
  email?: string;
  avatarKey?: string;
  authType: AuthType;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Room {
  roomId?: string;
  name: string;
  sceneKey: string;
  description: string;
  visibility?: RoomVisibility;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Creator details — populated only on read responses (list / get-by-id). */
  creatorUsername?: string;
  creatorAvatarKey?: string;
  /** Live count of users currently in the hub (read responses only). */
  activeMembers?: number;
  /** Max distinct users the hub allows (read responses only). */
  capacity?: number;
  /** True when activeMembers has reached capacity (read responses only). */
  isFull?: boolean;
}

export interface ErrorResponse {
  message: string;
  errors?: Record<string, string>;
}

// One ordered entry on an asset. `url` is the GCS object key for media
// assets, or the external destination for LINK. The field is empty after a
// privacy purge (the row is kept for analytics).
export interface AssetData {
  assetDataId: string;
  ordIdx: number;
  url: string;
}

export interface Asset {
  assetId: string;
  type: AssetTypeEnum;
  caption: string;
  status: AssetStatus;
  xpos: number;
  ypos: number;
  userId: string;
  roomId: string;
  viewsCount: number;
  likesCount: number;
  data: AssetData[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AssetWithUrl extends Asset {
  /** Resolved URLs parallel to `data`. Signed GCS URLs for media; external
   *  HTTP(s) destinations for LINK. */
  urls?: string[];
  /** Legacy convenience: equal to urls[0] when present. */
  readUrl?: string;
  /** Whether the current user has liked this asset. */
  likedByMe?: boolean;
}

export interface NeedsProfileResponse {
  needsProfile: true;
  firebaseUid: string;
  email?: string;
}
