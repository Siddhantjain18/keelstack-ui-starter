/**
 * KeelStack API Client
 *
 * Types and calls are derived directly from the engine source:
 *   src/04-Modules/auth/AuthService.ts      — return shapes
 *   src/04-Modules/auth/index.ts            — route handlers
 *   src/02-Common/dtos/                     — request validation
 *   src/01-Core/errors/AppError.ts          — error envelope
 */

import axios, { AxiosError, type AxiosInstance } from "axios";

// ─── Types — verified against engine source ───────────────────────────────────

export type UserRole       = "owner" | "admin" | "member";
// All four values exist in the engine's BillingProvider enum.
// Only "stripe" has a real gateway implementation (StripeGateway.ts).
// "paddle", "razorpay", "paypal" fall back to BaseSandboxGateway — fake UUIDs,
// no real API calls. Do not use them in production.
export type BillingProvider = "stripe" | "paddle" | "razorpay" | "paypal";
export type SubscriptionPlan = "free" | "basic" | "premium";
export type TaskType   = "report" | "export" | "ai_analysis";
export type TaskStatus = "queued" | "processing" | "done" | "failed";

/**
 * User shape as returned by AuthService.registerUser() and loginUser().
 * NOTE: login only returns { id, email, mfaEnabled } — no role field.
 * role comes from GET /api/v1/users/:userId separately.
 */
export interface KSUser {
  id: string;
  email: string;
  mfaEnabled: boolean;
  // Only present when fetched from GET /api/v1/users/:userId
  role?: UserRole;
  emailVerified?: boolean;
  createdAt?: string;
}

/**
 * POST /api/v1/auth/login → AuthService.loginUser()
 *
 * The engine returns ONE of two shapes depending on mfaEnabled:
 *
 *   Non-MFA user:
 *     { sessionToken, refreshToken, sessionExpiresAt, user }
 *
 *   MFA user:
 *     { mfaRequired: true, user }   ← NO tokens. Session is NOT issued yet.
 *     The client must complete mfaChallenge() + mfaVerify() to get tokens.
 *
 * This union is intentional. Do NOT call storeLoginSession() on the MFA
 * variant — it has no tokens to store.
 */
export type KSLoginResponse = KSLoginSuccess | KSLoginMfaRequired;

export interface KSLoginSuccess {
  sessionToken: string;
  refreshToken: string;
  sessionExpiresAt: string;
  user: { id: string; email: string; mfaEnabled: boolean };
  mfaRequired?: never; // discriminant: absent on success
}

export interface KSLoginMfaRequired {
  mfaRequired: true;
  user: { id: string; email: string; mfaEnabled: boolean };
  sessionToken?: never; // discriminant: absent on MFA gate
}

/**
 * POST /api/v1/auth/refresh-token → AuthService.refreshSession()
 * Returns: { sessionToken, refreshToken, sessionExpiresAt }
 * NOTE: no user object in the refresh response.
 */
export interface KSRefreshResponse {
  sessionToken: string;
  refreshToken: string;
  sessionExpiresAt: string;
}

/**
 * POST /api/v1/auth/mfa/challenge → AuthService.createMfaChallenge()
 * Returns: { challengeToken, expiresAt, codePreview? (dev only) }
 */
export interface KSMfaChallengeResponse {
  challengeToken: string;
  expiresAt: string;
  codePreview?: string; // only in non-production
}

/**
 * POST /api/v1/auth/mfa/verify → AuthService.verifyMfa()
 * Returns: { sessionToken, refreshToken, sessionExpiresAt, user }
 *
 * IMPORTANT: The engine DOES issue a full session here — it is NOT just
 * { verified: true }. The old comment in the codebase was wrong. verifyMfa()
 * in AuthService.ts calls saveSession() and returns full tokens. Store them.
 */
export interface KSMfaVerifyResponse {
  sessionToken: string;
  refreshToken: string;
  sessionExpiresAt: string;
  user: { id: string; email: string; mfaEnabled: boolean };
}

