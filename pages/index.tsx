import { useQuery } from "@tanstack/react-query";
import Head from "next/head";
import Link from "next/link";
import Layout from "../components/Layout";
import { KeelStackLogoMark } from "../components/KeelStackBrand";
import { useAuth } from "../lib/auth-context";
import { healthApi, billingApi, type SubscriptionPlan } from "../lib/api-client";

const PLAN_COLORS: Record<SubscriptionPlan, string> = {
  free: "text-fg-muted",
  basic: "text-info",
  premium: "text-accent",
};

const LIVE_HEALTH_POLL_MS = 15_000;

const LIVE_HEALTH_CHECKS = [
  { key: "auth", label: "Auth", run: () => healthApi.auth() },
  { key: "billing", label: "Billing", run: () => healthApi.billing() },
  { key: "users", label: "Users", run: () => healthApi.users() },
  { key: "v2", label: "API v2", run: () => healthApi.v2() },
] as const;

type LiveHealthCheckKey = (typeof LIVE_HEALTH_CHECKS)[number]["key"];

type LiveHealthProbe = {
  key: LiveHealthCheckKey;
  label: string;
  ok: boolean;
  durationMs: number;
};

type LiveHealthSummary = {
  auth: boolean;
  billing: boolean;
  users: boolean;
  v2: boolean;
  probes: LiveHealthProbe[];
  refreshedAt: string;
  cycleMs: number;
  avgLatencyMs: number;
  fastestLatencyMs: number;
  slowestLatencyMs: number;
  checksPerMinute: number;
  successRate: number;
};

