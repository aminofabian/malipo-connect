import type { APIRoute } from "astro";
import * as malipo from "../../lib/malipo";

export const prerender = false;

type Row = { status: "prompting" | "settled" | "failed"; createdAt: number };

const g = globalThis as typeof globalThis & { __malipoTests?: Map<string, Row> };

function mapIntentStatus(status: string): "prompting" | "settled" | "failed" {
  if (status === "settled") return "settled";
  if (status === "failed" || status === "expired") return "failed";
  return "prompting";
}

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "missing id" }), { status: 400 });
  }

  if (malipo.malipoConfigured() && !id.startsWith("pay_")) {
    try {
      const intent = await malipo.getIntent(id);
      return new Response(
        JSON.stringify({
          status: mapIntentStatus(intent.status),
          failure_kind: intent.failure_kind,
          failure_message: intent.failure_message,
        }),
        { headers: { "content-type": "application/json" } },
      );
    } catch {
      return new Response(JSON.stringify({ status: "failed" }), { status: 404 });
    }
  }

  const row = g.__malipoTests?.get(id);
  if (!row) {
    return new Response(JSON.stringify({ status: "failed" }), { status: 404 });
  }
  return new Response(JSON.stringify({ status: row.status }), {
    headers: { "content-type": "application/json" },
  });
};
