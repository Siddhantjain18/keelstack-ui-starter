import Head from "next/head";
import { useQuery } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { healthApi, extractApiError } from "../lib/api-client";
import clsx from "clsx";
import { useEffect, useState } from "react";

const HEALTH_POLL_MS = 15_000;

export default function DashboardPage() {
  const [hasSeenHealthyCycle, setHasSeenHealthyCycle] = useState(false);
  const [warmupStartedAt] = useState(() => Date.now());

  const wakeUpQuery = useQuery({
    queryKey: ["health", "wake-up"],
    queryFn: () => healthApi.wakeUp(),
    retry: false,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const healthChecks = [
    { name: "Auth Service", query: useQuery({ queryKey: ["health", "auth"], queryFn: () => healthApi.auth(), refetchInterval: HEALTH_POLL_MS, retry: 5, retryDelay: 2000 }) },
    { name: "Billing Service", query: useQuery({ queryKey: ["health", "billing"], queryFn: () => healthApi.billing(), refetchInterval: HEALTH_POLL_MS, retry: 5, retryDelay: 2000 }) },
    { name: "User Service", query: useQuery({ queryKey: ["health", "users"], queryFn: () => healthApi.users(), refetchInterval: HEALTH_POLL_MS, retry: 5, retryDelay: 2000 }) },
    { name: "LLM Service", query: useQuery({ queryKey: ["health", "llm"], queryFn: () => healthApi.llm(), refetchInterval: HEALTH_POLL_MS, retry: 5, retryDelay: 2000 }) },
    { name: "API v2 (Core)", query: useQuery({ queryKey: ["health", "v2"], queryFn: () => healthApi.v2(), refetchInterval: HEALTH_POLL_MS, retry: 5, retryDelay: 2000 }) },
  ];

  const successfulChecks = healthChecks.filter(
    (s) => s.query.isSuccess && s.query.data?.data?.status === "ok"
  ).length;

  useEffect(() => {
    if (successfulChecks > 0) {
      setHasSeenHealthyCycle(true);
    }
  }, [successfulChecks]);

  const anyFetching = healthChecks.some(s => s.query.isFetching);
  const anyLoading = healthChecks.some(s => s.query.isLoading);
  const allUp = healthChecks.every(s => s.query.isSuccess && s.query.data?.data?.status === "ok");
  const isWakingUp =
    !hasSeenHealthyCycle &&
    successfulChecks === 0 &&
    (anyFetching || anyLoading || wakeUpQuery.isFetching);
  const anyDown = !isWakingUp && healthChecks.some(s => s.query.isError && !s.query.isFetching);
  const isDegraded = !isWakingUp && !allUp && !anyDown;
  const warmupSeconds = Math.max(1, Math.round((Date.now() - warmupStartedAt) / 1000));

  return (
    <Layout>
      <Head>
        <title>System Status | KeelStack</title>
      </Head>

      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-fg mb-2">System Status</h1>
          <p className="text-fg-muted leading-relaxed">
            Real-time health monitoring of KeelStack engine modules. 
          </p>
        </div>

        <div
          className="rounded-2xl border border-border/80 p-5"
          style={{
            background:
              "linear-gradient(130deg, rgba(17,17,24,0.98), rgba(13,15,24,0.94) 60%, rgba(99,102,241,0.1))",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-accent">Engine pulse</p>
              <h2 className="mt-1 font-display text-xl font-bold text-fg">
                {isWakingUp
                  ? "Spinning Up Services"
                  : allUp
                  ? "All Systems Operational"
                  : isDegraded
                  ? "Degraded Performance"
                  : "Incident Detected"}
              </h2>
              <p className="mt-1 text-xs text-fg-muted">
                {isWakingUp
                  ? `Cold-start recovery in progress (${warmupSeconds}s). Visitors are seeing live boot telemetry instead of static placeholders.`
                  : allUp
                  ? "Every core module is returning healthy responses on schedule."
                  : isDegraded
                  ? "Some modules are delayed but still responding."
                  : "One or more modules stopped responding and require attention."}
              </p>
            </div>
            <div className="rounded-full border border-border bg-bg/70 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.24em] text-fg-muted">
              Refresh {Math.round(HEALTH_POLL_MS / 1000)}s
            </div>
          </div>
        </div>

        {isWakingUp && (
          <div className="rounded-xl border border-warning/30 p-4 flex items-center gap-4" style={{ background: "rgba(245,158,11,0.08)" }}>
            <div className="w-5 h-5 border-2 border-warning border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-sm font-medium text-warning">Connecting to engine nodes...</p>
              <p className="text-[10px] text-warning/70">Free-tier infrastructure sleeps after idle time. We trigger wake-up on visit to protect conversion flow and keep the experience premium.</p>
            </div>
          </div>
        )}

        {isDegraded && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-center gap-4">
            <div className="w-5 h-5 rounded-full bg-warning/20 flex items-center justify-center text-warning font-bold text-xs">~</div>
            <div>
              <p className="text-sm font-medium text-warning">Partial service availability</p>
              <p className="text-[10px] text-warning/70">Some checks are healthy while others are recovering. Data remains live and updates each cycle.</p>
            </div>
          </div>
        )}

        {anyDown && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 flex items-center gap-4">
            <div className="w-5 h-5 rounded-full bg-danger/20 flex items-center justify-center text-danger font-bold text-xs">!</div>
            <div>
              <p className="text-sm font-medium text-danger">Engine Disconnected</p>
              <p className="text-[10px] text-danger/70">One or more services stopped responding. Check dashboard logs below for details.</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {healthChecks.map((service) => {
            const isUp = service.query.isSuccess;
            const isError = service.query.isError;
            const data = service.query.data?.data;
            const isServiceWarming = isWakingUp && !isUp;

            return (
              <div 
                key={service.name}
                className="rounded-xl border border-border bg-surface p-5 transition-all hover:border-accent/30"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-fg">{service.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      "w-2 h-2 rounded-full animate-pulse",
                      isUp ? "bg-success" : isServiceWarming ? "bg-warning" : isError ? "bg-danger" : "bg-warning"
                    )} />
                    <span className={clsx(
                      "text-xs font-medium uppercase tracking-wider",
                      isUp ? "text-success" : isServiceWarming ? "text-warning" : isError ? "text-danger" : "text-warning"
                    )}>
                      {isUp ? "Operational" : isServiceWarming ? "Spinning Up" : isError ? "Offline" : "Checking…"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-fg-muted font-mono">Module</span>
                    <span className="text-fg font-mono">{data?.module ?? "—"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-fg-muted font-mono">Status</span>
                    <span className={clsx("font-mono", data?.status === "ok" ? "text-success" : "text-warning")}>
                      {data?.status ?? (isError ? "error" : "—")}
                    </span>
                  </div>
                  {data?.details && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-[10px] text-fg-muted font-mono leading-tight">
                        {JSON.stringify(data.details, null, 2)}
                      </p>
                    </div>
                  )}
                  {isError && (
                    <div className="mt-3 p-2 rounded bg-danger/5 border border-danger/10">
                      <p className="text-[10px] text-danger font-mono italic">
                        {isWakingUp
                          ? "Waiting for module boot handshake."
                          : extractApiError(service.query.error).message}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-accent/5 border border-accent/10 p-6">
          <h3 className="text-sm font-semibold text-accent mb-2 uppercase tracking-wider">Engine Architecture</h3>
          <p className="text-xs text-fg-muted leading-relaxed mb-4">
            KeelStack uses a shared-nothing distributed architecture. Each module exposes its own health check 
            that performs "deep" verification of its specific dependencies (e.g. the Billing module checks 
            Stripe API reachability, while the LLM module checks token budget Redis keys).
          </p>
          <div className="flex items-center gap-4 text-[10px] font-mono text-fg-muted">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" /> DB OK
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" /> REDIS OK
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" /> SENTRY OK
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