export interface KSOAuthCallbackSession {
  sessionToken: string;
  refreshToken: string;
  userId?: string;
  user?: { id: string; email: string; mfaEnabled: boolean };
}

export interface KSMfaToggleChallengeResponse {
  challengeToken: string;
  expiresAt: string;
  codePreview?: string;
}

export interface KSSubscription {
  tenantId: string;
  customerEmail: string;
  provider: BillingProvider;
  plan: SubscriptionPlan;
  status?: string;
  providerSubscriptionId?: string;
  updatedAt?: string;
}

export interface KSTask {
  jobId: string;
  status: TaskStatus;
  createdAt: string;
  result?: unknown;
  error?: string;
}

export interface KSLLMBudget {
  userId: string;
  tokensUsedThisHour: number;
  budgetPerHour: number;
  remainingTokens: number;
  percentUsed: number;
  windowResetAt: string;
  provider: string;
  model: string;
}

/**
 * Error envelope from AppError.handleGlobalError():
 * { status: "error", code: ErrorCode, message: string }
 */
export interface KSApiError {
  message: string;
  code?: string;
  statusCode?: number;
}

export interface KSMockWebhookEnvelope {
  provider: BillingProvider;
  eventType: string;
  subscriptionId: string;
  idempotencyKey: string;
  note: string;
}

// ─── Token storage ────────────────────────────────────────────────────────────

const SESSION_KEY = "ks_session_token";
const REFRESH_KEY = "ks_refresh_token";
const TENANT_KEY  = "ks_tenant_id";
const USER_KEY    = "ks_user";
const AUTH_CHANGED_EVENT = "ks-auth-changed";

function emitAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export const tokenStore = {
  getSession:  (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null,
  setSession:  (t: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SESSION_KEY, t);
    emitAuthChanged();
  },
  getRefresh:  (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null,
  setRefresh:  (t: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(REFRESH_KEY, t);
    emitAuthChanged();
  },
  getTenantId: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(TENANT_KEY) : null,
  setTenantId: (id: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(TENANT_KEY, id);
    emitAuthChanged();
  },
  getUser: (): KSUser | null => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem(USER_KEY) ?? "null"); } catch { return null; }
  },
  setUser: (u: KSUser) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    emitAuthChanged();
  },
  setOAuthSession: (sessionToken: string, refreshToken: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SESSION_KEY, sessionToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    emitAuthChanged();
  },
  clear: () => {
    if (typeof window === "undefined") return;
    [SESSION_KEY, REFRESH_KEY, TENANT_KEY, USER_KEY].forEach((k) =>
      localStorage.removeItem(k)
    );
    emitAuthChanged();
  },
};

function storeLoginSession(res: KSLoginSuccess): void {
  tokenStore.setSession(res.sessionToken);
  tokenStore.setRefresh(res.refreshToken);
  tokenStore.setTenantId(res.user.id); // userId doubles as tenantId in single-tenant apps
  tokenStore.setUser({ ...res.user });
}

function storeMfaSession(res: KSMfaVerifyResponse): void {
  tokenStore.setSession(res.sessionToken);
  tokenStore.setRefresh(res.refreshToken);
  tokenStore.setTenantId(res.user.id);
  tokenStore.setUser({ ...res.user });
}

function storeOAuthSession(payload: KSOAuthCallbackSession): void {
  tokenStore.setOAuthSession(payload.sessionToken, payload.refreshToken);
  if (payload.userId) {
    tokenStore.setTenantId(payload.userId);
  }
  if (payload.user) {
    tokenStore.setTenantId(payload.user.id);
    tokenStore.setUser({ ...payload.user });
  }
}

function storeRefreshedSession(res: KSRefreshResponse): void {
  tokenStore.setSession(res.sessionToken);
  tokenStore.setRefresh(res.refreshToken);
  // tenantId and user unchanged — only tokens rotated
}

