import type { APIRoute } from "astro";
import { randomBytes } from "node:crypto";
import * as malipo from "../../lib/malipo";
import { resolveMerchant } from "../../lib/session";

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

function parseAmount(raw: unknown): number | null {
  const n =
    typeof raw === "number"
      ? Math.floor(raw)
      : Number.parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n) || n < MIN_KES || n > MAX_KES) return null;
  return n;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = resolveMerchant(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: "Sign in required" }), { status: 401 });
  }

  let body: { phone?: string; amount?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const phone = String(body.phone ?? "").replace(/\s+/g, "");
  if (!/^254\d{9}$/.test(phone)) {
    return new Response(JSON.stringify({ error: "Use a number like 254712345678" }), {
      status: 400,
    });
  }

  const amount = parseAmount(body.amount ?? 10);
  if (amount == null) {
    return new Response(
      JSON.stringify({
        error: `Amount must be a whole number between KES ${MIN_KES} and ${MAX_KES}`,
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const tenantId = session.businessId;

  if (malipo.malipoConfigured()) {
    try {
      const intent = await malipo.createTestPayment(tenantId, phone, amount);
      return new Response(
        JSON.stringify({
          id: intent.id,
          status: mapIntentStatus(intent.status),
          amount,
          live: true,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    } catch (e) {
      const err = e as Error & { body?: { error?: string; message?: string } };
      const msg =
        err.body?.message ||
        err.body?.error ||
        err.message ||
        "Could not start the test payment";
      const hint =
        err.body?.error === "credentials_missing"
          ? " Configure platform Daraja in Malipo admin first."
          : "";
      return new Response(JSON.stringify({ error: msg + hint }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const id = `pay_${randomBytes(8).toString("hex")}`;
  tests().set(id, { status: "prompting", createdAt: Date.now() });
  setTimeout(() => {
    const row = tests().get(id);
    if (row && row.status === "prompting") row.status = "settled";
  }, 4000);

  return new Response(
    JSON.stringify({ id, status: "pending", amount, live: false }),
    {
      status: 201,
      headers: { "content-type": "application/json" },
    },
  );
};
