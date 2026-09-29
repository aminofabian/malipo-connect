/**
 * Malipo service client for Connect (server-only).
 * When MALIPO_SERVICE_URL is unset, callers should use the in-memory store.
 */

const base = () => process.env.MALIPO_SERVICE_URL?.replace(/\/$/, "") ?? "";
const token = () => process.env.MALIPO_SERVICE_TOKEN ?? "";

export function malipoConfigured(): boolean {
  return Boolean(base());
}

export function publicApiBase(): string {
  return (
    process.env.MALIPO_PUBLIC_API_URL?.replace(/\/$/, "") ||
    base() ||
    "https://api.kiosk.ke"
  );
}

async function malipoFetch(path: string, init: RequestInit = {}) {
  const url = `${base()}${path}`;
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const t = token();
  if (t) headers.set("authorization", `Bearer ${t}`);

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(body?.message || body?.error || `Malipo ${res.status}`);
    (err as Error & { status?: number; body?: unknown }).status = res.status;
    (err as Error & { body?: unknown }).body = body;
    throw err;
  }
  return body;
}

export type DestinationPayload =
  | { kind: "till"; till_number: string; display_name?: string }
  | {
      kind: "paybill";
      paybill_number: string;
      account_number: string;
      display_name?: string;
    }
  | {
      kind: "bank";
      paybill_number: string;
      account_number: string;
      bank_id?: string;
      display_name?: string;
    };

export async function putDestination(businessId: string, dest: DestinationPayload) {
  return malipoFetch(`/internal/v1/merchants/${encodeURIComponent(businessId)}/destination`, {
    method: "PUT",
    body: JSON.stringify(dest),
  });
}

export async function confirmDestination(businessId: string) {
  return malipoFetch(`/internal/v1/merchants/${encodeURIComponent(businessId)}/confirm`, {
    method: "POST",
    body: "{}",
  });
}

export async function provisionKeys(businessId: string): Promise<{
  client_id: string;
  client_secret: string;
  webhook_secret: string;
}> {
  return malipoFetch(`/internal/v1/merchants/${encodeURIComponent(businessId)}/keys`, {
    method: "POST",
    body: "{}",
  });
}

export async function setWebhookUrl(businessId: string, url: string) {
  return malipoFetch(`/internal/v1/merchants/${encodeURIComponent(businessId)}/webhook`, {
    method: "PUT",
    body: JSON.stringify({ url }),
  });
}

export async function createTestPayment(businessId: string, phone: string) {
  const idempotency = `connect-test:${businessId}:${Date.now()}`;
  return malipoFetch(`/internal/v1/intents`, {
    method: "POST",
    body: JSON.stringify({
      business_id: businessId,
      amount: "1.00",
      currency: "KES",
      payer_msisdn: phone,
      idempotency_key: idempotency,
      context: { type: "CONNECT_TEST", reference: "KES-1" },
    }),
  });
}

export async function getIntent(id: string) {
  return malipoFetch(`/internal/v1/intents/${encodeURIComponent(id)}`);
}

export async function getMerchant(businessId: string) {
  return malipoFetch(`/internal/v1/merchants/${encodeURIComponent(businessId)}`);
}

export async function listPayments(businessId: string, limit = 5) {
  return malipoFetch(
    `/internal/v1/merchants/${encodeURIComponent(businessId)}/payments?limit=${limit}`,
  );
}

export type ConnectAccount = {
  id: string;
  email: string;
  business_id: string;
  display_name: string | null;
};

export async function registerAccount(input: {
  email: string;
  password: string;
  display_name?: string;
}): Promise<ConnectAccount> {
  return malipoFetch(`/internal/v1/connect/register`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<ConnectAccount> {
  return malipoFetch(`/internal/v1/connect/login`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
