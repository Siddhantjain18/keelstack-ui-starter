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
 * Returns: { sessionToken, refreshToken, sessionExpiresAt, user }
 * NOTE: engine does NOT return mfaRequired from /login.
 *       MFA is a separate explicit flow — see authApi.mfaChallenge().
 */
export interface KSLoginResponse {
  sessionToken: string;
  refreshToken: string;
  sessionExpiresAt: string;
  user: { id: string; email: string; mfaEnabled: boolean };
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
 * Returns: { verified: true }
 * NOTE: does NOT issue a session. After MFA verify the client must
 *       call /login again (MFA-enabled users skip the challenge on
 *       subsequent logins once verified, depending on your flow).
 *       In this engine MFA verify is a standalone confirmation step.
 */
export interface KSMfaVerifyResponse {
  verified: true;
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

// ─── Token storage ────────────────────────────────────────────────────────────

const SESSION_KEY = "ks_session_token";
const REFRESH_KEY = "ks_refresh_token";
const TENANT_KEY  = "ks_tenant_id";
const USER_KEY    = "ks_user";

export const tokenStore = {
  getSession:  (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null,
  setSession:  (t: string) => localStorage.setItem(SESSION_KEY, t),
  getRefresh:  (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null,
  setRefresh:  (t: string) => localStorage.setItem(REFRESH_KEY, t),
  getTenantId: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(TENANT_KEY) : null,
  setTenantId: (id: string) => localStorage.setItem(TENANT_KEY, id),
  getUser: (): KSUser | null => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem(USER_KEY) ?? "null"); } catch { return null; }
  },
  setUser: (u: KSUser) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  clear: () => {
    [SESSION_KEY, REFRESH_KEY, TENANT_KEY, USER_KEY].forEach((k) =>
      localStorage.removeItem(k)
    );
  },
};

function storeLoginSession(res: KSLoginResponse): void {
  tokenStore.setSession(res.sessionToken);
  tokenStore.setRefresh(res.refreshToken);
  tokenStore.setTenantId(res.user.id); // userId doubles as tenantId in single-tenant apps
  tokenStore.setUser({ ...res.user });
}

function storeRefreshedSession(res: KSRefreshResponse): void {
  tokenStore.setSession(res.sessionToken);
  tokenStore.setRefresh(res.refreshToken);
  // tenantId and user unchanged — only tokens rotated
}

// ─── Axios instance ───────────────────────────────────────────────────────────

function createClient(): AxiosInstance {
  const baseURL =
    typeof window === "undefined"
      ? (process.env.KEELSTACK_API_URL ?? "http://localhost:3000")
      : "";

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
      if (err.response?.status === 401 && !original?._retry) {
        const refreshToken = tokenStore.getRefresh();
        if (!refreshToken) {
          tokenStore.clear();
          if (typeof window !== "undefined") window.location.href = "/auth/login";
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
          if (typeof window !== "undefined") window.location.href = "/auth/login";
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

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
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
   * Returns: { sessionToken, refreshToken, sessionExpiresAt, user }
   *
   * MFA NOTE: The engine does NOT return mfaRequired from this endpoint.
   * If user.mfaEnabled is true in the response, the session IS issued
   * but the caller should present an MFA step separately using
   * mfaChallenge() / mfaVerify() before granting full access.
   * The engine trusts the session token unconditionally once issued.
   */
  login: async (email: string, password: string): Promise<KSLoginResponse> => {
    const { data } = await http.post<KSLoginResponse>("/api/v1/auth/login", {
      email,
      password,
    });
    storeLoginSession(data);
    return data;
  },

  /**
   * POST /api/v1/auth/mfa/challenge
   * Returns: { challengeToken, expiresAt, codePreview? }
   * Call this when user.mfaEnabled === true, BEFORE or AFTER login.
   */
  mfaChallenge: async (email: string): Promise<KSMfaChallengeResponse> => {
    const { data } = await http.post("/api/v1/auth/mfa/challenge", { email });
    return data;
  },

  /**
   * POST /api/v1/auth/mfa/verify
   * Returns: { verified: true }
   * Does NOT issue a session — this is a standalone confirmation step.
   */
  mfaVerify: async (
    email: string,
    challengeToken: string,
    code: string
  ): Promise<KSMfaVerifyResponse> => {
    const { data } = await http.post("/api/v1/auth/mfa/verify", {
      email,
      challengeToken,
      code,
    });
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
  }): Promise<{ subscription: KSSubscription }> => {
    const { data } = await http.post("/api/v1/billing/subscriptions", payload);
    return data;
  },

  getMockWebhook: async (provider: BillingProvider) => {
    const { data } = await http.get(`/api/v1/billing/webhooks/mock/${provider}`);
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
    payload: Record<string, unknown>
  ): Promise<{ jobId: string; pollUrl: string; status: string }> => {
    const userId = tokenStore.getUser()?.id ?? "demo-user";
    const { data } = await http.post(
      "/api/v1/tasks",
      { type, payload },
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
  auth:    () => http.get("/api/v1/auth/health"),
  billing: () => http.get("/api/v1/billing/health"),
  users:   () => http.get("/api/v1/users/health"),
  llm:     () => http.get("/api/v1/llm/health"),
  v2:      () => http.get("/api/v2/health"),
};
