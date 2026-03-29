import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { KeelStackBrandLink, KeelStackPoweredBadge } from "../../components/KeelStackBrand";
import { authApi, extractApiError } from "../../lib/api-client";

type State = "verifying" | "done" | "error";

export default function EmailVerificationPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!router.isReady) return;

    const token = router.query.token as string | undefined;
    if (!token) {
      setMessage("Missing verification token. Use the link from your email.");
      setState("error");
      return;
    }

    authApi
      .confirmEmailVerification(token)
      .then((res) => { if (res.verified) setState("done"); })
      .catch((err) => {
        setMessage(extractApiError(err).message);
        setState("error");
      });
  }, [router.isReady, router.query.token]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <Head>
        <title>Verify Email | KeelStack Demo</title>
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

        <div className="rounded-xl border border-border p-7 text-center" style={{ background: "var(--surface)" }}>
          {state === "verifying" && (
            <>
              <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto mb-4" />
              <h2 className="font-display font-bold text-lg text-fg mb-1">Verifying…</h2>
              <p className="text-sm text-fg-muted">Confirming your email with the engine.</p>
            </>
          )}

          {state === "done" && (
            <>
              <div className="w-12 h-12 rounded-full bg-success/10 border border-success/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-success text-xl">✓</span>
              </div>
              <h2 className="font-display font-bold text-lg text-fg mb-2">Email verified</h2>
              <p className="text-sm text-fg-muted mb-6">Your account is confirmed.</p>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dim text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors"
              >
                Sign in
              </Link>
            </>
          )}

          {state === "error" && (
            <>
              <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-danger text-xl">✕</span>
              </div>
              <h2 className="font-display font-bold text-lg text-fg mb-2">Verification failed</h2>
              <p className="text-sm text-danger mb-6">{message || "Invalid or expired token."}</p>
              <Link href="/auth/login" className="text-sm text-accent hover:underline">
                ← Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
