import Head from "next/head";
import { useState } from "react";
import Link from "next/link";
import { KeelStackBrandLink, KeelStackPoweredBadge } from "../../components/KeelStackBrand";
import { authApi, extractApiError } from "../../lib/api-client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [tokenPreview, setTokenPreview] = useState<string | undefined>();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authApi.requestPasswordReset(email);
      if (result.tokenPreview) setTokenPreview(result.tokenPreview);
      setSent(true);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <Head>
        <title>Reset Password | KeelStack Demo</title>
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
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-info/10 border border-info/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-info text-xl">✉</span>
              </div>
              <h2 className="font-display font-bold text-lg text-fg mb-2">Check your email</h2>
              <p className="text-sm text-fg-muted mb-6">
                If an account exists for <strong className="text-fg">{email}</strong>, a reset link
                has been sent.
              </p>
              {tokenPreview && (
                <div className="mb-4 rounded-lg bg-warning/10 border border-warning/20 px-3.5 py-2.5 text-left">
                  <p className="text-xs text-warning font-mono mb-1">Dev mode — skip email</p>
                  <p className="text-xs text-fg-muted">
                    Token:{" "}
                    <a
                      href={`/auth/password-reset?token=${tokenPreview}`}
                      className="font-mono text-accent hover:underline break-all"
                    >
                      {tokenPreview}
                    </a>
                  </p>
                </div>
              )}
              <Link
                href="/auth/login"
                className="text-sm text-accent hover:underline"
              >
                ← Back to login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display font-bold text-xl text-fg mb-1">Reset password</h1>
              <p className="text-sm text-fg-muted mb-6">
                We&apos;ll send a reset link via the engine&apos;s Resend integration.
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
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm text-fg placeholder:text-muted focus:border-accent transition-colors outline-none"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-danger/10 border border-danger/30 px-3.5 py-2.5 text-sm text-danger">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent hover:bg-accent-dim text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-fg-muted">
                <Link href="/auth/login" className="hover:text-accent transition-colors">
                  ← Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
