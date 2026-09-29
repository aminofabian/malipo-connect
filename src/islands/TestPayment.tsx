import { useEffect, useState } from "react";

type Status = "idle" | "prompting" | "settled" | "failed";

const phoneOk = (v: string) => /^254\d{9}$/.test(v.replace(/\s+/g, ""));
const MIN_KES = 1;
const MAX_KES = 500;

function parseAmount(raw: string): number | null {
  const n = Number.parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n) || n < MIN_KES || n > MAX_KES) return null;
  return n;
}

export default function TestPayment({
  tenantId,
  initialAmount,
}: {
  tenantId: string;
  initialAmount?: string;
}) {
  const [phone, setPhone] = useState("254");
  const [amount, setAmount] = useState(initialAmount || "10");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId || status !== "prompting") return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/test-status?id=${encodeURIComponent(paymentId)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: Status;
          failure_message?: string;
        };
        if (data.status === "settled" || data.status === "failed") {
          setStatus(data.status);
          if (data.status === "failed" && data.failure_message) {
            setError(data.failure_message);
          }
        }
      } catch {
        /* keep polling */
      }
    }, 1500);
    return () => clearInterval(t);
  }, [paymentId, status]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = phone.replace(/\s+/g, "");
    if (!phoneOk(cleaned)) {
      setError("Use a Kenyan number like 254712345678.");
      return;
    }
    const kes = parseAmount(amount);
    if (kes == null) {
      setError(`Enter an amount between KES ${MIN_KES} and ${MAX_KES}.`);
      return;
    }
    setStatus("prompting");
    try {
      const res = await fetch("/api/test-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: cleaned, amount: kes, tenantId }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setStatus("failed");
        setError(data.error ?? "Could not start the test.");
        return;
      }
      setPaymentId(data.id);
    } catch {
      setStatus("failed");
      setError("Network error. Try again.");
    }
  }

  const kesLabel = parseAmount(amount) ?? 10;

  if (status === "settled") {
    return (
      <div className="status-ok">Received KES {kesLabel}. Your integration works.</div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel" style={{ display: "grid", gap: "1rem" }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="phone">Your phone</label>
        <input
          id="phone"
          name="phone"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="254712345678"
        />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="amount">Amount (KES)</label>
        <input
          id="amount"
          name="amount"
          inputMode="numeric"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          placeholder="10"
          min={MIN_KES}
          max={MAX_KES}
        />
        <span className="field-hint">
          Some banks reject KES 1. Try 10 or whatever your bank accepts ({MIN_KES}–{MAX_KES}).
        </span>
      </div>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      {status === "prompting" && (
        <p className="note" style={{ margin: 0 }}>
          Check your phone for the M-Pesa prompt…
        </p>
      )}
      {status === "failed" && !error && (
        <p className="err" role="alert">
          Payment failed. Try a different amount — some banks need more than KES 1.
        </p>
      )}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={status === "prompting"}
        style={{ justifySelf: "start" }}
      >
        {status === "prompting" ? "Waiting…" : `Send KES ${kesLabel}`}
      </button>
    </form>
  );
}
