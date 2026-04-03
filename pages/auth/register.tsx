import Head from "next/head";
import { useState } from "react";
import Link from "next/link";
import { KeelStackBrandLink, KeelStackPoweredBadge } from "../../components/KeelStackBrand";
import { authApi, extractApiError, getAuthErrorMessage } from "../../lib/api-client";

export default function RegisterPage() {
  const [email, setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  // For dev mode email verification testing
  const [verifyToken, setVerifyToken] = useState<string | undefined>();
  const [resending, setResending]     = useState(false);

  const googleAuthUrl = authApi.getOAuthStartUrl("google");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setErrorCode(null);
    setLoading(true);
    try {
      // Best practice: don't force MFA during registration.
      // Users can enable it in /auth/mfa after they sign in.
      await authApi.register(email, password, false);
      setDone(true);
    } catch (err) {
      const apiError = extractApiError(err);
      let msg = getAuthErrorMessage(err, "register");
      if (!msg) msg = "An unexpected error occurred. Please try again.";
      setError(msg);
      setErrorCode(apiError.statusCode ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setResending(true);
    try {
      const res = await authApi.requestEmailVerification(email);
      if (res.tokenPreview) {
        setVerifyToken(res.tokenPreview);
      }
    } catch (err) {
      // subtle fail — don't crash the success screen
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <Head>
        <title>Register | KeelStack Demo</title>
      </Head>
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

        <div
          className="rounded-xl border border-border p-7"
          style={{ background: "var(--surface)" }}
        >
          {done ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-success/10 border border-success/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-success text-xl">✓</span>
              </div>
              <h2 className="font-display font-bold text-lg text-fg mb-2">Account created</h2>
              <p className="text-sm text-fg-muted mb-6">
                Please check your email to verify your address before signing in.
              </p>

              {verifyToken ? (
                <div className="mb-6 p-3 rounded-lg bg-accent/10 border border-accent/20 text-left">
                  <p className="text-[10px] uppercase tracking-wider text-accent font-bold mb-1.5">
                    Dev Mode — Verification Link
                  </p>
                  <Link
                    href={`/auth/email-verification?token=${verifyToken}`}
                    className="text-xs font-mono text-fg break-all hover:underline"
                  >
                    /auth/email-verification?token={verifyToken}
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="mb-8 text-xs text-accent hover:underline disabled:text-muted disabled:no-underline"
                >
                  {resending ? "Requesting link…" : "Didn't receive an email? Resend verification"}
                </button>
              )}

              <Link
                href="/auth/login"
                className="w-full inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-dim text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors"
              >
                Go to Sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display font-bold text-xl text-fg mb-1">Create account</h1>
              <p className="text-sm text-fg-muted mb-6">
                Register on the KeelStack Engine backend.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1.5 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) {
                        setError("");
                        setErrorCode(null);
                      }
                    }}
                    placeholder="you@example.com"
                    className="w-full bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm text-fg placeholder:text-muted focus:border-accent transition-colors outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1.5 uppercase tracking-wider">
                    Password
                    <span className="ml-2 text-muted normal-case font-normal">min. 8 chars</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) {
                        setError("");
                        setErrorCode(null);
                      }
                    }}
                    placeholder="••••••••"
                    className="w-full bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm text-fg placeholder:text-muted focus:border-accent transition-colors outline-none"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-danger/10 border border-danger/30 px-3.5 py-2.5 text-sm text-danger">
                    <p>{error}</p>
                    {errorCode === 409 && (
                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        <Link href="/auth/login" className="text-accent hover:underline">
                          Go to sign in
                        </Link>
                        <Link href="/auth/reset-password" className="text-accent hover:underline">
                          Reset password
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent hover:bg-accent-dim text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating account…" : "Create account"}
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
                  Sign up with Google
                </a>
              </div>

              <p className="mt-5 text-center text-xs text-fg-muted">
                Already have an account?{" "}
                <Link href="/auth/login" className="text-accent hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
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