// ─── Auth route URLs that must NOT trigger the 401 redirect interceptor ───────
//
// Bug fix: the response interceptor was redirecting to /auth/login on ANY 401,
// including the login endpoint itself. A failed login returns 401 "Invalid
// credentials" — the interceptor caught it, wiped the page before React could
// render the error, and the user saw nothing.
//
// The fix: skip the refresh+redirect logic for auth endpoints. These endpoints
// are supposed to return 401 to the caller — let the caller handle it.
const AUTH_PASSTHROUGH_URLS = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/mfa/challenge",
  "/api/v1/auth/mfa/verify",
  "/api/v1/auth/password-reset/request",
  "/api/v1/auth/password-reset/confirm",
  "/api/v1/auth/email-verification/request",
  "/api/v1/auth/email-verification/confirm",
];

function isAuthPassthroughUrl(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_PASSTHROUGH_URLS.some((authUrl) => url.includes(authUrl));
}

// ─── Axios instance ───────────────────────────────────────────────────────────

function createClient(): AxiosInstance {
  const baseURL =
    typeof window === "undefined"
      ? (process.env.KEELSTACK_API_URL ?? "http://localhost:3000")
      : "";

  const redirectOnUnauthorized =
    (process.env.NEXT_PUBLIC_AUTH_REDIRECT_ON_401 ?? "").toLowerCase() === "true";

  const client = axios.create({
    baseURL,
    timeout: 15_000,
    headers: { "Content-Type": "application/json" },
  });

  client.interceptors.request.use((config) => {
    const token    = tokenStore.getSession();
    const tenantId = tokenStore.getTenantId();
    if (token)    config.headers["Authorization"] = `Bearer ${token}`;
    if (tenantId) config.headers["x-tenant-id"]   = tenantId;
    return config;
  });

  let isRefreshing = false;
  let waitQueue: Array<(t: string) => void> = [];

  client.interceptors.response.use(
    (res) => res,
    async (err: AxiosError) => {
      const original = err.config as typeof err.config & { _retry?: boolean };

      // ── Auth endpoints: never intercept, always let caller handle the error ─
      // A 401 from /auth/login means "wrong password" — not an expired session.
      // Redirecting to /auth/login here would wipe the page before React renders
      // the error message.
      if (isAuthPassthroughUrl(original?.url)) {
        return Promise.reject(err);
      }

      if (err.response?.status === 401 && !original?._retry) {
        const refreshToken = tokenStore.getRefresh();
        if (!refreshToken) {
          tokenStore.clear();
          if (redirectOnUnauthorized && typeof window !== "undefined") {
            window.location.href = "/auth/login";
          }
          return Promise.reject(err);
        }

        if (isRefreshing) {
          return new Promise((resolve) => {
            waitQueue.push((t) => {
              if (original) original.headers["Authorization"] = `Bearer ${t}`;
              resolve(client(original!));
            });
          });
        }

        isRefreshing = true;
        if (original) original._retry = true;

        try {
          const { data } = await axios.post<KSRefreshResponse>(
            "/api/v1/auth/refresh-token",
            { refreshToken }
          );
          storeRefreshedSession(data);
          waitQueue.forEach((cb) => cb(data.sessionToken));
          waitQueue = [];
          if (original) {
            original.headers["Authorization"] = `Bearer ${data.sessionToken}`;
            original.headers["x-tenant-id"]   = tokenStore.getTenantId() ?? "";
          }
          return client(original!);
        } catch {
          tokenStore.clear();
          if (redirectOnUnauthorized && typeof window !== "undefined") {
            window.location.href = "/auth/login";
          }
          return Promise.reject(err);
        } finally {
          isRefreshing = false;
        }
      }
      return Promise.reject(err);
    }
  );

  return client;
}

const http = createClient();

// ─── Error normalizer — matches engine's { status, code, message } envelope ──

