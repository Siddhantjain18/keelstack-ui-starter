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

export default function OverviewPage() {
  const { isAuthenticated, isLoading, user } = useAuth();

  const { data: sub } = useQuery({
    queryKey: ["billing", "current"],
    queryFn: () => billingApi.getCurrentSubscription(),
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: healthData } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const [auth, billing, users, v2] = await Promise.allSettled([
        healthApi.auth(),
        healthApi.billing(),
        healthApi.users(),
        healthApi.v2(),
      ]);
      return {
        auth: auth.status === "fulfilled",
        billing: billing.status === "fulfilled",
        users: users.status === "fulfilled",
        v2: v2.status === "fulfilled",
      };
    },
    refetchInterval: 30_000,
  });

  if (isLoading) return null;

  const plan = isAuthenticated ? sub?.subscription?.plan ?? "free" : "premium";
  const modules = [
    { name: "auth", ok: healthData?.auth },
    { name: "billing", ok: healthData?.billing },
    { name: "users", ok: healthData?.users },
    { name: "v2", ok: healthData?.v2 },
  ];

  return (
    <Layout>
      <Head>
        <title>Overview | KeelStack Demo</title>
      </Head>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <p className="font-mono text-xs text-accent mb-1">KeelStack Engine — Live Demo</p>
          <h1 className="font-display font-bold text-2xl text-fg">
            {isAuthenticated
              ? `Welcome${user?.email ? `, ${user.email.split("@")[0]}` : ""}`
              : "Explore the live KeelStack demo"}
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            {isAuthenticated
              ? "Connected to your KeelStack Engine backend."
              : "See idempotency, jobs, and AI budget behavior before touching auth."}
          </p>
          <KeelStackHeroCallout />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Current Plan"
            value={plan.toUpperCase()}
            valueClass={PLAN_COLORS[plan as SubscriptionPlan] ?? "text-fg"}
            sub={isAuthenticated ? sub?.subscription?.provider ?? "—" : "public demo tenant"}
          />
          <StatCard
            label={isAuthenticated ? "Role" : "Mode"}
            value={isAuthenticated ? user?.role?.toUpperCase() ?? "—" : "PUBLIC"}
            valueClass="text-fg"
            sub={isAuthenticated ? "user role" : "no sign-in required"}
          />
          <StatCard
            label={isAuthenticated ? "MFA" : "Auth Demo"}
            value={isAuthenticated ? (user?.mfaEnabled ? "ENABLED" : "DISABLED") : "READY"}
            valueClass={isAuthenticated ? (user?.mfaEnabled ? "text-success" : "text-warning") : "text-accent"}
            sub={isAuthenticated ? "multi-factor auth" : "register, login, MFA"}
          />
          <StatCard
            label={isAuthenticated ? "Email" : "Entry Point"}
            value={isAuthenticated ? (user?.emailVerified ? "VERIFIED" : "UNVERIFIED") : "OPEN"}
            valueClass={isAuthenticated ? (user?.emailVerified ? "text-success" : "text-warning") : "text-success"}
            sub={isAuthenticated ? user?.email ?? "—" : "core product first"}
          />
        </div>

        {/* Module health */}
        <div
          className="rounded-xl border border-border p-6 mb-6"
          style={{ background: "var(--surface)" }}
        >
          <h2 className="font-display font-semibold text-sm text-fg mb-4 uppercase tracking-wider">
            Engine Module Status
          </h2>
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
        <div className="grid md:grid-cols-3 gap-4">
          <QuickCard
            title="Billing"
            desc="Manage subscriptions. Powered by KeelStack's idempotent webhook + Stripe gateway layer."
            href="/billing"
            accent="text-info"
          />
          <QuickCard
            title="Background Jobs"
            desc="Submit async tasks. KeelStack's RetryableJobRunner handles failure + re-enqueue."
            href="/jobs"
            accent="text-warning"
          />
          <QuickCard
            title="AI Usage"
            desc="Per-user token budgets enforced by LLMClient's boundary layer."
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
