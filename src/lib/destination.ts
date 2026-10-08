import { z } from "zod";
import { CUSTOM_BANK_ID, kenyaBankById } from "./kenya-mpesa-banks";

export type DestinationKind = "till" | "paybill" | "bank";

export type DraftDestination =
  | { kind: "till"; till: string; displayName: string | null }
  | { kind: "paybill"; paybill: string; account: string; displayName: string | null }
  | {
      kind: "bank";
      bankId: string;
      bankName: string;
      paybill: string;
      account: string;
      displayName: string | null;
    };

const tillSchema = z
  .string()
  .trim()
  .regex(/^\d{5,7}$/, "Enter a till number with 5 to 7 digits.");

const paybillSchema = z
  .string()
  .trim()
  .regex(/^\d{5,7}$/, "Enter a paybill number with 5 to 7 digits.");

const accountSchema = z
  .string()
  .trim()
  .min(1, "Enter your bank account number.")
  .max(32, "That account number looks too long.");

export function parseDestination(form: FormData):
  | { ok: true; value: DraftDestination }
  | { ok: false; error: string } {
  const kind = String(form.get("kind") ?? "");

  if (kind === "till") {
    const till = tillSchema.safeParse(form.get("till"));
    if (!till.success) return { ok: false, error: till.error.issues[0]?.message ?? "Invalid till." };
    return {
      ok: true,
      value: {
        kind: "till",
        till: till.data,
        displayName: guessName(till.data),
      },
    };
  }

  if (kind === "paybill") {
    const paybill = paybillSchema.safeParse(form.get("paybill"));
    const account = accountSchema.safeParse(form.get("account"));
    if (!paybill.success) {
      return { ok: false, error: paybill.error.issues[0]?.message ?? "Invalid paybill." };
    }
    if (!account.success) {
      return { ok: false, error: account.error.issues[0]?.message ?? "Invalid account." };
    }
    return {
      ok: true,
      value: {
        kind: "paybill",
        paybill: paybill.data,
        account: account.data,
        displayName: guessName(paybill.data),
      },
    };
  }

  if (kind === "bank") {
    return parseBank(form);
  }

  return { ok: false, error: "Pick till, paybill, or bank." };
}

function parseBank(form: FormData):
  | { ok: true; value: DraftDestination }
  | { ok: false; error: string } {
  const bankId = String(form.get("bank_id") ?? "").trim();
  const account = accountSchema.safeParse(form.get("bank_account"));
  if (!account.success) {
    return { ok: false, error: account.error.issues[0]?.message ?? "Invalid account." };
  }

  if (bankId === CUSTOM_BANK_ID) {
    const customName = String(form.get("custom_bank_name") ?? "").trim();
    const paybill = paybillSchema.safeParse(form.get("custom_paybill"));
    if (!customName) return { ok: false, error: "Enter your bank’s name." };
    if (!paybill.success) {
      return { ok: false, error: paybill.error.issues[0]?.message ?? "Invalid paybill." };
    }
    return {
      ok: true,
      value: {
        kind: "bank",
        bankId: CUSTOM_BANK_ID,
        bankName: customName,
        paybill: paybill.data,
        account: account.data,
        displayName: `${customName} · Acc ${account.data}`,
      },
    };
  }

  const bank = kenyaBankById(bankId);
  if (!bank) return { ok: false, error: "Pick your bank from the list." };

  return {
    ok: true,
    value: {
      kind: "bank",
      bankId: bank.id,
      bankName: bank.name,
      paybill: bank.businessNumber,
      account: account.data,
      displayName: `${bank.name} · Acc ${account.data}`,
    },
  };
}

function guessName(n: string): string {
  return `BUSINESS ${n.slice(-3)}`;
}

export function destinationLabel(d: DraftDestination): string {
  if (d.kind === "till") return `till ${d.till}`;
  if (d.kind === "paybill") return `paybill ${d.paybill} · account ${d.account}`;
  return `${d.bankName} · Acc ${d.account}`;
}