export function extractApiError(err: unknown): KSApiError {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { status?: string; code?: string; message?: string }
      | undefined;
    return {
      message:    data?.message ?? err.message ?? "Request failed",
      code:       data?.code,
      statusCode: err.response?.status,
    };
  }
  return { message: String(err) };
}

export function getAuthErrorMessage(err: unknown, mode: "register" | "login" | "mfa"): string {
  const apiError = extractApiError(err);
  const message = apiError.message.toLowerCase();

  if (mode === "register") {
    if (apiError.statusCode === 409 || message.includes("already registered")) {
      return "That email already has an account. Sign in instead, or use password reset if you do not remember the password.";
    }
    if (apiError.statusCode === 400) {
      return "Please enter a valid email and a password of at least 8 characters.";
    }
    return "Registration failed. Please try again.";
  }

  if (mode === "login") {
    if (apiError.statusCode === 401 || message.includes("invalid credentials")) {
      return "That email/password combination was rejected. Double-check your password, or reset it if needed.";
    }
    if (apiError.statusCode === 423 || message.includes("locked")) {
      return "This account is temporarily locked after repeated failed sign-in attempts. Wait a bit, then try again or reset the password.";
    }
    if (apiError.statusCode === 400) {
      return "Please enter a valid email and password.";
    }
    if (apiError.statusCode === 429) {
      return "Too many sign-in attempts. Please wait a moment before trying again.";
    }
    return "Sign-in failed. Please try again.";
  }

  // mode === "mfa"
  if (
    apiError.statusCode === 401 ||
    message.includes("invalid") ||
    message.includes("expired")
  ) {
    return "That MFA code was not accepted. Enter the latest 6-digit code and try again.";
  }

  return "Verification failed. Please try again.";
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  getOAuthStartUrl: (provider: "google" | "apple"): string => {
    const configuredBase =
      process.env.NEXT_PUBLIC_KEELSTACK_AUTH_API_BASE?.replace(/\/$/, "") ?? "";
    const routePath = `/api/v1/auth/${provider}`;
    return configuredBase ? `${configuredBase}${routePath}` : routePath;
  },

  completeOAuthSession: (payload: KSOAuthCallbackSession): void => {
    storeOAuthSession(payload);
  },

  /**
   * POST /api/v1/auth/register
   * Returns: { user: { id, email, mfaEnabled } }
   */
  register: async (
    email: string,
    password: string,
    enableMfa = false
  ): Promise<{ user: KSUser }> => {
    const { data } = await http.post("/api/v1/auth/register", {
      email,
      password,
      enableMfa,
    });
    return data;
  },

  /**
   * POST /api/v1/auth/login
   *
   * Returns one of two shapes:
   *   KSLoginSuccess      — full session tokens (mfaEnabled: false)
   *   KSLoginMfaRequired  — { mfaRequired: true, user } only (mfaEnabled: true)
   *
   * storeLoginSession() is only called for the success shape.
   * Do NOT store anything for the MFA gate — tokens come from mfaVerify().
   */
  login: async (email: string, password: string): Promise<KSLoginResponse> => {
    const { data } = await http.post<KSLoginResponse>("/api/v1/auth/login", {
      email,
      password,
    });
    // Only store session if we actually got tokens.
    // The MFA variant has no tokens — storing undefined would poison localStorage.
    if (!data.mfaRequired) {
      storeLoginSession(data as KSLoginSuccess);
    }
    return data;
  },

  /**
   * POST /api/v1/auth/mfa/challenge
   * Returns: { challengeToken, expiresAt, codePreview? }
   * Call this when mfaRequired === true, before verifying.
   */
  mfaChallenge: async (email: string): Promise<KSMfaChallengeResponse> => {
    const { data } = await http.post("/api/v1/auth/mfa/challenge", { email });
    return data;
  },

  /**
   * POST /api/v1/auth/mfa/verify
   * Returns: { sessionToken, refreshToken, sessionExpiresAt, user }
   *
   * This IS the session issuance step for MFA users.
   * The engine's AuthService.verifyMfa() calls saveSession() and returns
   * full tokens. Store them here.
   */
  mfaVerify: async (
    email: string,
    challengeToken: string,
    code: string
  ): Promise<KSMfaVerifyResponse> => {
    const { data } = await http.post<KSMfaVerifyResponse>("/api/v1/auth/mfa/verify", {
      email,
      challengeToken,
      code,
    });
    storeMfaSession(data);
    return data;
  },

  /**
   * POST /api/v1/auth/mfa/enable/request
   * Auth required. Sends challenge code to the signed-in user's email.
   */
  requestMfaEnable: async (): Promise<KSMfaToggleChallengeResponse> => {
    const { data } = await http.post<KSMfaToggleChallengeResponse>(
      "/api/v1/auth/mfa/enable/request"
    );
    return data;
  },

  /**
   * POST /api/v1/auth/mfa/enable/confirm
   * Auth required. Confirms challenge and enables MFA.
   */
  confirmMfaEnable: async (
    challengeToken: string,
    code: string
  ): Promise<{ mfaEnabled: boolean }> => {
    const { data } = await http.post<{ mfaEnabled: boolean }>(
      "/api/v1/auth/mfa/enable/confirm",
      { challengeToken, code }
    );
    return data;
  },

  /**
   * POST /api/v1/auth/mfa/disable/request
   * Auth required. Sends challenge code to the signed-in user's email.
   */
  requestMfaDisable: async (): Promise<KSMfaToggleChallengeResponse> => {
    const { data } = await http.post<KSMfaToggleChallengeResponse>(
      "/api/v1/auth/mfa/disable/request"
    );
    return data;
  },

  /**
   * POST /api/v1/auth/mfa/disable/confirm
   * Auth required. Confirms challenge and disables MFA.
   */
  confirmMfaDisable: async (
    challengeToken: string,
    code: string
  ): Promise<{ mfaEnabled: boolean }> => {
    const { data } = await http.post<{ mfaEnabled: boolean }>(
      "/api/v1/auth/mfa/disable/confirm",
      { challengeToken, code }
    );
    return data;
  },

  /**
   * POST /api/v1/auth/password-reset/request
   * Returns: { accepted: true, tokenPreview?: string, expiresAt?: string }
   * tokenPreview only present in non-production — use it in dev to skip email.
   */
  requestPasswordReset: async (
    email: string
  ): Promise<{ accepted: boolean; tokenPreview?: string; expiresAt?: string }> => {
    const { data } = await http.post("/api/v1/auth/password-reset/request", { email });
    return data;
  },

  /**
   * POST /api/v1/auth/password-reset/confirm
   * Body: { token, nextPassword }   ← field is nextPassword, not newPassword
   * Returns: { reset: true }
   */
  confirmPasswordReset: async (
    token: string,
    nextPassword: string
  ): Promise<{ reset: boolean }> => {
    const { data } = await http.post("/api/v1/auth/password-reset/confirm", {
      token,
      nextPassword, // matches ConfirmPasswordResetDto field name exactly
    });
    return data;
  },

  /**
   * POST /api/v1/auth/email-verification/request
   * Returns: { accepted: true, tokenPreview?, expiresAt? }
   */
  requestEmailVerification: async (
    email: string
  ): Promise<{ accepted: boolean; tokenPreview?: string; expiresAt?: string }> => {
    const { data } = await http.post(
      "/api/v1/auth/email-verification/request",
      { email }
    );
    return data;
  },

  /**
   * POST /api/v1/auth/email-verification/confirm
   * Returns: { verified: true }
   */
  confirmEmailVerification: async (
    token: string
  ): Promise<{ verified: boolean }> => {
    const { data } = await http.post(
      "/api/v1/auth/email-verification/confirm",
      { token }
    );
    return data;
  },

  logout: () => tokenStore.clear(),
};

