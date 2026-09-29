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
- Admin: optional `MALIPO_ADMIN_USER` / `MALIPO_ADMIN_PASSWORD` on the Elixir service
# malipo-connect
