import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { authApi, extractApiError, type KSMfaToggleChallengeResponse } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

type FlowStatus = "idle" | "loading" | "success" | "error";

export default function MfaSettingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, setUser } = useAuth();

  const [enableChallenge, setEnableChallenge] = useState<KSMfaToggleChallengeResponse | null>(null);
  const [disableChallenge, setDisableChallenge] = useState<KSMfaToggleChallengeResponse | null>(null);
  const [enableCode, setEnableCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [message, setMessage] = useState("");

  const welcomeMode = useMemo(() => router.query.welcome === "1", [router.query.welcome]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [isAuthenticated, isLoading, router]);

  function showError(err: unknown, fallback: string) {
    const apiError = extractApiError(err);
    setStatus("error");
    setMessage(apiError.message || fallback);
  }

  async function handleEnableRequest() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await authApi.requestMfaEnable();
      setEnableChallenge(response);
      setEnableCode("");
      setStatus("success");
      setMessage("Verification code sent. Enter the 6-digit code to enable MFA.");
    } catch (err) {
      showError(err, "Could not start MFA enable flow.");
    }
  }

  async function handleEnableConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enableChallenge) return;

    setStatus("loading");
    setMessage("");
    try {
      await authApi.confirmMfaEnable(enableChallenge.challengeToken, enableCode);
      if (user) setUser({ ...user, mfaEnabled: true });
      setEnableChallenge(null);
      setEnableCode("");
      setStatus("success");
      setMessage("MFA is now enabled for your account.");
    } catch (err) {
      showError(err, "Could not confirm MFA enable.");
    }
  }

  async function handleDisableRequest() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await authApi.requestMfaDisable();
      setDisableChallenge(response);
      setDisableCode("");
      setStatus("success");
      setMessage("Verification code sent. Enter the 6-digit code to disable MFA.");
    } catch (err) {
      showError(err, "Could not start MFA disable flow.");
    }
  }

  async function handleDisableConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!disableChallenge) return;

    setStatus("loading");
    setMessage("");
    try {
      await authApi.confirmMfaDisable(disableChallenge.challengeToken, disableCode);
      if (user) setUser({ ...user, mfaEnabled: false });
      setDisableChallenge(null);
      setDisableCode("");
      setStatus("success");
      setMessage("MFA has been disabled for your account.");
    } catch (err) {
      showError(err, "Could not confirm MFA disable.");
    }
  }

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <Head>
        <title>MFA Settings | KeelStack Demo</title>
      </Head>

      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div className="rounded-xl border border-border p-6" style={{ background: "var(--surface)" }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display font-bold text-2xl text-fg">Multi-factor authentication</h1>
              <p className="mt-2 text-sm text-fg-muted">
                Manage MFA for your signed-in account using the engine's secure request + confirm endpoints.
              </p>
            </div>
            <Link href="/auth-demo" className="text-sm text-accent hover:underline">
              Back to auth demo
            </Link>
          </div>

          {welcomeMode && (
            <p className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              OAuth sign-in completed. Review MFA settings before continuing.
            </p>
          )}

          <p className="mt-4 text-xs text-fg-muted">
            Current state: {user?.mfaEnabled ? "Enabled" : "Disabled or unknown"}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-xl border border-border p-5" style={{ background: "var(--surface)" }}>
            <h2 className="font-display text-lg font-semibold text-fg">Enable MFA</h2>
            <p className="mt-1 text-sm text-fg-muted">Request a one-time code, then confirm to enable MFA.</p>

            {!enableChallenge ? (
              <button
                type="button"
                onClick={handleEnableRequest}
                disabled={status === "loading"}
                className="mt-4 w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dim disabled:opacity-50"
              >
                {status === "loading" ? "Requesting…" : "Enable request"}
              </button>
            ) : (
              <form onSubmit={handleEnableConfirm} className="mt-4 space-y-3">
                {enableChallenge.codePreview && (
                  <p className="rounded-md border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
                    Dev code preview: {enableChallenge.codePreview}
                  </p>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={enableCode}
                  onChange={(e) => setEnableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  placeholder="000000"
                  className="w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-fg outline-none transition-colors focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={status === "loading" || enableCode.length !== 6}
                  className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dim disabled:opacity-50"
                >
                  {status === "loading" ? "Confirming…" : "Enable confirm"}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-xl border border-border p-5" style={{ background: "var(--surface)" }}>
            <h2 className="font-display text-lg font-semibold text-fg">Disable MFA</h2>
            <p className="mt-1 text-sm text-fg-muted">Request a one-time code, then confirm to disable MFA.</p>

            {!disableChallenge ? (
              <button
                type="button"
                onClick={handleDisableRequest}
                disabled={status === "loading"}
                className="mt-4 w-full rounded-lg border border-border bg-bg py-2.5 text-sm font-medium text-fg transition-colors hover:border-accent/40 disabled:opacity-50"
              >
                {status === "loading" ? "Requesting…" : "Disable request"}
              </button>
            ) : (
              <form onSubmit={handleDisableConfirm} className="mt-4 space-y-3">
                {disableChallenge.codePreview && (
                  <p className="rounded-md border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
                    Dev code preview: {disableChallenge.codePreview}
                  </p>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  placeholder="000000"
                  className="w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-fg outline-none transition-colors focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={status === "loading" || disableCode.length !== 6}
                  className="w-full rounded-lg border border-border bg-bg py-2.5 text-sm font-medium text-fg transition-colors hover:border-accent/40 disabled:opacity-50"
                >
                  {status === "loading" ? "Confirming…" : "Disable confirm"}
                </button>
              </form>
            )}
          </section>
        </div>

        {message && (
          <p
            className={`rounded-md border px-3 py-2 text-sm ${
              status === "error"
                ? "border-danger/30 bg-danger/10 text-danger"
                : "border-success/30 bg-success/10 text-success"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
