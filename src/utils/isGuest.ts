import type { User } from '@/types';

// isGuest reports whether the supplied user is an auto-provisioned guest
// account (anonymous Firebase session). Returns false for nulls so callers
// can treat the unauthenticated case as "not a guest" — write-gating already
// rejects the unauthenticated path.
export function isGuest(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.authType === 'GUEST';
}
