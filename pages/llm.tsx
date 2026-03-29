import Head from "next/head";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { useAuth } from "../lib/auth-context";
import { tasksApi, llmApi, extractApiError } from "../lib/api-client";

type CallLogEntry = {
  id: string;
  prompt: string;
  submittedAt: string;
  jobId: string;
};

export default function LLMPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [prompt, setPrompt] = useState("Summarize the KeelStack job system in 2 sentences.");
  const [callLog, setCallLog] = useState<CallLogEntry[]>([]);
  const [error, setError] = useState("");
  const isPublicDemo = !isAuthenticated;

  // Real token budget from the engine's TokenBudgetTracker
  const { data: budget, refetch: refetchBudget } = useQuery({
    queryKey: ["llm", "budget"],
    queryFn: () => llmApi.getBudget(),
    enabled: isAuthenticated,
    refetchInterval: 10_000, // poll every 10s — budget updates after each task
  });

  // LLM provider config — no auth required
  const { data: llmHealth } = useQuery({
    queryKey: ["llm", "health"],
    queryFn: () => llmApi.getHealth(),
    staleTime: 60_000,
  });

  const submitMut = useMutation({
    mutationFn: () =>
      tasksApi.submit("ai_analysis", { prompt }),
    onSuccess: (data) => {
      setCallLog((prev) => [
        {
          id: data.jobId,
          prompt,
          submittedAt: new Date().toISOString(),
          jobId: data.jobId,
        },
        ...prev,
      ]);
      setError("");
      // Refetch budget immediately so the meter updates
      void refetchBudget();
    },
    onError: (err) => setError(extractApiError(err).message),
  });

  if (isLoading) return null;

  const tokensUsed   = budget?.tokensUsedThisHour ?? 6840;
  const budgetTotal  = budget?.budgetPerHour ?? 10000;
  const percentUsed  = budget?.percentUsed ?? 68.4;
  const remaining    = budget?.remainingTokens ?? Math.max(0, budgetTotal - tokensUsed);
  const budgetColor  =
    percentUsed > 85 ? "bg-danger" : percentUsed > 60 ? "bg-warning" : "bg-success";

  const provider  = llmHealth?.provider ?? budget?.provider ?? "stub";
  const model     = llmHealth?.model    ?? budget?.model    ?? "gpt-4o-mini";
  const stubMode  = provider === "stub";

  return (
    <Layout>
      <Head>
        <title>AI Usage | KeelStack Demo</title>
      </Head>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div>
          <p className="font-mono text-xs text-accent mb-1">AI module</p>
          <h1 className="font-display font-bold text-2xl text-fg">AI Usage</h1>
          <p className="text-sm text-fg-muted mt-1">
            Live token budget from the engine&apos;s{" "}
            <code className="font-mono text-accent text-xs">TokenBudgetTracker</code>.
            Data via <code className="font-mono text-accent text-xs">GET /api/v1/llm/budget</code>.
          </p>
          {isPublicDemo && (
            <p className="mt-3 text-xs text-fg-muted">
              Public visitors see a demo snapshot here. Live per-user usage, run history, and logs
              are unlocked in the{" "}
              <Link href="/auth-demo" className="text-accent hover:underline">
                Auth Demo
              </Link>
              .
            </p>
          )}
        </div>

        {/* Engine LLM config */}
        <div className="rounded-xl border border-border p-6" style={{ background: "var(--surface)" }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-mono px-2 py-0.5 rounded border bg-accent/10 text-accent border-accent/20">
              Engine Config
            </span>
            <h2 className="font-display font-semibold text-sm text-fg">LLM Runtime Settings</h2>
          </div>
          <p className="text-xs text-fg-muted mb-4 leading-relaxed">
            Read from <code className="font-mono text-accent text-xs">GET /api/v1/llm/health</code>.
            Swap <code className="font-mono text-accent text-xs">LLM_PROVIDER</code> between{" "}
            <code className="font-mono text-accent text-xs">stub</code>,{" "}
            <code className="font-mono text-accent text-xs">openai</code>, or{" "}
            <code className="font-mono text-accent text-xs">anthropic</code> in the engine{" "}
            <code className="font-mono text-accent text-xs">.env</code> — no code changes needed.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "provider",      value: provider },
              { label: "model",         value: model },
              { label: "maxTokens",     value: String(llmHealth?.maxTokensPerCall ?? "—") },
              { label: "timeoutMs",     value: String(llmHealth?.timeoutMs ?? "—") },
              { label: "budgetPerHour", value: budgetTotal.toLocaleString() },
              { label: "keyConfigured", value: llmHealth?.keyConfigured ? "yes" : "no" },
              { label: "stubMode",      value: String(stubMode) },
              { label: "status",        value: llmHealth?.status ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-bg border border-border px-3 py-2.5">
                <p className="text-xs text-fg-muted mb-0.5 font-mono">{label}</p>
                <p className="font-mono text-xs text-fg font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Live token budget meter */}
        <div className="rounded-xl border border-border p-6" style={{ background: "var(--surface)" }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-display font-semibold text-sm text-fg">
                {isPublicDemo ? "Demo Token Budget Snapshot" : "Hourly Token Budget"}
              </h2>
              <p className="text-xs text-fg-muted mt-0.5">
                {isPublicDemo ? (
                  <>
                    Public demo snapshot for the landing experience. Sign in to see your real
                    budget window and live usage.
                  </>
                ) : (
                  <>
                    Live from{" "}
                    <code className="font-mono text-accent text-xs">GET /api/v1/llm/budget</code>
                    {" · "}refreshes every 10s
                  </>
                )}
              </p>
            </div>
            <div className="text-right">
              {isPublicDemo && (
                <p className="mb-1 inline-flex rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                  Demo Only
                </p>
              )}
              <p className="font-mono text-lg font-bold text-fg">
                {tokensUsed.toLocaleString()}
              </p>
              <p className="font-mono text-xs text-fg-muted">
                / {budgetTotal.toLocaleString()} used
              </p>
            </div>
          </div>

          <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-700 ${budgetColor}`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-fg-muted">
            <span>{percentUsed.toFixed(1)}% consumed</span>
            <span>{remaining.toLocaleString()} remaining</span>
          </div>

          {!isPublicDemo && budget?.windowResetAt ? (
            <p className="text-xs text-muted font-mono mt-2">
              Window resets ~{new Date(budget.windowResetAt).toLocaleTimeString()}
            </p>
          ) : (
            <p className="text-xs text-muted font-mono mt-2">
              {isPublicDemo
                ? "Demo snapshot shown. Real per-user quota windows appear after login."
                : "Waiting for the next budget window update."}
            </p>
          )}
        </div>

        {/* AIBoundary explainer */}
        <div
          className="rounded-xl border border-accent/20 p-5"
          style={{ background: "rgba(99,102,241,0.04)" }}
        >
          <p className="font-mono text-xs text-accent mb-3 uppercase tracking-wider">
            AIBoundary layer — what it prevents
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                icon: "🛑",
                title: "Budget Overflow",
                desc: "LLMClient checks the TokenBudgetTracker before every call. Once the hourly budget is exhausted, the request is rejected before hitting the provider — no API bill.",
              },
              {
                icon: "⏱",
                title: "Timeout Isolation",
                desc: "Every call is wrapped in LLM_TIMEOUT_MS. A hung provider response cannot stall the Express thread indefinitely.",
              },
              {
                icon: "🔀",
                title: "Provider Swap",
                desc: "The boundary abstracts provider specifics. Change LLM_PROVIDER in .env — the application code is untouched.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="rounded-lg border border-accent/10 p-4 bg-bg/50">
                <p className="text-lg mb-2">{icon}</p>
                <p className="font-display font-semibold text-sm text-fg mb-1">{title}</p>
                <p className="text-xs text-fg-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Submit AI task */}
        <div className="rounded-xl border border-border p-6" style={{ background: "var(--surface)" }}>
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-fg mb-2">
            {isPublicDemo ? "Unlock Live AI Runs" : "Submit AI Task"}
          </h2>
          <p className="text-xs text-fg-muted mb-4 leading-relaxed">
            {isPublicDemo ? (
              <>
                Best practice for product demos: keep the headline experience visible, but gate
                account-specific logs and history. Sign in through the{" "}
                <Link href="/auth-demo" className="text-accent hover:underline">
                  Auth Demo
                </Link>{" "}
                to run live prompts, inspect job history, and view your own usage window.
              </>
            ) : (
              <>
                Submits an <code className="font-mono text-accent text-xs">ai_analysis</code> task via{" "}
                <code className="font-mono text-accent text-xs">POST /api/v1/tasks</code>. The
                background worker routes it through{" "}
                <code className="font-mono text-accent text-xs">LLMClient</code>, which enforces the
                budget boundary before calling the provider. The budget meter above will update within
                10 seconds.
              </>
            )}
          </p>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-sm text-fg placeholder:text-muted focus:border-accent transition-colors outline-none resize-none font-mono mb-4 disabled:opacity-70"
            placeholder={isPublicDemo ? "Preview your prompt here. Sign in to run it live…" : "Enter a prompt…"}
            disabled={isPublicDemo}
          />

          {error && (
            <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {isPublicDemo ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href="/auth-demo"
                className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dim"
              >
                Sign in to run prompts and view logs
              </Link>
              <p className="self-center text-xs text-fg-muted">
                Public demo stays read-only here to avoid mixing visitor activity into shared logs.
              </p>
            </div>
          ) : (
            <button
              onClick={() => submitMut.mutate()}
              disabled={submitMut.isPending || !prompt.trim()}
              className="bg-accent hover:bg-accent-dim text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {submitMut.isPending ? "Submitting…" : "Submit ai_analysis task"}
            </button>
          )}
        </div>

        {/* Call log */}
        {isPublicDemo ? (
          <div className="rounded-xl border border-border p-6" style={{ background: "var(--surface)" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded border bg-warning/10 text-warning border-warning/20">
                Login Required
              </span>
              <h2 className="font-display font-semibold text-sm text-fg">Run Logs & Prompt History</h2>
            </div>
            <p className="text-sm text-fg-muted leading-relaxed">
              Real run logs are account-specific and should stay private. Sign in through the{" "}
              <Link href="/auth-demo" className="text-accent hover:underline">
                Auth Demo
              </Link>{" "}
              to view your own prompt history, job IDs, and usage-backed activity.
            </p>
          </div>
        ) : callLog.length > 0 && (
          <div
            className="rounded-xl border border-border overflow-hidden"
            style={{ background: "var(--surface)" }}
          >
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-display font-semibold text-sm text-fg">Submitted Tasks</h2>
              <p className="text-xs text-fg-muted mt-0.5">
                Each entry is a real job ID — poll{" "}
                <code className="font-mono text-accent text-xs">GET /api/v1/tasks/:jobId</code> for
                result
              </p>
            </div>
            <div className="divide-y divide-border">
              {callLog.map((entry) => (
                <div
                  key={entry.id}
                  className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-center"
                >
                  <p className="font-mono text-xs text-fg truncate col-span-1 md:col-span-2">
                    {entry.prompt}
                  </p>
                  <div className="flex items-center gap-3 justify-start md:justify-end">
                    <span className="font-mono text-xs text-fg-muted">
                      {new Date(entry.submittedAt).toLocaleTimeString()}
                    </span>
                    <span className="font-mono text-xs text-accent truncate max-w-[120px]">
                      {entry.jobId.slice(0, 8)}…
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stub mode notice */}
        {stubMode && (
          <div className="rounded-xl border border-muted/30 p-5 bg-muted/5">
            <p className="font-mono text-xs text-fg-muted mb-1 uppercase tracking-wider">
              Stub Mode Active
            </p>
            <p className="text-xs text-fg-muted leading-relaxed">
              The engine is running with{" "}
              <code className="font-mono text-xs">LLM_PROVIDER=stub</code>. Responses are
              deterministic stubs — no API calls, no cost. Set{" "}
              <code className="font-mono text-xs">LLM_PROVIDER=openai</code> or{" "}
              <code className="font-mono text-xs">LLM_PROVIDER=anthropic</code> in the engine{" "}
              <code className="font-mono text-xs">.env</code> to use real providers.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
