# KeelStack UI Starter

A reference frontend for the [KeelStack Engine](https://keelstack.me) backend — built to visibly demonstrate the engineering patterns the engine implements, not just wrap CRUD endpoints.

This isn't a generic dashboard. Every screen is designed to surface a specific backend pattern that most starter kits skip or fake.

---

## What this demonstrates

### Billing — Idempotency & Webhook Deduplication

The billing page makes the idempotency layer visible. When you create a subscription:

- The UI generates an `x-idempotency-key` and shows you what it is
- You can see the `correlation.requestId` in every response — the same ID the engine propagates through the webhook pipeline
- The webhook mock viewer shows the normalized envelope KeelStack uses before dedup-checking: `{ provider, eventType, subscriptionId }`. If Stripe retries, the second call returns `{ processed: true, duplicate: true }` without re-executing billing logic

This is backed by `IdempotencyStore.tryClaimKey()` — a Redis `SET NX` operation that eliminates the race condition where two concurrent retries both read `isProcessed=false` before either writes the marker.

### Jobs — 202 Accepted + Poll Pattern

The jobs page shows the canonical async request lifecycle:

```
POST /api/v1/tasks
  → 202 Accepted { jobId, pollUrl }

GET /api/v1/tasks/:jobId     (every 1.5s)
  → { status: "queued" | "processing" | "done" | "failed", result?, error? }
```

The engine's `RetryableJobRunner` handles failure, re-enqueue, and exponential backoff. The UI polls until terminal status and shows the full job state machine inline.

Why not 200? LLM calls and exports can take 5–60 seconds. A synchronous 200 blocks Node's HTTP thread and causes client timeouts. KeelStack accepts the request, returns immediately, and processes in background.

### AI Usage — Token Budget Boundary

The LLM page surfaces `LLMClient`'s boundary layer:

- Per-hour token budget (`LLM_TOKEN_BUDGET_PER_HOUR`) with a live meter
- Calls blocked by the boundary are shown as `✗ blocked` — no API call made, no bill
- Provider is swappable via `LLM_PROVIDER` env var (`stub` | `openai` | `anthropic`) with no code changes
- Timeout isolation: every call is wrapped in `LLM_TIMEOUT_MS` — a hung provider cannot stall the server

### Auth — Full Session Lifecycle

- Login with automatic MFA step detection (engine returns `mfaRequired: true`)
- Google Sign-In and Sign in with Apple via backend OAuth/OIDC routes
- OAuth callback handling at `/auth/callback` with secure session token storage
- OAuth error handling at `/auth/error` for provider-denied/callback failures
- Logged-in MFA management page with enable/disable request + confirm flows
- Access token + refresh token rotation handled by Axios interceptor — expired tokens are transparently refreshed
- `authAttackProtection` middleware on the engine blocks brute-force on MFA and password reset routes

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (Pages Router) |
| State / fetching | TanStack Query v5 |
| HTTP | Axios with interceptor-based token rotation |
| Styling | Tailwind CSS |
| Fonts | Syne (display) · DM Sans (body) · JetBrains Mono (code) |

---

## Setup

### 1. Start KeelStack Engine

You need a running KeelStack Engine instance. See the [engine quickstart](https://keelstack.me).

Minimal local dev (no Stripe, no email required):

```bash
# In the engine directory
cp .env.example .env
# Leave DATABASE_URL and REDIS_URL blank for in-memory fallbacks
# LLM_PROVIDER=stub requires no API key
docker-compose up -d
npm run dev
```

Engine starts on `http://localhost:3000`.

### 2. Install and configure the UI

```bash
git clone https://github.com/KeelStack-me/keelstack-ui-starter
cd keelstack-ui-starter

npm install

cp .env.local.example .env.local
# Edit .env.local — set KEELSTACK_API_URL to your engine URL
```

### 3. Run

```bash
npm run dev
# → http://localhost:3001
```

If you want to use a different port:

```bash
npm run dev -- -p 4000
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `KEELSTACK_API_URL` | `http://localhost:3000` | Server-side URL of your KeelStack Engine. Used by Next.js SSR and the `/api/*` proxy rewrite — never exposed to the browser |
| `NEXT_PUBLIC_KEELSTACK_AUTH_API_BASE` | empty | Optional absolute API base for OAuth start routes (`/api/v1/auth/google`, `/api/v1/auth/apple`). Leave empty to use same-origin `/api/*` rewrites |
| `NEXT_PUBLIC_LLM_PROVIDER` | `stub` | Display only — mirrors engine's `LLM_PROVIDER` |
| `NEXT_PUBLIC_LLM_MODEL` | `gpt-4o-mini` | Display only |
| `NEXT_PUBLIC_LLM_MAX_TOKENS` | `1024` | Display only |
| `NEXT_PUBLIC_LLM_TOKEN_BUDGET_PER_HOUR` | `10000` | Display only |
| `NEXT_PUBLIC_LLM_TIMEOUT_MS` | `30000` | Display only |

The `NEXT_PUBLIC_LLM_*` variables are display-only — they mirror your engine config for the AI dashboard. They are not secrets and do not include API keys.

### OAuth backend alignment

Set backend OAuth redirect targets to this UI app:

```env
# in keelstack-engine/.env
OAUTH_SUCCESS_REDIRECT_URI=http://localhost:3001/auth/callback
OAUTH_ERROR_REDIRECT_URI=http://localhost:3001/auth/error
OAUTH_RESPONSE_MODE=redirect
```

Provider callback URIs to register:

- Google callback: `http://localhost:3000/api/v1/auth/google/callback`
- Apple callback: `http://localhost:3000/api/v1/auth/apple/callback`

---

## API contract

Browser calls go through Next.js `/api/*` rewrites, which proxy to `KEELSTACK_API_URL`. The client is typed against the engine's route shapes:

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh-token
POST   /api/v1/auth/mfa/challenge
POST   /api/v1/auth/mfa/verify
POST   /api/v1/auth/password-reset/request
POST   /api/v1/auth/password-reset/confirm
POST   /api/v1/auth/email-verification/request
POST   /api/v1/auth/email-verification/confirm
POST   /api/v1/auth/mfa/enable/request
POST   /api/v1/auth/mfa/enable/confirm
POST   /api/v1/auth/mfa/disable/request
POST   /api/v1/auth/mfa/disable/confirm
GET    /api/v1/auth/google
GET    /api/v1/auth/apple

GET    /api/v1/billing/subscriptions/current
POST   /api/v1/billing/subscriptions
POST   /api/v1/tasks
GET    /api/v1/tasks/:jobId

GET    /api/v1/users/:userId
PATCH  /api/v1/users/:userId/role
```

---

## Project structure

```
keelstack-ui-starter/
├── lib/
│   ├── api-client.ts          # Typed HTTP client — mirrors engine contracts exactly
│   └── auth-context.tsx       # Session state + token rotation
├── components/
│   └── Layout.tsx             # Sidebar nav + layout shell
├── pages/
│   ├── _app.tsx               # QueryClient + AuthProvider
│   ├── index.tsx              # Overview — module health, user state
│   ├── billing.tsx            # Subscriptions + idempotency + local webhook dedup preview
│   ├── jobs.tsx               # Authenticated async task submit + 202+poll lifecycle
│   ├── llm.tsx                # Token budget + LLMClient boundary
│   └── auth/
│       ├── callback.tsx       # OAuth success callback (stores session tokens)
│       ├── error.tsx          # OAuth provider failure surface
│       ├── login.tsx          # Password login + MFA step + Google/Apple entry
│       ├── mfa.tsx            # Logged-in MFA enable/disable request+confirm
│       ├── register.tsx       # Registration
│       └── reset-password.tsx # Password reset request
├── styles/
│   └── globals.css
├── .env.local.example
└── README.md
```

---

## MFA usage flow

1. Sign in using password, Google, or Apple.
2. Open `/auth/mfa` (or use the sidebar "MFA Settings").
3. For enable flow: click "Enable request", enter the code, then "Enable confirm".
4. For disable flow: click "Disable request", enter the code, then "Disable confirm".
5. In non-production engine environments, `codePreview` is shown for easier local testing.

## Troubleshooting

- Social buttons redirect to wrong host:
  Set `NEXT_PUBLIC_KEELSTACK_AUTH_API_BASE` or keep it empty and use Next rewrites.
- OAuth callback returns missing token params:
  Ensure backend `OAUTH_RESPONSE_MODE=redirect` and success redirect URI points to `/auth/callback`.
- Apple callback fails with provider error:
  Verify `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY_PEM` in backend env.
- MFA request says authentication required:
  Confirm login completed and session token exists in localStorage.
- MFA enable/disable returns conflict:
  This is expected if you request enable while already enabled, or disable while already disabled.

---

## License

MIT — open source, use freely.

This UI is a reference client for the KeelStack Engine backend.  
For the engine: [https://keelstack.me](https://keelstack.me)

> **Note:** This UI demonstrates patterns, not lock-in. The idempotency headers, correlation IDs, 202+poll flows, and webhook dedup response shapes are KeelStack-specific. You could adapt this UI to another backend — but you'd have to implement those patterns yourself first.
