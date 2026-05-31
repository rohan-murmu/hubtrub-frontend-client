import { AxiosError } from 'axios';

// Friendly copy for the Firebase auth error codes users can actually hit.
// Keeps "Firebase: Error (auth/invalid-email)" out of the UI.
const FIREBASE_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/account-exists-with-different-credential':
    'An account already exists with a different sign-in method.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/missing-password': 'Please enter a password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error — check your connection and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups and retry.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled.',
};

function firebaseCode(e: unknown): string | undefined {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && code.startsWith('auth/')) return code;
  }
  return undefined;
}

/** Extract a user-facing message from an unknown thrown value — handles
 *  Firebase auth errors, axios errors (backend `{ error }` / `{ message }`),
 *  and plain Errors. Never surfaces raw "Firebase: Error (auth/…)" strings. */
export function errorMessage(e: unknown, fallback = 'Something went wrong'): string {
  const code = firebaseCode(e);
  if (code) return FIREBASE_MESSAGES[code] ?? fallback;

  if (e && typeof e === 'object' && 'isAxiosError' in e) {
    const ax = e as AxiosError<{ error?: string; message?: string }>;
    const data = ax.response?.data;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
    if (ax.message && !/^Request failed/i.test(ax.message)) return ax.message;
    return fallback;
  }

  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/** HTTP status from an unknown thrown value, or undefined. */
export function errorStatus(e: unknown): number | undefined {
  if (e && typeof e === 'object' && 'isAxiosError' in e) {
    return (e as AxiosError).response?.status;
  }
  return undefined;
}
