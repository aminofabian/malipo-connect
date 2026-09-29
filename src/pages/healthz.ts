import type { APIRoute } from "astro";

export const prerender = false;

/**
 * Deploy probe for Malipo Connect.
 *
 *   GET /healthz        readiness — 200 only when the Malipo service answers
 *                       `/ready`; 503 when it is down, misconfigured, or
 *                       returning a non-2xx (e.g. a pending migration).
 *   GET /healthz?live=1 liveness  — 200 whenever the Connect process answers.
 *
 * No auth: probes must be reachable by the platform. The body never contains
 * secrets — only status and the upstream's own `/ready` summary.
 */

const TIMEOUT_MS = 2500;

function serviceUrl(): string {
  return process.env.MALIPO_SERVICE_URL?.replace(/\/$/, "") ?? "";
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export const GET: APIRoute = async ({ url }) => {
  const checkedAt = new Date().toISOString();

  if (url.searchParams.get("live") === "1") {
    return json({ status: "up", service: "malipo-connect", checked_at: checkedAt }, 200);
  }

  const base = serviceUrl();

  if (!base) {
    return json(
      {
        status: "not_ready",
        service: "malipo-connect",
        malipo: { configured: false, detail: "MALIPO_SERVICE_URL is not set" },
        checked_at: checkedAt,
      },
      503,
    );
  }

  const started = Date.now();

  try {
    const res = await fetch(`${base}/ready`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    return json(
      {
        status: res.ok ? "ready" : "not_ready",
        service: "malipo-connect",
        malipo: {
          configured: true,
          ok: res.ok,
          status: res.status,
          latency_ms: Date.now() - started,
          detail: await readJson(res),
        },
        checked_at: checkedAt,
      },
      res.ok ? 200 : 503,
    );
  } catch (e) {
    return json(
      {
        status: "not_ready",
        service: "malipo-connect",
        malipo: {
          configured: true,
          ok: false,
          latency_ms: Date.now() - started,
          error: e instanceof Error ? e.message : "unreachable",
        },
        checked_at: checkedAt,
      },
      503,
    );
  }
};
