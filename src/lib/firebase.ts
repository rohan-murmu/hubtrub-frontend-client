import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  signOut,
  type Auth,
  type User as FirebaseUser,
  type UserCredential,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password);
}

/** Sign in anonymously. The backend recognizes the anonymous Firebase
 *  provider in /auth/session and auto-provisions a throwaway "guest" user
 *  row (username 'guest_<rand>', fixed avatar, authType GUEST). Returns the
 *  Firebase UserCredential just like the other providers. */
export async function signInAsGuest(): Promise<UserCredential> {
  return signInAnonymously(auth);
}

export async function firebaseSignOut(): Promise<void> {
  return signOut(auth);
}

/** Resolve the restored Firebase user. auth.currentUser is null synchronously
 *  right after init until persistence finishes loading — awaiting
 *  authStateReady() avoids "no signed-in user" races on freshly-loaded pages. */
async function currentUserReady(): Promise<FirebaseUser | null> {
  await auth.authStateReady();
  return auth.currentUser;
}

// Continue URL appended to action emails so Firebase has a valid post-action
// target. The link itself lands on our custom page via the Console Action URL.
const continueSettings = () => ({ url: `${window.location.origin}/auth` });

/** Send a verification email to the currently signed-in user. */
export async function sendVerificationEmail(): Promise<void> {
  const user = await currentUserReady();
  if (!user) throw new Error('Please sign in again to verify your email.');
  return sendEmailVerification(user, continueSettings());
}

/** Reload the Firebase user and return a fresh ID token so the backend can
 *  re-read the email_verified claim. Returns null if not signed in. */
export async function refreshIdToken(): Promise<string | null> {
  const user = await currentUserReady();
  if (!user) return null;
  await user.reload();
  return user.getIdToken(true);
}

/** Send a password-reset email. Safe to call without being signed in. */
export async function sendPasswordReset(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email, continueSettings());
}

// ── Action-code handlers (used by our custom /auth/action page) ──────────────
// These operate purely on the oobCode from the email link, so they work even
// when no user is signed in (e.g. clicking the link in a fresh browser).

/** Validate a password-reset oobCode; resolves with the account email. */
export async function verifyResetCode(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, oobCode);
}

/** Complete a password reset with a new password. */
export async function confirmReset(oobCode: string, newPassword: string): Promise<void> {
  return confirmPasswordReset(auth, oobCode, newPassword);
}

/** Apply an email-verification oobCode. */
export async function applyVerifyCode(oobCode: string): Promise<void> {
  return applyActionCode(auth, oobCode);
}

/** Change the signed-in email user's password. Reauthenticates first because
 *  updatePassword requires a recent login. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await currentUserReady();
  if (!user || !user.email) {
    throw new Error('Please sign in again to change your password.');
  }
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPassword);
}

export type { FirebaseUser };
