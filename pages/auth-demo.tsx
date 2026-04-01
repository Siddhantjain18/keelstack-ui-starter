import Head from "next/head";
import Link from "next/link";
import Layout from "../components/Layout";
import { KeelStackBrandLink, KeelStackLogoMark } from "../components/KeelStackBrand";
import { useAuth } from "../lib/auth-context";

const STEPS = [
  {
    title: "Register a demo account",
    desc: "Create a fresh account against the live engine to see the real validation and verification flow.",
    href: "/auth/register",
    cta: "Start with Register",
  },
  {
    title: "Sign in with password or OAuth",
    desc: "Use email/password, Google Sign-In, or Sign in with Apple against the live backend auth routes.",
    href: "/auth/login",
    cta: "Open Login Demo",
  },
  {
    title: "Manage MFA after login",
    desc: "Run enable request/confirm and disable request/confirm from the authenticated MFA settings page.",
    href: "/auth/mfa",
    cta: "Open MFA Settings",
  },
];

export default function AuthDemoPage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Layout>
      <Head>
        <title>Auth Demo | KeelStack Demo</title>
      </Head>
      <div className="animate-fade-in space-y-6">
        <div
          className="rounded-2xl border border-border p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(17,17,24,0.95) 55%, rgba(59,130,246,0.12))",
          }}
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-accent mb-2">
                Dedicated Auth Demo
              </p>
              <h1 className="font-display text-3xl font-bold text-fg">Try the full auth flow separately</h1>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">
                The main KeelStack demo stays open so visitors can feel the product first. This page
                is the dedicated place for register, login, MFA, and account-specific secure flows.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={isAuthenticated ? "/billing" : "/auth/login"}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                  style={{
                    background: "linear-gradient(135deg, rgba(99,102,241,1), rgba(59,130,246,0.92))",
                    boxShadow: "0 12px 28px rgba(99,102,241,0.28)",
                  }}
                >
                  {isAuthenticated ? "Continue secure demo" : "Start Auth Demo"}
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-accent/50 hover:text-accent"
                  style={{ background: "rgba(17,17,24,0.66)" }}
                >
                  Back to public demo
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 p-4 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-3">
                <KeelStackLogoMark size="large" />
                <div>
                  <p className="font-display text-lg font-semibold text-fg">KeelStack Engine</p>
                  <p className="text-xs text-fg-muted">Sharable auth-specific flow</p>
                </div>
              </div>
              <ul className="space-y-2 text-xs text-fg-muted">
                <li>Register and email verification</li>
                <li>Login with password, Google, or Apple</li>
                <li>MFA enable/disable request + confirm</li>
              </ul>
            </div>
          </div>
        </div>

        {isAuthenticated && (
          <div className="rounded-xl border border-success/20 bg-success/5 p-5">
            <p className="font-mono text-xs uppercase tracking-wider text-success mb-2">
              Session active
            </p>
            <p className="text-sm text-fg-muted">
              Signed in as <span className="text-fg">{user?.email ?? "demo user"}</span>. You can
              keep exploring the secure pages directly, or open login/register again to replay the flow.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map(({ title, desc, href, cta }) => (
            <Link
              key={title}
              href={href}
              className="rounded-xl border border-border p-5 transition-all hover:border-accent/50"
              style={{ background: "var(--surface)" }}
            >
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">Step</p>
              <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{desc}</p>
              <p className="mt-4 text-sm font-medium text-accent">{cta} →</p>
            </Link>
          ))}
        </div>

        <div className="rounded-xl border border-border p-6" style={{ background: "var(--surface)" }}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-fg">Why this split works for the demo</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-fg-muted">
                KeelStack’s product behaviors stay instantly accessible on the public dashboard,
                while auth remains a dedicated, shareable path for login, MFA, and secure actions.
              </p>
            </div>
            <KeelStackBrandLink showCaption={false} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
