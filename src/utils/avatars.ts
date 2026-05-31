// Avatar catalogue. The `key` is what's stored on the user row and shipped
// to the Godot client (see scene_registry.gd → PLAYER_AVATARS). Each entry
// also carries a preview image (served from /public/avatar_preview) that's
// used as the user's profile picture everywhere in the React app.
export interface AvatarOption {
  key: string;
  name: string;
  /** Public path of the preview/profile image. */
  image: string;
  description: {
    age: string;
    about: string;
  };
}

export const AVATARS: AvatarOption[] = [
  {
    key: 'hubit',
    name: 'Hubit',
    image: '/avatar_preview/hubit.png',
    description: {
      age: '1',
      about: 'The first explorer',
    },
  },
];

export function findAvatar(key: string | undefined | null): AvatarOption | undefined {
  if (!key) return undefined;
  return AVATARS.find((a) => a.key === key);
}

/** Resolve the profile image for a user's avatar key. Returns `null` when the
 *  key is unknown so the caller can fall back to initials. */
export function avatarImageFor(key: string | undefined | null): string | null {
  return findAvatar(key)?.image ?? null;
}
