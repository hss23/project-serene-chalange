// Friendly messages for Firebase Auth error codes.
const MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account with this email already exists. Try signing in instead.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/missing-email": "Enter your email address.",
  "auth/weak-password": "Please choose a stronger password (at least 6 characters).",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/popup-closed-by-user": "The Google sign-in window was closed before finishing.",
  "auth/cancelled-popup-request": "The Google sign-in window was closed before finishing.",
  "auth/account-exists-with-different-credential":
    "This email is already registered with a password. Sign in with email and password instead.",
  "auth/unauthorized-domain": "This domain isn't authorised for sign-in. Add it in Firebase Auth settings.",
  "auth/operation-not-allowed": "This sign-in method isn't enabled for the project.",
};

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  return (code && MESSAGES[code]) || "Something went wrong signing you in. Please try again.";
}
