import { useState } from "react";

type Mode = "live" | "test";
type Revealed = { client_id: string; client_secret: string; webhook_secret: string; rotated?: boolean };

/**
 * Reveal the API secrets on demand, behind the account password. Nothing is
 * revealed until the merchant asks; hiding (and a reload) conceals it again.
 */
export default function RevealKeys({ mode, hasKey }: { mode: Mode; hasKey: boolean }) {
  const [stage, setStage] = useState<"idle" | "prompt" | "revealed">("idle");
  const [password, setPassword] = useState("");
  const [secrets, setSecrets] = useState<Revealed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  if (!hasKey) {
    return <p className="note">Keys are not issued yet. Create them to reveal the secrets here.</p>;
  }

  async function reveal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError("Enter your account password.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/keys/reveal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, mode }),
      });
      const data = (await res.json()) as Partial<Revealed> & { message?: string };

      if (!res.ok || !data.client_secret) {
        setError(data.message ?? "Could not reveal keys.");
        return;
      }

      setSecrets({
        client_id: data.client_id ?? "",
        client_secret: data.client_secret,
        webhook_secret: data.webhook_secret ?? "",
        rotated: Boolean(data.rotated),
      });
      setStage("revealed");
      setPassword("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function hide() {
    setSecrets(null);
    setStage("idle");
    setPassword("");
    setError(null);
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard blocked — user can select the text */
    }
  }

  if (stage === "revealed" && secrets) {
    return (
      <div>
        {secrets.rotated && (
          <p className="callout callout-warn" role="status">
            This key was created before secrets could be stored, so we issued a fresh secret — update
            your server, the previous one no longer works.
          </p>
        )}
        <div className="copy-list">
          <div className="copy-row">
            <span className="copy-row-label">Client secret</span>
            <span className="copy-row-value">
              <code>{secrets.client_secret}</code>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => copy(secrets.client_secret, "cs")}
              >
                {copied === "cs" ? "Copied" : "Copy"}
              </button>
            </span>
          </div>
          <div className="copy-row">
            <span className="copy-row-label">Webhook secret</span>
            <span className="copy-row-value">
              <code>{secrets.webhook_secret}</code>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => copy(secrets.webhook_secret, "wh")}
              >
                {copied === "wh" ? "Copied" : "Copy"}
              </button>
            </span>
          </div>
        </div>
        <div className="actions mt-3">
          <button type="button" className="btn btn-ghost btn-sm" onClick={hide}>
            Hide keys
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="note mb-3">
        Your secrets are hidden. Re-enter your account password to reveal them — they are never
        shown automatically.
      </p>

      {error && (
        <p className="callout callout-error" role="alert">
          {error}
        </p>
      )}

      {stage === "prompt" ? (
        <form onSubmit={reveal} className="row gap-2">
          <div className="field field-grow">
            <label htmlFor="reveal-password" className="sr-only">
              Account password
            </label>
            <input
              id="reveal-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your account password"
            />
          </div>
          <button type="submit" className="btn btn-accent" disabled={busy} aria-busy={busy}>
            {busy ? "Checking…" : "Reveal"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setStage("idle");
              setPassword("");
              setError(null);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="btn btn-accent btn-sm" onClick={() => setStage("prompt")}>
          Reveal keys
        </button>
      )}
    </div>
  );
}
