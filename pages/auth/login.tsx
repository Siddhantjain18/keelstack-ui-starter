import Head from "next/head";
import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { KeelStackBrandLink, KeelStackPoweredBadge } from "../../components/KeelStackBrand";
import { authApi, extractApiError, getAuthErrorMessage } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

/*
 * Login page — matches the engine's actual auth flow exactly.
 *
 * Engine flow (AuthService.ts):
 *
 *   POST /auth/login
 *     Non-MFA user → { sessionToken, refreshToken, sessionExpiresAt, user }
 *     MFA user     → { mfaRequired: true, user }   ← NO tokens yet
 *
 *   POST /auth/mfa/challenge → { challengeToken, expiresAt, codePreview? }
 *   POST /auth/mfa/verify   → { sessionToken, refreshToken, sessionExpiresAt, user }
 *                              Full session issued here for MFA users.
 *                              storeMfaSession() called inside authApi.mfaVerify().
 *
 * UX:
 *   - Error is NOT cleared on re-submit. It persists until the user types.
 *   - On failure the card shakes. shakeKey remount re-triggers the animation
 *     every time without setTimeout or class-toggle hacks.
 *   - Shake keyframe lives in globals.css — not duplicated here.
 */

type Step = "credentials" | "mfa";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [step, setStep]                           = useState<Step>("credentials");
  const [email, setEmail]                         = useState("");
  const [password, setPassword]                   = useState("");
  const [mfaCode, setMfaCode]                     = useState("");
  const [challengeToken, setChallengeToken]       = useState("");
  const [codePreview, setCodePreview]             = useState<string | undefined>();
  const [error, setError]                         = useState("");
  const [errorCode, setErrorCode]                 = useState<number | null>(null);
  const [loading, setLoading]                     = useState(false);
  const [mfaChallengeReady, setMfaChallengeReady] = useState(false);

  // Incrementing this key forces a remount of the card div,
  // which re-triggers the CSS shake animation on every failure.
  const [shakeKey, setShakeKey] = useState(0);

  const googleAuthUrl = authApi.getOAuthStartUrl("google");
  // const appleAuthUrl = authApi.getOAuthStartUrl("apple");

  // ─── Credential step ────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    // Do NOT clear error here — keep it visible while the request is in-flight.
    // Error only clears when the user starts typing again.
    setLoading(true);

    try {
      const response = await authApi.login(email, password);

      if (response.mfaRequired) {
        // Engine returned { mfaRequired: true, user } — no session tokens yet.
        // Request a challenge so the user can verify possession.
        try {
          const challenge = await authApi.mfaChallenge(email);
          setChallengeToken(challenge.challengeToken);
          setCodePreview(challenge.codePreview); // only present in dev/staging
          setMfaChallengeReady(true);
          setError("");        // clear on successful step transition
          setErrorCode(null);
          setStep("mfa");
        } catch (mfaErr) {
          setError(
            "Your password was accepted, but we could not start the MFA challenge. Please try again in a moment."
          );
          setErrorCode(extractApiError(mfaErr).statusCode ?? null);
          setShakeKey((k) => k + 1);
        }
        return;
      }

      // Non-MFA success — session already stored by authApi.login()
      setUser(response.user);
      router.push("/");
    } catch (err) {
      const apiError = extractApiError(err);
      const msg = getAuthErrorMessage(err, "login");
      setError(msg);
      setErrorCode(apiError.statusCode ?? null);
      setShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  // ─── MFA step ───────────────────────────────────────────────────────────────

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // authApi.mfaVerify() calls storeMfaSession() internally — full session
      // is stored in localStorage before this line returns.
      const mfaResult = await authApi.mfaVerify(email, challengeToken, mfaCode);
      setUser(mfaResult.user);
      router.push("/");
    } catch (err) {
      const apiError = extractApiError(err);
      const msg = getAuthErrorMessage(err, "mfa");
      setError(msg);
      setErrorCode(apiError.statusCode ?? null);
      setShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  // ─── Input handlers — clear error when user starts correcting ───────────────

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (error) { setError(""); setErrorCode(null); }
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    if (error) { setError(""); setErrorCode(null); }
  }

  function handleMfaCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6));
    if (error) { setError(""); setErrorCode(null); }
  }

  function handleBackToCredentials() {
    setStep("credentials");
    setError("");
    setErrorCode(null);
    setMfaCode("");
    setChallengeToken("");
    setCodePreview(undefined);
    setMfaChallengeReady(false);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <Head>
        <title>Login | KeelStack Demo</title>
        {/* shake keyframe is defined in globals.css — not duplicated here */}
      </Head>

      {/* Grid backdrop */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-sm animate-slide-up">
        <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <KeelStackBrandLink showCaption={false} />
          <KeelStackPoweredBadge />
        </div>

        {/*
         * key={shakeKey} forces a full remount on every failure,
         * re-triggering the CSS animation unconditionally.
         * shakeKey starts at 0 so no animation fires on first render.
         */}
        <div
          key={shakeKey}
          className={`rounded-xl border border-border p-7 ${shakeKey > 0 ? "shake" : ""}`}
          style={{ background: "var(--surface)" }}
        >
          {step === "credentials" ? (
            <>
              <h1 className="font-display font-bold text-xl text-fg mb-1">Sign in</h1>
              <p className="text-sm text-fg-muted mb-6">
                Connects to your KeelStack Engine backend.
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1.5 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="you@example.com"
                    className="w-full bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm text-fg placeholder:text-muted focus:border-accent transition-colors outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1.5 uppercase tracking-wider">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="••••••••"
                    className="w-full bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm text-fg placeholder:text-muted focus:border-accent transition-colors outline-none"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-danger/10 border border-danger/30 px-3.5 py-2.5 text-sm text-danger">
                    <p>{error}</p>
                    {errorCode === 401 && (
                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        <Link href="/auth/reset-password" className="text-accent hover:underline">
                          Reset password
                        </Link>
                        <Link href="/auth/register" className="text-accent hover:underline">
                          Create account
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent hover:bg-accent-dim text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] uppercase tracking-wider text-fg-muted">
                  or continue with
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2.5">
                <a
                  href={googleAuthUrl}
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-border bg-bg px-3.5 py-2.5 text-sm text-fg hover:border-accent/40 transition-colors"
                >
                  <GoogleIcon />
                  Sign in with Google
                </a>
                {/* <a
                  href={appleAuthUrl}
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-border bg-bg px-3.5 py-2.5 text-sm text-fg hover:border-accent/40 transition-colors"
                >
                  <AppleIcon />
                  Sign in with Apple
                </a> */}
              </div>

              <div className="mt-5 flex items-center justify-between text-xs text-fg-muted">
                <Link href="/auth/register" className="hover:text-accent transition-colors">
                  Create account
                </Link>
                <Link href="/auth/reset-password" className="hover:text-accent transition-colors">
                  Forgot password?
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-display font-bold text-xl text-fg mb-1">
                Two-factor auth
              </h1>
              <p className="text-sm text-fg-muted mb-6">
                Enter the 6-digit code from your authenticator app.
              </p>

              {/* Dev helper — engine returns codePreview in non-production */}
              {codePreview && (
                <div className="mb-4 rounded-lg bg-warning/10 border border-warning/20 px-3.5 py-2.5">
                  <p className="text-xs text-warning font-mono">
                    Dev mode — code: <strong>{codePreview}</strong>
                  </p>
                </div>
              )}

              <form onSubmit={handleMfa} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={mfaCode}
                  onChange={handleMfaCodeChange}
                  placeholder="000000"
                  className="w-full bg-bg border border-border rounded-lg px-3.5 py-2.5 text-center text-2xl font-mono tracking-[0.5em] text-fg focus:border-accent transition-colors outline-none"
                />

                {error && (
                  <div className="rounded-lg bg-danger/10 border border-danger/30 px-3.5 py-2.5 text-sm text-danger">
                    <p>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6 || !mfaChallengeReady}
                  className="w-full bg-accent hover:bg-accent-dim text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? "Verifying…" : "Verify"}
                </button>

                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="w-full text-fg-muted hover:text-fg text-sm py-1 transition-colors"
                >
                  ← Back
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted mt-5">
          Powered by KeelStack Engine
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 2.9 14.6 2 12 2 6.9 2 2.8 6.3 2.8 11.8S6.9 21.6 12 21.6c6.9 0 9.1-4.9 9.1-7.4 0-.5 0-.9-.1-1.2H12z"
      />
    </svg>
  );
}

/*
function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.8c0-2.1 1.7-3.1 1.8-3.1-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.6.8-3.2.8-.6 0-1.6-.8-2.6-.8-1.4 0-2.7.8-3.4 2-.7 1.2-1 3-.2 4.9.7 1.7 1.6 3.6 2.8 3.5 1.2-.1 1.6-.7 3-.7 1.4 0 1.8.7 3 .7 1.2 0 2-1.7 2.7-3.4.8-1.8.9-3.6.9-3.7-.1 0-1.7-.7-1.7-2.5zM14.4 6.7c.6-.8 1-1.8.9-2.7-.9 0-2 .6-2.6 1.4-.5.6-1 1.7-.8 2.7 1 0 2-.5 2.5-1.4z" />
    </svg>
  );
}
*/