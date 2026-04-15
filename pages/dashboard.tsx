import Head from "next/head";
import { useQuery } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { healthApi, extractApiError } from "../lib/api-client";
import clsx from "clsx";

export default function DashboardPage() {
  const healthChecks = [
    { name: "Auth Service", query: useQuery({ queryKey: ["health", "auth"], queryFn: () => healthApi.auth(), refetchInterval: 15000, retry: 5, retryDelay: 2000 }) },
    { name: "Billing Service", query: useQuery({ queryKey: ["health", "billing"], queryFn: () => healthApi.billing(), refetchInterval: 15000, retry: 5, retryDelay: 2000 }) },
    { name: "User Service", query: useQuery({ queryKey: ["health", "users"], queryFn: () => healthApi.users(), refetchInterval: 15000, retry: 5, retryDelay: 2000 }) },
    { name: "LLM Service", query: useQuery({ queryKey: ["health", "llm"], queryFn: () => healthApi.llm(), refetchInterval: 15000, retry: 5, retryDelay: 2000 }) },
    { name: "API v2 (Core)", query: useQuery({ queryKey: ["health", "v2"], queryFn: () => healthApi.v2(), refetchInterval: 15000, retry: 5, retryDelay: 2000 }) },
  ];

  const anyFetching = healthChecks.some(s => s.query.isFetching);
  const allUp = healthChecks.every(s => s.query.isSuccess && s.query.data?.data?.status === "ok");
  const anyDown = healthChecks.some(s => s.query.isError && !s.query.isFetching);
  const isWakingUp = anyFetching && !allUp && !anyDown;

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

        {isWakingUp && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-center gap-4 animate-pulse">
            <div className="w-5 h-5 border-2 border-warning border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-sm font-medium text-warning">Connecting to Engine...</p>
              <p className="text-[10px] text-warning/70">Services are spinning up after inactivity. This cold start is normal on free-tier hosting.</p>
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
                      isUp ? "bg-success" : isError ? "bg-danger" : "bg-warning"
                    )} />
                    <span className={clsx(
                      "text-xs font-medium uppercase tracking-wider",
                      isUp ? "text-success" : isError ? "text-danger" : "text-warning"
                    )}>
                      {isUp ? "Operational" : isError ? "Offline" : "Checking…"}
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
                        {extractApiError(service.query.error).message}
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
