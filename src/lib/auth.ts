/**
 * Connect session cookie name and claim shape.
 * Auth is owned by Malipo (email + password) — not the Kiosk platform.
 */

export const CONNECT_SESSION = "mc_session";

export type SessionClaims = {
  businessId: string;
  email?: string;
  sub?: string;
  exp?: number;
};
