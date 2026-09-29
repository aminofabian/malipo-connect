import { useEffect, useState } from "react";

type Status = "idle" | "prompting" | "settled" | "failed";

const phoneOk = (v: string) => /^254\d{9}$/.test(v.replace(/\s+/g, ""));

export default function TestPayment({ tenantId }: { tenantId: string }) {
  const [phone, setPhone] = useState("254");
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
    setStatus("prompting");
    try {
      const res = await fetch("/api/test-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: cleaned, tenantId }),
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

  if (status === "settled") {
    return <div className="status-ok">Received. Your integration works.</div>;
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
          Payment failed. Try again with KES 1.
        </p>
      )}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={status === "prompting"}
        style={{ justifySelf: "start" }}
      >
        {status === "prompting" ? "Waiting…" : "Send KES 1"}
      </button>
    </form>
  );
}
