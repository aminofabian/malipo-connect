import { createHash, randomBytes } from "node:crypto";
import type { DraftDestination } from "./destination";
import * as malipo from "./malipo";

export type MerchantRecord = {
  tenantId: string;
  destination: DraftDestination | null;
  destinationId: string | null;
  verified: boolean;
  clientId: string | null;
  clientSecretHash: string | null;
  webhookSecretHash: string | null;
  webhookUrl: string | null;
  activated: boolean;
};

export type RevealedSecrets = {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
};

const g = globalThis as typeof globalThis & {
  __malipoConnectStore?: Map<string, MerchantRecord>;
};

function mem(): Map<string, MerchantRecord> {
  if (!g.__malipoConnectStore) g.__malipoConnectStore = new Map();
  return g.__malipoConnectStore;
}

function empty(tenantId: string): MerchantRecord {
  return {
    tenantId,
    destination: null,
    destinationId: null,
    verified: false,
    clientId: null,
    clientSecretHash: null,
    webhookSecretHash: null,
    webhookUrl: null,
    activated: false,
  };
}

export function getMerchant(tenantId: string): MerchantRecord {
  const s = mem();
  let row = s.get(tenantId);
  if (!row) {
    row = empty(tenantId);
    s.set(tenantId, row);
  }
  return row;
}

function toPayload(d: DraftDestination): malipo.DestinationPayload {
  if (d.kind === "till") {
    return {
      kind: "till",
      till_number: d.till,
      display_name: d.displayName ?? undefined,
    };
  }
  if (d.kind === "paybill") {
    return {
      kind: "paybill",
      paybill_number: d.paybill,
      account_number: d.account,
      display_name: d.displayName ?? undefined,
    };
  }
  return {
    kind: "bank",
    paybill_number: d.paybill,
    account_number: d.account,
    bank_id: d.bankId,
    display_name: d.displayName ?? undefined,
  };
}

export async function saveDraft(
  tenantId: string,
  destination: DraftDestination,
): Promise<{ row: MerchantRecord; destinationId: string | null }> {
  const row = getMerchant(tenantId);
  row.destination = destination;
  row.verified = false;
  row.activated = false;

  let destinationId: string | null = null;

  if (malipo.malipoConfigured()) {
    const saved = await malipo.createDestination(tenantId, toPayload(destination));
    destinationId = saved.id;
  }

  return { row, destinationId };
}

export async function confirmDestination(
  tenantId: string,
  destinationId?: string,
): Promise<MerchantRecord> {
  const row = getMerchant(tenantId);
  if (!row.destination && !destinationId) throw new Error("No destination to confirm");
  row.verified = true;
  row.activated = true;

  if (malipo.malipoConfigured()) {
    await malipo.confirmDestination(tenantId, destinationId);
  }

  return row;
}

export async function activateSavedDestination(
  tenantId: string,
  destinationId: string,
): Promise<void> {
  if (malipo.malipoConfigured()) {
    await malipo.activateDestination(tenantId, destinationId);
  }

  const row = getMerchant(tenantId);
  row.activated = true;
}

function hash(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function token(prefix: string, bytes = 18): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`;
}

export async function provisionKeys(tenantId: string): Promise<RevealedSecrets> {
  const row = getMerchant(tenantId);
  if (!row.destination || !row.verified) {
    throw new Error("Confirm a destination before issuing keys");
  }

  if (malipo.malipoConfigured()) {
    const revealed = await malipo.provisionKeys(tenantId);
    row.clientId = revealed.client_id;
    row.clientSecretHash = hash(revealed.client_secret);
    row.webhookSecretHash = hash(revealed.webhook_secret);
    return {
      clientId: revealed.client_id,
      clientSecret: revealed.client_secret,
      webhookSecret: revealed.webhook_secret,
    };
  }

  const clientId = row.clientId ?? token("pk_live_");
  const clientSecret = token("sk_live_");
  const webhookSecret = token("whsec_");
  row.clientId = clientId;
  row.clientSecretHash = hash(clientSecret);
  row.webhookSecretHash = hash(webhookSecret);
  return { clientId, clientSecret, webhookSecret };
}

export function publicApiBase(): string {
  return malipo.publicApiBase();
}

/** Hydrate local cache from Malipo when configured (keys page / landing). */
export async function syncFromService(tenantId: string): Promise<MerchantRecord> {
  const row = getMerchant(tenantId);
  if (!malipo.malipoConfigured()) return row;

  try {
    const remote = await malipo.getMerchant(tenantId);
    if (remote?.client_id) row.clientId = remote.client_id;
    if (remote?.webhook_url !== undefined) row.webhookUrl = remote.webhook_url ?? null;
    if (remote?.destination) {
      const d = remote.destination as malipo.SavedDestination & {
        till_number?: string;
        paybill_number?: string;
        account_number?: string;
        bank_id?: string;
        display_name?: string;
      };
      row.verified = Boolean(d.verified);
      row.activated = Boolean(d.active ?? d.activated);
      if (typeof d.id === "string") row.destinationId = d.id;
      if (d.kind === "till") {
        row.destination = {
          kind: "till",
          till: d.till_number,
          displayName: d.display_name,
        };
      } else if (d.kind === "paybill") {
        row.destination = {
          kind: "paybill",
          paybill: d.paybill_number,
          account: d.account_number,
          displayName: d.display_name,
        };
      } else if (d.kind === "bank") {
        row.destination = {
          kind: "bank",
          bankId: d.bank_id || "custom",
          bankName: d.display_name?.split(" · ")[0] || "Bank",
          paybill: d.paybill_number,
          account: d.account_number,
          displayName: d.display_name,
        };
      }
    }
  } catch {
    /* offline / not provisioned yet */
  }

  return row;
}

export async function setWebhookUrl(tenantId: string, url: string): Promise<string | null> {
  if (malipo.malipoConfigured()) {
    const res = await malipo.setWebhookUrl(tenantId, url);
    const row = getMerchant(tenantId);
    row.webhookUrl = res.webhook_url ?? url;
    return row.webhookUrl;
  }

  const row = getMerchant(tenantId);
  row.webhookUrl = url.trim() || null;
  return row.webhookUrl;
}

export type PaymentSummary = {
  id: string;
  status: string;
  amount: string;
  currency: string;
  reference?: string | null;
  destination_id?: string | null;
  failure_kind?: string | null;
  inserted_at?: string | null;
};

export async function listRecentPayments(
  tenantId: string,
  limit = 5,
): Promise<PaymentSummary[]> {
  if (!malipo.malipoConfigured()) return [];
  try {
    const res = await malipo.listPayments(tenantId, limit);
    return (res.payments ?? []) as PaymentSummary[];
  } catch {
    return [];
  }
}

/**
 * Settled totals for the business, and per destination when we know the
 * destination each payment was created against. Returns null when the service
 * is unreachable or does not yet expose the summary.
 */
export async function getSummary(tenantId: string): Promise<malipo.MerchantSummary | null> {
  if (!malipo.malipoConfigured()) return null;
  try {
    return await malipo.getSummary(tenantId);
  } catch {
    return null;
  }
}
