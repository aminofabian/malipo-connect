# Malipo Connect — merchant user app (Astro)

```bash
cd malipo/connect
npm install
npm run dev   # http://localhost:4322
```

## Auth

Connect has **its own** email + password accounts (stored in Malipo `connect_accounts`).
No Kiosk / platform session reuse.

| Action | Where |
|---|---|
| Create account | `/signup` → `POST /internal/v1/connect/register` |
| Sign in | `/signin` → `POST /internal/v1/connect/login` |
| Session | Signed `mc_session` cookie (HMAC, Path=/) |

```bash
export MALIPO_SERVICE_URL=http://127.0.0.1:4000
export MALIPO_PUBLIC_API_URL=http://127.0.0.1:4000
export CONNECT_SESSION_SECRET=long-random-string
# optional: MALIPO_SERVICE_TOKEN=… when the service requires it
```

- Public merchant API: `Authorization: Bearer sk_live_…` on Malipo `POST /v1/payments` (HTTP Basic still works)
- Integration guide: [`docs/INTEGRATION.md`](../docs/INTEGRATION.md), also served at `/guide`
- Admin: `/admin/*` is gated by a session login. Set `MALIPO_ADMIN_USER` and
  `MALIPO_ADMIN_PASSWORD` on the Elixir service (dev falls back to `admin` / `admin`).

## Pages

| Route | What it does |
|---|---|
| `/` | Home — setup status and links |
| `/destinations` | Saved destinations: organised list, **set the default**, confirm drafts |
| `/destinations/:id` | One destination's details |
| `/destination` | Add a new till / paybill / bank destination |
| `/keys` | Charge a phone: the one request to copy, recent payments, rotate keys |
| `/settings` | Integration settings — API base, client id, and the **website URL** |
| `/test` | Send a test payment — pick the amount (KES 1–500) |
| `/guide` | Integration guide (mirrors `docs/INTEGRATION.md`) |
| `/healthz` | Deploy probe — readiness (`?live=1` for liveness) |

Signed-in pages carry an app nav (Home · Destinations · Keys · Settings · Sign out).

### Website URL (`/settings`)

The merchant's `https` website/callback URL is stored on their key
(`PUT /internal/v1/merchants/:id/webhook`). When a payment is created without its own
`callback_url`, Malipo now POSTs the result (settle/fail) to this saved URL by default.
A per-request `callback_url` still wins.

### Received totals

Intents snapshot the settlement destination that was active when they were created
(`context.settlement_destination_id`), so `GET /internal/v1/merchants/:id/summary`
returns settled totals overall and per destination. Connect shows the total on the
home page and on each destination card, ticks checklist step 4 once a payment has
settled, and lets `/keys` switch the recent-payments list between **This
destination** and **All**.

Payments made before attribution existed have no destination id. Run
`mix malipo.backfill_attribution` (or the **Backfill attribution** button on the
super-admin Merchants page) to attribute them best-effort — each intent goes to the
newest destination whose `inserted_at` is at or before it. Safe to re-run.

## Health

- `GET /healthz` — **readiness**. `200` only when the Malipo service answers
  `/ready`; `503` when it is unreachable, `MALIPO_SERVICE_URL` is unset, or the
  service returns non-2xx (e.g. a pending migration). The body embeds the
  upstream `/ready` summary (database, vault, Daraja credentials).
- `GET /healthz?live=1` — **liveness**. `200` whenever the Connect process answers,
  independent of the service.
- The Docker image declares a liveness `HEALTHCHECK` against `/healthz?live=1`.

Point platform monitoring at `/healthz` so a down dependency surfaces as a 503
immediately, instead of as blank or redirecting pages.
# malipo-connect