export default function OverviewPage() {
  const { isAuthenticated, isLoading, user } = useAuth();

  const { data: sub } = useQuery({
    queryKey: ["billing", "current"],
    queryFn: () => billingApi.getCurrentSubscription(),
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: healthData } = useQuery<LiveHealthSummary>({
    queryKey: ["health-summary"],
    queryFn: async () => {
      const cycleStartedAt = performance.now();
      const probes = await Promise.all(
        LIVE_HEALTH_CHECKS.map(async ({ key, label, run }) => {
          const probeStartedAt = performance.now();

          try {
            await run();
            return {
              key,
              label,
              ok: true,
              durationMs: Math.max(1, Math.round(performance.now() - probeStartedAt)),
            };
          } catch {
            return {
              key,
              label,
              ok: false,
              durationMs: Math.max(1, Math.round(performance.now() - probeStartedAt)),
            };
          }
        })
      );

      const durations = probes.map((probe) => probe.durationMs);
      const successfulChecks = probes.filter((probe) => probe.ok).length;
      const totalChecks = probes.length;

      return {
        auth: probes.find((probe) => probe.key === "auth")?.ok ?? false,
        billing: probes.find((probe) => probe.key === "billing")?.ok ?? false,
        users: probes.find((probe) => probe.key === "users")?.ok ?? false,
        v2: probes.find((probe) => probe.key === "v2")?.ok ?? false,
        probes,
        refreshedAt: new Date().toISOString(),
        cycleMs: Math.max(1, Math.round(performance.now() - cycleStartedAt)),
        avgLatencyMs: Math.round(durations.reduce((sum, value) => sum + value, 0) / totalChecks),
        fastestLatencyMs: Math.min(...durations),
        slowestLatencyMs: Math.max(...durations),
        checksPerMinute: Math.round((60_000 / LIVE_HEALTH_POLL_MS) * totalChecks),
        successRate: Math.round((successfulChecks / totalChecks) * 100),
      };
    },
    refetchInterval: LIVE_HEALTH_POLL_MS,
    retry: 3,
    retryDelay: 2000,
  });

  if (isLoading) return null;

  const plan = isAuthenticated ? sub?.subscription?.plan ?? "free" : "premium";
  const modules = [
    { name: "auth", ok: healthData?.auth, ms: healthData?.probes.find((probe) => probe.key === "auth")?.durationMs },
    { name: "billing", ok: healthData?.billing, ms: healthData?.probes.find((probe) => probe.key === "billing")?.durationMs },
    { name: "users", ok: healthData?.users, ms: healthData?.probes.find((probe) => probe.key === "users")?.durationMs },
    { name: "v2", ok: healthData?.v2, ms: healthData?.probes.find((probe) => probe.key === "v2")?.durationMs },
  ];

  const liveLatency = healthData?.avgLatencyMs ?? 0;
  const liveSpeed = healthData?.checksPerMinute ?? 0;
  const liveSuccessRate = healthData?.successRate ?? 0;
  const liveFreshness = healthData ? `updated ${timeAgo(healthData.refreshedAt)}` : "warming up";
  const liveCoverage = `${modules.filter(({ ok }) => ok).length}/${modules.length} live`;

  return (
    <Layout>
      <Head>
        <title>Overview | KeelStack Demo</title>
        <meta
          name="description"
          content="Live KeelStack demo showing auth, billing, jobs, AI usage, and real-time backend health metrics built to convert visitors into buyers."
        />
        <meta property="og:title" content="KeelStack Demo | Live backend value in seconds" />
        <meta
          property="og:description"
          content="Explore a live demo of the KeelStack Engine with real-time speed, latency, auth, billing, jobs, and AI controls."
        />
      </Head>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <p className="font-mono text-xs text-accent mb-1">KeelStack Engine — production-shaped live demo</p>
          <h1 className="font-display font-bold text-2xl text-fg">
            {isAuthenticated
              ? `Welcome${user?.email ? `, ${user.email.split("@")[0]}` : ""}`
              : "See the backend value in under 30 seconds"}
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            {isAuthenticated
              ? "Connected to your KeelStack Engine backend."
              : "Auth, billing, jobs, and AI controls are wired to a real engine so prospects can feel the product before they buy."}
          </p>
          <KeelStackHeroCallout />
        </div>

        {/* Live proof metrics */}
        <div
          className="mb-8 rounded-2xl border border-border p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(17,17,24,0.98), rgba(13,15,24,0.94) 52%, rgba(99,102,241,0.08))",
          }}
        >
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
                Live proof
              </p>
              <h2 className="font-display text-xl font-bold text-fg">Real-time speed, latency, and data</h2>
              <p className="mt-1 text-sm text-fg-muted">
                Measured directly from the demo&apos;s live health probes so the numbers move with the backend.
              </p>
            </div>
            <div className="rounded-full border border-border bg-bg/70 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.24em] text-fg-muted">
              Polling every {Math.round(LIVE_HEALTH_POLL_MS / 1000)}s
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <LiveMetricCard
              label="Latency"
              value={`${liveLatency.toLocaleString()} ms`}
              sub={`avg round-trip across ${modules.length} modules`}
              tone="text-accent"
            />
            <LiveMetricCard
              label="Speed"
              value={`${liveSpeed.toLocaleString()} checks/min`}
              sub={`live probes refreshed ${Math.round(LIVE_HEALTH_POLL_MS / 1000)}s apart`}
              tone="text-info"
            />
            <LiveMetricCard
              label="Data"
              value={liveCoverage}
              sub={`${liveSuccessRate}% success rate · ${liveFreshness}`}
              tone="text-success"
            />
            <LiveMetricCard
              label="Cycle"
              value={`${healthData?.cycleMs?.toLocaleString() ?? "—"} ms`}
              sub={`fastest ${healthData?.fastestLatencyMs?.toLocaleString() ?? "—"} ms · slowest ${healthData?.slowestLatencyMs?.toLocaleString() ?? "—"} ms`}
              tone="text-warning"
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {modules.map(({ name, ok, ms }) => (
              <div
                key={name}
                className="rounded-xl border border-border px-3 py-3"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">{name}</p>
                    <p className={`mt-1 text-sm font-semibold ${ok ? "text-success" : "text-danger"}`}>
                      {ok ? "Live" : "Offline"}
                    </p>
                  </div>
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      ok === undefined ? "bg-muted animate-pulse2" : ok ? "bg-success" : "bg-danger"
                    }`}
                  />
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${ok ? "bg-accent" : "bg-danger"}`}
                    style={{ width: `${Math.min(100, Math.max(12, 100 - (ms ?? 0) / 4))}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] font-mono text-fg-muted">
                  {ms ? `${ms.toLocaleString()} ms response` : "Waiting for live probe"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Current Plan"
            value={plan.toUpperCase()}
            valueClass={PLAN_COLORS[plan as SubscriptionPlan] ?? "text-fg"}
            sub={isAuthenticated ? `via ${sub?.subscription?.provider ?? "engine"}` : "public demo tenant"}
          />
          <StatCard
            label={isAuthenticated ? "User Role" : "Demo Mode"}
            value={isAuthenticated ? user?.role?.toUpperCase() ?? "—" : "PUBLIC"}
            valueClass="text-fg"
            sub={isAuthenticated ? "backend permissions" : "read/write allowed"}
          />
          <StatCard
            label="Account Security"
            value={isAuthenticated ? (user?.mfaEnabled ? "SECURE" : "UNPROTECTED") : "READY"}
            valueClass={isAuthenticated ? (user?.mfaEnabled ? "text-success" : "text-warning") : "text-accent"}
            sub={
              isAuthenticated 
                ? `${user?.emailVerified ? "Verified Identity" : "Unverified Identity"}${user?.mfaEnabled ? " + MFA" : ""}`
                : "Register → Login → MFA"
            }
          />
          <StatCard
            label="Active Identity"
            value={isAuthenticated ? (user?.email?.split("@")[0].toUpperCase() ?? "—") : "GUEST"}
            valueClass="text-fg"
            sub={isAuthenticated ? user?.email ?? "—" : "login to track usage"}
          />
        </div>

        {/* Module health */}
        <div
          className="rounded-xl border border-border p-6 mb-6"
          style={{ background: "var(--surface)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-sm text-fg uppercase tracking-wider">
              Engine Module Status
            </h2>
            <Link href="/dashboard" className="text-[10px] text-accent font-mono hover:underline">
              View Detailed Metrics →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {modules.map(({ name, ok }) => (
              <div
                key={name}
                className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5"
                style={{ background: "var(--bg)" }}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    ok === undefined
                      ? "bg-muted animate-pulse2"
                      : ok
                      ? "bg-success"
                      : "bg-danger"
                  }`}
                />
                <span className="font-mono text-xs text-fg-muted">/api/{name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">Next steps</p>
            <h2 className="font-display text-lg font-bold text-fg">Send visitors where the engine becomes obvious</h2>
          </div>
          <p className="hidden md:block text-xs text-fg-muted max-w-sm text-right">
            These routes show the parts of the product that usually close the sale: billing, jobs, and AI control.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <QuickCard
            title="Billing"
            desc="Show how revenue flows through KeelStack with idempotent billing and a clean provider abstraction."
            href="/billing"
            accent="text-info"
          />
          <QuickCard
            title="Background Jobs"
            desc="Demonstrate async reliability, retry handling, and queued work without making the buyer imagine the backend."
            href="/jobs"
            accent="text-warning"
          />
          <QuickCard
            title="AI Usage"
            desc="Show budget enforcement, live usage, and guardrails for AI spend in a way that feels instantly trustworthy."
            href="/llm"
            accent="text-accent"
          />
        </div>
      </div>
    </Layout>
  );
}

function KeelStackHeroCallout() {
  return (
    <div
      className="mt-5 rounded-2xl border border-border p-5"
      style={{
        background:
          "linear-gradient(135deg, rgba(99,102,241,0.16), rgba(17,17,24,0.94) 55%, rgba(59,130,246,0.12))",
      }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <KeelStackLogoMark size="large" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
                Built with
              </p>
              <h2 className="font-display text-xl font-bold text-fg">KeelStack Engine</h2>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
            This frontend is powered by KeelStack Engine for auth, billing, background jobs,
            and AI usage workflows.
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-fg-muted">
            The live dashboard stays public. Account-specific register, login, and MFA flows live
            in a separate auth demo.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="https://keelstack.me"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,1), rgba(59,130,246,0.92))",
              boxShadow: "0 12px 28px rgba(99,102,241,0.28)",
            }}
          >
            Visit keelstack.me
          </a>
          <Link
            href="/auth-demo"
            className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-accent/50 hover:text-accent"
            style={{ background: "rgba(17,17,24,0.66)" }}
          >
            Try Auth Demo
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass,
  sub,
}: {
  label: string;
  value: string;
  valueClass: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-xl border border-border p-4"
      style={{ background: "var(--surface)" }}
    >
      <p className="text-xs font-mono text-fg-muted mb-2 uppercase tracking-wider">{label}</p>
      <p className={`font-display font-bold text-lg ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function QuickCard({
  title,
  desc,
  href,
  accent,
}: {
  title: string;
  desc: string;
  href: string;
  accent: string;
}) {
  return (
    <a
      href={href}
      className="group rounded-xl border border-border p-5 hover:border-accent/50 transition-all"
      style={{ background: "var(--surface)" }}
    >
      <h3 className={`font-display font-semibold text-sm mb-2 ${accent}`}>{title}</h3>
      <p className="text-xs text-fg-muted leading-relaxed">{desc}</p>
      <p className="text-xs text-accent mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        Open →
      </p>
    </a>
  );
}

function LiveMetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-fg-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${tone}`}>{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-fg-muted">{sub}</p>
    </div>
  );
}

function timeAgo(isoString: string) {
  const timestamp = new Date(isoString).getTime();
  const deltaMs = Math.max(0, Date.now() - timestamp);

  if (deltaMs < 1000) return "just now";
  if (deltaMs < 60_000) return `${Math.round(deltaMs / 1000)}s ago`;
  return `${Math.round(deltaMs / 60_000)}m ago`;
}
