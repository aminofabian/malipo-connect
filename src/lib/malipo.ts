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

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw Object.assign(new Error("Malipo service is unreachable. Is MALIPO_SERVICE_URL correct?"), {
      status: 0,
    });
  }

  const text = await res.text();
  let body: { message?: string; error?: string; details?: unknown } | null = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw Object.assign(
        new Error(
          res.ok
            ? "Malipo returned a non-JSON response."
            : `Malipo service error (${res.status}). The API at MALIPO_SERVICE_URL is not reachable.`,
        ),
        { status: res.status, body: text.slice(0, 200) },
      );
    }
  }
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

export type SavedDestination = {
  id: string;
  kind: string;
  till_number?: string | null;
  paybill_number?: string | null;
  account_number?: string | null;
  bank_id?: string | null;
  display_name?: string | null;
  verified: boolean;
  activated: boolean;
  active: boolean;
  in_use: boolean;
  inserted_at?: string | null;
};

export async function createDestination(businessId: string, dest: DestinationPayload) {
  return malipoFetch(
    `/internal/v1/merchants/${encodeURIComponent(businessId)}/destinations`,
    {
      method: "POST",
      body: JSON.stringify(dest),
    },
  ) as Promise<SavedDestination>;
}

export async function putDestination(businessId: string, dest: DestinationPayload) {
  return createDestination(businessId, dest);
}

export async function listDestinations(businessId: string): Promise<{
  destinations: SavedDestination[];
  active_destination_id: string | null;
}> {
  return malipoFetch(`/internal/v1/merchants/${encodeURIComponent(businessId)}/destinations`);
}

export async function getDestination(businessId: string, destinationId: string) {
  return malipoFetch(
    `/internal/v1/merchants/${encodeURIComponent(businessId)}/destinations/${encodeURIComponent(destinationId)}`,
  ) as Promise<SavedDestination>;
}

export async function confirmDestination(businessId: string, destinationId?: string) {
  const path = destinationId
    ? `/internal/v1/merchants/${encodeURIComponent(businessId)}/destinations/${encodeURIComponent(destinationId)}/confirm`
    : `/internal/v1/merchants/${encodeURIComponent(businessId)}/confirm`;

  return malipoFetch(path, {
    method: "POST",
    body: "{}",
  }) as Promise<SavedDestination>;
}

export async function activateDestination(businessId: string, destinationId: string) {
  return malipoFetch(
    `/internal/v1/merchants/${encodeURIComponent(businessId)}/destinations/${encodeURIComponent(destinationId)}/activate`,
    { method: "POST", body: "{}" },
  ) as Promise<SavedDestination>;
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

export async function createTestPayment(
  businessId: string,
  phone: string,
  amountKes: number,
) {
  const whole = Math.floor(amountKes);
  const amount = `${whole}.00`;
  const idempotency = `connect-test:${businessId}:${Date.now()}`;
  return malipoFetch(`/internal/v1/intents`, {
    method: "POST",
    body: JSON.stringify({
      business_id: businessId,
      amount,
      currency: "KES",
      payer_msisdn: phone,
      idempotency_key: idempotency,
      context: { type: "CONNECT_TEST", reference: `KES-${whole}` },
    }),
  });
}

export async function getIntent(id: string) {
  return malipoFetch(`/internal/v1/intents/${encodeURIComponent(id)}`);
}

export async function getMerchant(businessId: string) {
  return malipoFetch(`/internal/v1/merchants/${encodeURIComponent(businessId)}`);
}

export type MerchantSummary = {
  business_id: string;
  received_count: number;
  received_total: string;
  by_destination: {
    destination_id: string | null;
    count: number;
    total: string;
  }[];
};

export async function getSummary(businessId: string): Promise<MerchantSummary> {
  return malipoFetch(
    `/internal/v1/merchants/${encodeURIComponent(businessId)}/summary`,
  ) as Promise<MerchantSummary>;
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
