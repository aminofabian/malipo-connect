import type { APIRoute } from "astro";
import { randomBytes } from "node:crypto";
import * as malipo from "../../lib/malipo";
import type { ApiMode } from "../../lib/malipo";
import { getApiMode, resolveMerchant } from "../../lib/session";

export const prerender = false;

type Row = { status: "prompting" | "settled" | "failed"; createdAt: number };

const g = globalThis as typeof globalThis & { __malipoTests?: Map<string, Row> };
function tests() {
  if (!g.__malipoTests) g.__malipoTests = new Map();
  return g.__malipoTests;
}

function mapIntentStatus(status: string): "prompting" | "settled" | "failed" {
  if (status === "settled") return "settled";
  if (status === "failed" || status === "expired") return "failed";
  return "prompting";
}

const MIN_KES = 1;
const MAX_KES = 500;

// Reserved sandbox numbers — the same contract the service documents. A test
// payment carries no phone; the scenario picks the number.
const SANDBOX_NUMBERS: Record<string, string> = {
  success: "254000000001",
  insufficient_funds: "254000000002",
  wrong_pin: "254000000003",
  customer_timeout: "254000000004",
  subscriber_cancelled: "254000000005",
  delayed: "254000000099", // not in the outcome map → settles ~5s later
};

function parseAmount(raw: unknown): number | null {
  const n =
    typeof raw === "number"
      ? Math.floor(raw)
      : Number.parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n) || n < MIN_KES || n > MAX_KES) return null;
  return n;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = resolveMerchant(cookies);
  if (!session) return json({ error: "Sign in required" }, 401);

  let body: { phone?: string; amount?: unknown; mode?: string; scenario?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const mode: ApiMode = body.mode === "test" ? "test" : getApiMode(cookies);
  const amount = parseAmount(body.amount ?? 10);

  if (amount == null) {
    return json(
      { error: `Amount must be a whole number between KES ${MIN_KES} and ${MAX_KES}` },
      400,
    );
  }

  const tenantId = session.businessId;

  const phone =
    mode === "test"
      ? (SANDBOX_NUMBERS[String(body.scenario ?? "success")] ?? SANDBOX_NUMBERS.success)
      : String(body.phone ?? "").replace(/\s+/g, "");

  if (mode === "live" && !/^254\d{9}$/.test(phone)) {
    return json({ error: "Use a number like 254712345678" }, 400);
  }

  if (malipo.malipoConfigured()) {
    try {
      const intent = await malipo.createTestPayment(tenantId, phone, amount, mode);

      return json(
        {
          id: intent.id,
          status: mapIntentStatus(intent.status),
          mode,
          amount,
          failure_kind: intent.failure_kind ?? null,
          failure_message: intent.failure_message ?? null,
          live: mode === "live",
        },
        201,
      );
    } catch (e) {
      const err = e as Error & { body?: { error?: string; message?: string } };
      const msg =
        err.body?.message || err.body?.error || err.message || "Could not start the test payment";
      const hint =
        err.body?.error === "credentials_missing"
          ? " Configure platform Daraja in Malipo admin first."
          : "";
      return json({ error: msg + hint }, 502);
    }
  }

  // In-memory fallback when the service is not configured.
  const id = `pay_${randomBytes(8).toString("hex")}`;
  tests().set(id, { status: "prompting", createdAt: Date.now() });
  setTimeout(() => {
    const row = tests().get(id);
    if (row && row.status === "prompting") row.status = "settled";
  }, 4000);

  return json({ id, status: "pending", mode, amount, live: false }, 201);
};
