import type { APIRoute } from "astro";
import * as malipo from "../../../lib/malipo";
import { getApiMode, resolveMerchant } from "../../../lib/session";

export const prerender = false;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * POST /api/keys/reveal — return the active key's secrets after the merchant
 * re-enters their account password. The password is verified by the Malipo
 * service (which also rate-limits); we only relay. Never cached, never logged.
 */
export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const session = resolveMerchant(cookies);
  if (!session) return json({ error: "unauthorized", message: "Sign in required" }, 401);

  let body: { password?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid", message: "Invalid request" }, 400);
  }

  const password = String(body.password ?? "");
  if (!password) {
    return json({ error: "password_required", message: "Enter your account password" }, 400);
  }

  const mode = body.mode === "test" ? "test" : getApiMode(cookies);

  if (!malipo.malipoConfigured()) {
    return json({ error: "not_configured", message: "The payments service is not reachable." }, 502);
  }

  try {
    const secrets = await malipo.revealKeys(session.businessId, password, mode, clientAddress);

    return json(
      {
        client_id: secrets.client_id,
        client_secret: secrets.client_secret,
        webhook_secret: secrets.webhook_secret,
        mode,
      },
      200,
    );
  } catch (e) {
    const err = e as Error & { status?: number; body?: { error?: string; message?: string } };
    const status = err.status && err.status >= 400 ? err.status : 502;

    return json(
      {
        error: err.body?.error ?? "reveal_failed",
        message: err.body?.message ?? err.message ?? "Could not reveal keys",
      },
      status,
    );
  }
};