// ─── Billing API ──────────────────────────────────────────────────────────────

export const billingApi = {
  getCurrentSubscription: async (): Promise<{
    subscription: KSSubscription | null;
  }> => {
    const { data } = await http.get("/api/v1/billing/subscriptions/current");
    return data;
  },

  createSubscription: async (payload: {
    tenantId: string;
    customerEmail: string;
    provider: BillingProvider;
    plan: SubscriptionPlan;
    idempotencyKey?: string;
  }): Promise<{ subscription: KSSubscription }> => {
    const { idempotencyKey, ...body } = payload;
    const { data } = await http.post("/api/v1/billing/subscriptions", body, {
      headers: idempotencyKey
        ? { "x-idempotency-key": idempotencyKey }
        : undefined,
    });
    return data;
  },
};

// ─── Tasks API ────────────────────────────────────────────────────────────────

export const tasksApi = {
  /**
   * POST /api/v1/tasks → 202 { status, jobId, pollUrl, message }
   * x-user-id header is still read by the task route directly.
   * We send the stored userId from session so it matches the authenticated user.
   */
  submit: async (
    type: TaskType,
    payload: Record<string, unknown>,
    simulateRetryCount?: number
  ): Promise<{ jobId: string; pollUrl: string; status: string }> => {
    const userId = tokenStore.getUser()?.id ?? "demo-user";
    const finalPayload = { ...payload };
    if (simulateRetryCount !== undefined) {
      finalPayload["simulateRetryCount"] = simulateRetryCount;
    }
    const { data } = await http.post(
      "/api/v1/tasks",
      { type, payload: finalPayload },
      { headers: { "x-user-id": userId } }
    );
    return data;
  },

  /** GET /api/v1/tasks/:jobId → { status: "ok", data: KSTask } */
  poll: async (jobId: string): Promise<{ status: string; data: KSTask }> => {
    const userId = tokenStore.getUser()?.id ?? "demo-user";
    const { data } = await http.get(`/api/v1/tasks/${jobId}`, {
      headers: { "x-user-id": userId },
    });
    return data;
  },
};

