import { createContext, useContext, type ReactNode } from "react";
import type { User } from "@/types";

// UserContext exposes the currently authenticated user (from /auth/me) to any
// component inside a ProtectedRoute. The provider is mounted by
// ProtectedRoute once a complete profile is confirmed, so consumers can rely
// on the user being non-null.

const UserContext = createContext<User | null>(null);

export function UserProvider({ user, children }: { user: User; children: ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

/** Returns the current user. May be null when used outside an authenticated tree. */
export function useCurrentUser(): User | null {
  return useContext(UserContext);
}
