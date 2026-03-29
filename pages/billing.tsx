import Head from "next/head";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { useAuth } from "../lib/auth-context";
import {
  billingApi,
  tokenStore,
  extractApiError,
  type BillingProvider,
  type SubscriptionPlan,
  type KSSubscription,
} from "../lib/api-client";

const PLANS: { plan: SubscriptionPlan; label: string; desc: string; price: string }[] = [
  { plan: "free", label: "Free", desc: "For solo builders and evaluation.", price: "$0" },
  { plan: "basic", label: "Basic", desc: "For small teams and early-stage products.", price: "$29/mo" },
  { plan: "premium", label: "Premium", desc: "For production workloads and growth.", price: "$99/mo" },
];

// Only Stripe has a real gateway implementation in the engine.
// Paddle, Razorpay, and PayPal exist as sandbox stubs only — selecting them
// in production will use the BaseSandboxGateway (fake UUIDs, no real charges).
const PROVIDERS: { id: BillingProvider; label: string; live: boolean }[] = [
  { id: "stripe",   label: "Stripe",   live: true  },
  { id: "paddle",   label: "Paddle",   live: false },
  { id: "razorpay", label: "Razorpay", live: false },
  { id: "paypal",   label: "PayPal",   live: false },
];

export default function BillingPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const qc = useQueryClient();

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("basic");
  const [selectedProvider, setSelectedProvider] = useState<BillingProvider>("stripe");
  const [lastResponse, setLastResponse] = useState<Record<string, unknown> | null>(null);
  const [lastIdempotencyKey, setLastIdempotencyKey] = useState<string>("");
  const [mockWebhookData, setMockWebhookData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ["billing", "current"],
    queryFn: () => billingApi.getCurrentSubscription(),
    enabled: isAuthenticated,
    retry: false,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      // Use the stored tenantId — set by storeSession() on login, mirrors x-tenant-id header
      const tenantId = tokenStore.getTenantId() ?? user?.id ?? "demo-tenant";
      const customerEmail = user?.email ?? "demo@example.com";
      const key = `ks-ui-${tenantId}-${selectedPlan}-${Date.now()}`;
      setLastIdempotencyKey(key);
      return billingApi.createSubscription({
        tenantId,
        customerEmail,
        provider: selectedProvider,
        plan: selectedPlan,
      });
    },
    onSuccess: (data) => {
      setLastResponse(data as Record<string, unknown>);
      setError("");
      qc.invalidateQueries({ queryKey: ["billing", "current"] });
    },
    onError: (err) => setError(extractApiError(err).message),
  });

  const mockWebhookMut = useMutation({
    mutationFn: () => billingApi.getMockWebhook(selectedProvider),
    onSuccess: (data) => setMockWebhookData(data as Record<string, unknown>),
    onError: (err) => setError(extractApiError(err).message),
  });

  if (isLoading) return null;

  const sub: KSSubscription | null =
    isAuthenticated
      ? subData?.subscription ?? null
      : {
          tenantId: "demo-tenant",
          customerEmail: "demo@keelstack.me",
          provider: "stripe",
          plan: "premium",
          status: "active",
          providerSubscriptionId: "sub_demo_keelstack",
        };

  return (
    <Layout>
      <Head>
        <title>Billing | KeelStack Demo</title>
      </Head>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div>
          <p className="font-mono text-xs text-info mb-1">billing module</p>
          <h1 className="font-display font-bold text-2xl text-fg">Billing</h1>
          <p className="text-sm text-fg-muted mt-1">
            Subscription management backed by KeelStack&apos;s idempotent webhook pipeline.
          </p>
          {!isAuthenticated && (
            <p className="mt-3 text-xs text-fg-muted">
              This page stays public for demo viewing. User-specific subscription changes are
              unlocked through the{" "}
              <Link href="/auth-demo" className="text-accent hover:underline">
                Auth Demo
              </Link>
              .
            </p>
          )}
        </div>

        {/* Current subscription */}
        <div
          className="rounded-xl border border-border p-6"
          style={{ background: "var(--surface)" }}
        >
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-fg mb-4">
            Current Subscription
          </h2>
          {isAuthenticated && subLoading ? (
            <SkeletonRow />
          ) : sub ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Plan" value={sub.plan.toUpperCase()} valueClass="text-accent font-mono" />
              <Field label="Provider" value={sub.provider} valueClass="font-mono text-fg" />
              <Field label="Status" value={sub.status ?? "active"} valueClass="text-success font-mono" />
              <Field
                label="Provider Sub ID"
                value={sub.providerSubscriptionId ?? "—"}
                valueClass="font-mono text-fg-muted text-xs"
              />
            </div>
          ) : (
            <p className="text-sm text-fg-muted">No active subscription.</p>
          )}
        </div>

        {/* Plan selection + create */}
        <div
          className="rounded-xl border border-border p-6"
          style={{ background: "var(--surface)" }}
        >
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-fg mb-4">
            Change Plan
          </h2>

          {/* Plan picker */}
          <div className="grid md:grid-cols-3 gap-3 mb-5">
            {PLANS.map(({ plan, label, desc, price }) => (
              <button
                key={plan}
                onClick={() => setSelectedPlan(plan)}
                className={`text-left rounded-lg border p-4 transition-all ${
                  selectedPlan === plan
                    ? "border-accent bg-accent-glow"
                    : "border-border hover:border-muted"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-display font-semibold text-sm text-fg">{label}</span>
                  <span className="font-mono text-xs text-fg-muted">{price}</span>
                </div>
                <p className="text-xs text-fg-muted">{desc}</p>
              </button>
            ))}
          </div>

          {/* Provider picker */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="text-xs text-fg-muted mr-1">Provider:</span>
            {PROVIDERS.map(({ id, label, live }) => (
              <button
                key={id}
                onClick={() => setSelectedProvider(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono border transition-all ${
                  selectedProvider === id
                    ? "border-accent bg-accent-glow text-accent"
                    : "border-border text-fg-muted hover:border-muted"
                }`}
              >
                {label}
                <span className={`text-xs px-1 rounded ${live ? "text-success" : "text-muted"}`}>
                  {live ? "live" : "sandbox"}
                </span>
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !isAuthenticated}
            className="bg-accent hover:bg-accent-dim text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {!isAuthenticated
              ? "Create / Upgrade Subscription via Auth Demo"
              : createMut.isPending
              ? "Creating…"
              : "Create / Upgrade Subscription"}
          </button>
        </div>

        {/* Idempotency explainer — fires after any create attempt */}
        {lastIdempotencyKey && (
          <PatternCard
            title="Idempotency Key"
            badge="KeelStack Pattern"
            badgeColor="bg-accent/10 text-accent border-accent/20"
            description={
              <>
                Every subscription mutation in KeelStack generates an{" "}
                <code className="font-mono text-accent text-xs">x-idempotency-key</code>. If the
                same key arrives twice (network retry, duplicate webhook), the engine returns the
                original response without double-processing. The key is stored in Redis with a 24h
                TTL via <code className="font-mono text-accent text-xs">IdempotencyStore.tryClaimKey()</code>.
              </>
            }
          >
            <KeyValueBlock
              rows={[
                { key: "Generated key", value: lastIdempotencyKey },
                { key: "Header sent", value: "x-idempotency-key" },
                { key: "Engine behaviour", value: "Redis SET NX — atomic claim, no race condition" },
                { key: "TTL", value: "86400s (24h)" },
              ]}
            />
          </PatternCard>
        )}

        {/* Subscription response */}
        {lastResponse && (
          <PatternCard
            title="Subscription Response + Correlation"
            badge="KeelStack Pattern"
            badgeColor="bg-info/10 text-info border-info/20"
            description={
              <>
                The engine attaches a <code className="font-mono text-info text-xs">requestId</code> to
                every response via <code className="font-mono text-info text-xs">RequestId</code>{" "}
                middleware. This propagates through webhook processing as a{" "}
                <code className="font-mono text-info text-xs">correlation.requestId</code> — making the
                full request-to-webhook chain traceable without a separate tracing backend.
              </>
            }
          >
            <pre className="font-mono text-xs text-fg-muted bg-bg rounded-lg p-4 overflow-x-auto border border-border leading-relaxed">
              {JSON.stringify(lastResponse, null, 2)}
            </pre>
          </PatternCard>
        )}

        {/* Mock webhook viewer */}
        <div
          className="rounded-xl border border-border p-6"
          style={{ background: "var(--surface)" }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-fg">
                Webhook Deduplication Demo
              </h2>
              <p className="text-xs text-fg-muted mt-1">
                Fetch the mock webhook payload for the selected provider. All four providers
                share the same sandbox normalisation path — only Stripe has a real gateway
                implementation in the engine.
              </p>
            </div>
            <button
              onClick={() => mockWebhookMut.mutate()}
              disabled={mockWebhookMut.isPending}
              className="shrink-0 border border-border hover:border-accent text-fg-muted hover:text-fg px-4 py-2 rounded-lg text-xs font-mono transition-all disabled:opacity-50"
            >
              {mockWebhookMut.isPending ? "Fetching…" : `GET /webhooks/mock/${selectedProvider}`}
            </button>
          </div>

          {mockWebhookData && (
            <PatternCard
              title="Normalized Webhook Envelope"
              badge="Dedup Layer"
              badgeColor="bg-warning/10 text-warning border-warning/20"
              description={
                <>
                  Before processing, KeelStack calls{" "}
                  <code className="font-mono text-warning text-xs">gateway.normalizeWebhookEvent()</code>{" "}
                  to extract a canonical <code className="font-mono text-warning text-xs">eventType</code>{" "}
                  and <code className="font-mono text-warning text-xs">subscriptionId</code>. The idempotency
                  key is built as{" "}
                  <code className="font-mono text-warning text-xs">
                    {"`${provider}:${eventType}:${subscriptionId}`"}
                  </code>
                  . If Stripe retries the webhook, the second attempt returns{" "}
                  <code className="font-mono text-warning text-xs">
                    {"{ processed: true, duplicate: true }"}
                  </code>{" "}
                  without re-executing billing logic.
                </>
              }
            >
              <pre className="font-mono text-xs text-fg-muted bg-bg rounded-lg p-4 overflow-x-auto border border-border leading-relaxed">
                {JSON.stringify(mockWebhookData, null, 2)}
              </pre>
            </PatternCard>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs text-fg-muted mb-1">{label}</p>
      <p className={`text-sm ${valueClass ?? "text-fg"}`}>{value}</p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex-1 h-10 rounded-md bg-border animate-pulse2" />
      ))}
    </div>
  );
}

function PatternCard({
  title,
  badge,
  badgeColor,
  description,
  children,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ background: "var(--surface)" }}>
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-mono px-2 py-0.5 rounded border ${badgeColor}`}>
            {badge}
          </span>
          <h3 className="font-display font-semibold text-sm text-fg">{title}</h3>
        </div>
        <p className="text-xs text-fg-muted leading-relaxed">{description}</p>
      </div>
      {children && <div className="p-6">{children}</div>}
    </div>
  );
}

function KeyValueBlock({ rows }: { rows: { key: string; value: string }[] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-bg">
      {rows.map(({ key, value }, i) => (
        <div
          key={i}
          className={`flex items-start gap-4 px-4 py-2.5 ${i < rows.length - 1 ? "border-b border-border" : ""}`}
        >
          <span className="font-mono text-xs text-fg-muted w-36 shrink-0 pt-px">{key}</span>
          <span className="font-mono text-xs text-fg break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}