// ─── LLM API ──────────────────────────────────────────────────────────────────

export const llmApi = {
  getBudget: async (): Promise<KSLLMBudget> => {
    const { data } = await http.get("/api/v1/llm/budget");
    return data;
  },
  getHealth: async () => {
    const { data } = await http.get("/api/v1/llm/health");
    return data;
  },
};

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminApi = {
  getDLQ: async (limit = 20): Promise<{ jobs: any[]; pagination: any }> => {
    const { data } = await http.get("/api/v1/admin/jobs/dlq", {
      params: { limit },
      headers: { "x-admin-api-key": "demo-admin-key" }, // Matches engine .env expectation
    });
    return data;
  },
};

// ─── Users API ────────────────────────────────────────────────────────────────

export const usersApi = {
  getUser: async (userId: string): Promise<{ user: KSUser }> => {
    const { data } = await http.get(`/api/v1/users/${userId}`);
    return data;
  },
  updateRole: async (userId: string, role: UserRole): Promise<{ user: KSUser }> => {
    const { data } = await http.patch(`/api/v1/users/${userId}/role`, { role });
    return data;
  },
};

// ─── Health ───────────────────────────────────────────────────────────────────

export const healthApi = {
  // Use a longer timeout for health checks to handle Render cold starts (up to 45s)
  auth:    () => http.get("/api/v1/auth/health", { timeout: 45_000 }),
  billing: () => http.get("/api/v1/billing/health", { timeout: 45_000 }),
  users:   () => http.get("/api/v1/users/health", { timeout: 45_000 }),
  llm:     () => http.get("/api/v1/llm/health", { timeout: 45_000 }),
  v2:      () => http.get("/api/v2/health", { timeout: 45_000 }),
  wakeUp:  () => http.get("/api/v1/health/wake-up"),
};
