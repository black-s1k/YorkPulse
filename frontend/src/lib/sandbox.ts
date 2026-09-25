// Sandbox accounts log in with a password but see none of YorkPulse.
// Keep in sync with SANDBOX_EMAILS on the backend (app/core/config.py).
export const SANDBOX_EMAILS = ["aiignite.yorku@gmail.com"];

export function isSandboxEmail(email: string | null | undefined): boolean {
  return !!email && SANDBOX_EMAILS.includes(email.toLowerCase());
}

// Read the email claim straight from the JWT so the check works before
// /auth/me has loaded (no flash of the normal app).
export function isSandboxToken(token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return isSandboxEmail(payload.email);
  } catch {
    return false;
  }
}
