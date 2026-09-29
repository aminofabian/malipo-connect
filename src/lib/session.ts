import { createHmac, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";
import { CONNECT_SESSION, type SessionClaims } from "./auth";
import type { DraftDestination } from "./destination";
import type { RevealedSecrets } from "./store";

const DRAFT = "mc_draft";
const ONCE = "mc_once";

const cookieOpts = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: import.meta.env.PROD,
  maxAge: 60 * 60 * 24 * 14,
};

function sessionSecret(): string {
  return process.env.CONNECT_SESSION_SECRET || "connect-dev-session-secret";
}

function signPayload(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function encodeConnectSession(claims: SessionClaims): string {
  const payload = Buffer.from(
    JSON.stringify({
      businessId: claims.businessId,
      email: claims.email,
      sub: claims.sub,
      exp: claims.exp,
    }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function decodeConnectSession(raw: string | undefined): SessionClaims | null {
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = signPayload(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
    if (!json.businessId) return null;
    if (typeof json.exp === "number" && json.exp * 1000 < Date.now()) return null;
    return json;
  } catch {
    return null;
  }
}

export function setConnectSession(cookies: AstroCookies, claims: SessionClaims): void {
  cookies.set(CONNECT_SESSION, encodeConnectSession(claims), cookieOpts);
}

export function clearConnectSession(cookies: AstroCookies): void {
  cookies.delete(CONNECT_SESSION, { path: "/" });
}

export type MerchantSession = SessionClaims & { mode: "connect" };

/** Resolve merchant from Connect's own signed session cookie. */
export function resolveMerchant(cookies: AstroCookies): MerchantSession | null {
  const existing = decodeConnectSession(cookies.get(CONNECT_SESSION)?.value);
  if (!existing) return null;
  return { ...existing, mode: "connect" };
}

/** Page guard — redirect to /signin when unauthenticated. */
export function requireMerchant(
  cookies: AstroCookies,
  request: Request,
): MerchantSession | Response {
  const merchant = resolveMerchant(cookies);
  if (merchant) return merchant;

  const url = publicRequestUrl(request);
  const next = url.pathname + url.search;
  return Response.redirect(
    new URL(`/signin?next=${encodeURIComponent(next)}`, url),
    302,
  );
}

/** Prefer client scheme/host when behind Cloudflare / Traefik (Flexible SSL). */
function publicRequestUrl(request: Request): URL {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto === "http" || proto === "https") url.protocol = `${proto}:`;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (host) url.host = host;
  return url;
}

export function setDraft(cookies: AstroCookies, draft: DraftDestination): void {
  cookies.set(DRAFT, JSON.stringify(draft), cookieOpts);
}

export function getDraft(cookies: AstroCookies): DraftDestination | null {
  const raw = cookies.get(DRAFT)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DraftDestination;
  } catch {
    return null;
  }
}

export function clearDraft(cookies: AstroCookies): void {
  cookies.delete(DRAFT, { path: "/" });
}

export function setOnceSecrets(cookies: AstroCookies, secrets: RevealedSecrets): void {
  cookies.set(ONCE, JSON.stringify(secrets), { ...cookieOpts, maxAge: 60 * 10 });
}

export function takeOnceSecrets(cookies: AstroCookies): RevealedSecrets | null {
  const raw = cookies.get(ONCE)?.value;
  if (!raw) return null;
  cookies.delete(ONCE, { path: "/" });
  try {
    return JSON.parse(raw) as RevealedSecrets;
  } catch {
    return null;
  }
}
