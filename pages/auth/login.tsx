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
 * Engine flow:
 *   POST /auth/login → always returns a session (sessionToken + user)
 *   If user.mfaEnabled === true, we show an MFA step as a UI gate before
 *   proceeding — but the session is already issued. The engine does not
 *   withhold the session pending MFA; MFA verify is a standalone confirmation.
 *
 *   POST /auth/mfa/challenge → { challengeToken, expiresAt, codePreview? }
 *   POST /auth/mfa/verify   → { verified: true }  (no new session issued)
 *
 * UX notes:
 *   - Error is NOT cleared on re-submit. It persists until the user types again.
 *   - On failure, the card shakes (CSS keyframe, driven by shakeKey remount).
 *   - shakeKey increments on every failure so the animation always re-triggers.
 */

type Step = "credentials" | "mfa";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [codePreview, setCodePreview] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [mfaChallengeReady, setMfaChallengeReady] = useState(false);

  // Incrementing this key forces a remount of the card div,
  // which re-triggers the CSS shake animation on every failure.
  const [shakeKey, setShakeKey] = useState(0);

  // ─── Credential step ────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    // ⚠️  Do NOT clear the error here — keep it visible while the new
    // request is in-flight so the user doesn't lose context.
    setLoading(true);

    try {
      const session = await authApi.login(email, password);
      // storeLoginSession() already called inside authApi.login()

      if (session.user.mfaEnabled) {
        // Session is issued but we gate UI access on MFA confirmation.
        // Request a challenge so the user can prove possession.
        try {
          const challenge = await authApi.mfaChallenge(email);
          setChallengeToken(challenge.challengeToken);
          setCodePreview(challenge.codePreview); // only present in dev
          setMfaChallengeReady(true);
          setError(""); // clear on successful step transition
          setErrorCode(null);
          setStep("mfa");
        } catch (mfaErr) {
          const msg =
            "Your password was accepted, but we could not start the MFA challenge. Please try again in a moment.";
          setError(msg);
          setErrorCode(extractApiError(mfaErr).statusCode ?? null);
          setShakeKey((k) => k + 1);
        }
        return;
      }

      setUser(session.user);
      router.push("/");
    } catch (err) {
      const apiError = extractApiError(err);
      let msg = getAuthErrorMessage(err, "login");
      if (!msg) msg = "An unexpected error occurred. Please try again.";
      setError(msg);
      setErrorCode(apiError.statusCode ?? null);
      setShakeKey((k) => k + 1); // triggers shake re-animation
    } finally {
      setLoading(false);
    }
  }

  // ─── MFA step ───────────────────────────────────────────────────────────────

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    // Same rule: don't wipe the error on re-submit, let it stay visible.
    setLoading(true);

    try {
      await authApi.mfaVerify(email, challengeToken, mfaCode);
      // mfaVerify returns { verified: true } — session was already stored by login().
      // Restore user from storage into React context and proceed.
      const { tokenStore } = await import("../../lib/api-client");
      const stored = tokenStore.getUser();
      if (stored) setUser(stored);
      router.push("/");
    } catch (err) {
      const apiError = extractApiError(err);
      let msg = getAuthErrorMessage(err, "mfa");
      if (!msg) msg = "An unexpected error occurred. Please try again.";
      setError(msg);
      setErrorCode(apiError.statusCode ?? null);
      setShakeKey((k) => k + 1); // triggers shake re-animation
    } finally {
      setLoading(false);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    // Clear the error as soon as the user starts correcting input —
    // this is when they've acknowledged it and are acting on it.
    if (error) {
      setError("");
      setErrorCode(null);
    }
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    if (error) {
      setError("");
      setErrorCode(null);
    }
  }

  function handleMfaCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6));
    if (error) {
      setError("");
      setErrorCode(null);
    }
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
        <style>{`
          @keyframes shake {
            0%,  100% { transform: translateX(0);    }
            20%        { transform: translateX(-8px); }
            40%        { transform: translateX(8px);  }
            60%        { transform: translateX(-6px); }
            80%        { transform: translateX(4px);  }
          }
          .card-shake {
            animation: shake 0.4s ease-in-out;
          }
        `}</style>
      </Head>

      {/* Subtle grid backdrop */}
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
         * key={shakeKey} forces a remount on every new failure,
         * which re-runs the CSS animation unconditionally — no setTimeout,
         * no class toggling, no animation-reset hacks needed.
         */}
        <div
          key={shakeKey}
          className={`rounded-xl border border-border p-7 ${shakeKey > 0 ? "card-shake" : ""}`}
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