export type SavedDestinationSummary = {
  id: string;
  kind: string;
  till_number?: string | null;
  paybill_number?: string | null;
  account_number?: string | null;
  bank_id?: string | null;
  display_name?: string | null;
  verified?: boolean;
  active?: boolean;
  activated?: boolean;
  inserted_at?: string | null;
};

export function savedDestinationLabel(d: SavedDestinationSummary): string {
  if (d.display_name) return d.display_name;
  if (d.kind === "till" && d.till_number) return `Till ${d.till_number}`;
  if (d.kind === "paybill" && d.paybill_number) {
    return `Paybill ${d.paybill_number} · ${d.account_number ?? ""}`.trim();
  }
  if (d.paybill_number && d.account_number) {
    return `Bank · ${d.paybill_number} · Acc ${d.account_number}`;
  }
  return "Saved destination";
}

export function destinationKindLabel(kind: string): string {
  if (kind === "till") return "Buy Goods till";
  if (kind === "paybill") return "Business paybill";
  if (kind === "bank") return "Bank account";
  return kind;
}

export type DestinationTone = "on" | "ok" | "attn";

export function savedDestinationStatus(d: SavedDestinationSummary): {
  label: string;
  tone: DestinationTone;
  hint: string;
} {
  if (d.active) {
    return {
      label: "In use",
      tone: "on",
      hint: "Customers' payments land here right now.",
    };
  }
  if (d.verified) {
    return {
      label: "Ready",
      tone: "ok",
      hint: "Confirmed. Set it as default to receive payments.",
    };
  }
  return {
    label: "Needs confirmation",
    tone: "attn",
    hint: "Confirm it before it can receive payments.",
  };
}

export type SavedDestinationFact = { label: string; value: string };

/** The raw identifiers for a saved destination, so the numbers are unambiguous. */
export function savedDestinationFacts(d: SavedDestinationSummary): SavedDestinationFact[] {
  const facts: SavedDestinationFact[] = [
    { label: "Type", value: destinationKindLabel(d.kind) },
  ];

  if (d.kind === "till") {
    facts.push({ label: "Till number", value: d.till_number ?? "—" });
  }

  if (d.kind === "paybill" || d.kind === "bank") {
    facts.push({
      label: d.kind === "bank" ? "Lipa Na M‑Pesa paybill" : "Paybill",
      value: d.paybill_number ?? "—",
    });
    facts.push({ label: "Account number", value: d.account_number ?? "—" });
  }


  return facts;
}

/** One plain sentence of what happens when a customer pays into this destination. */
export function savedDestinationSentence(d: SavedDestinationSummary): string {
  if (d.kind === "till") {
    return `When a customer pays, they get an M‑Pesa prompt on their phone. After their PIN, the money lands in till ${d.till_number ?? "—"}. Nothing to set up at Safaricom.`;
  }
  if (d.kind === "paybill") {
    return `When a customer pays, they get an M‑Pesa prompt on their phone. After their PIN, the money lands in paybill ${d.paybill_number ?? "—"} (account ${d.account_number ?? "—"}). Nothing to set up at Safaricom.`;
  }
  return `When a customer pays, they get an M‑Pesa prompt on their phone. After their PIN, the money lands in your bank account ${d.account_number ?? "—"} (Lipa Na M‑Pesa paybill ${d.paybill_number ?? "—"}).`;
}

export function confirmSentence(d: DraftDestination): string {
  if (d.kind === "till") {
    return `When a customer pays, they get an M‑Pesa push. After they enter their PIN, the money is sent to till ${d.till}. Nothing to set up at Safaricom.`;
  }
  if (d.kind === "paybill") {
    return `When a customer pays, they get an M‑Pesa push. After they enter their PIN, the money is sent to paybill ${d.paybill} (account ${d.account}). Nothing to set up at Safaricom.`;
  }
  return `When a customer pays, they get an M‑Pesa push. After they enter their PIN, the money is sent to ${d.bankName} account ${d.account} (Lipa Na M‑Pesa paybill ${d.paybill}). Nothing to set up at Safaricom.`;
}
