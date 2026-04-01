import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../lib/auth-context";
import clsx from "clsx";
import {
  KeelStackBrandLink,
  KeelStackPoweredBadge,
  KeelStackSidebarCard,
} from "./KeelStackBrand";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: GridIcon },
  { href: "/auth-demo", label: "Auth Demo", icon: AuthDemoIcon },
  { href: "/auth/mfa", label: "MFA Settings", icon: ShieldIcon },
  { href: "/billing", label: "Billing", icon: BillingIcon },
  { href: "/jobs", label: "Jobs", icon: JobsIcon },
  { href: "/llm", label: "AI Usage", icon: AiIcon },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-bg text-fg">
      {/* Sidebar */}
      <aside
        className={clsx(
          "flex flex-col border-r border-border transition-all duration-300 shrink-0",
          collapsed ? "w-16" : "w-56"
        )}
        style={{ background: "var(--surface)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
          <KeelStackBrandLink compact={collapsed} />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-fg-muted hover:text-fg transition-colors"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all",
                  active
                    ? "bg-accent-glow text-accent font-medium"
                    : "text-fg-muted hover:text-fg hover:bg-white/5"
                )}
                title={collapsed ? label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-border p-3">
          {!collapsed && <KeelStackSidebarCard />}
          {user && !collapsed && (
            <div className="mb-2 px-2">
              <p className="text-xs text-fg-muted truncate">{user.email}</p>
              <p className="text-xs font-mono text-accent">{user.role}</p>
            </div>
          )}
          {isAuthenticated ? (
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-fg-muted hover:text-danger hover:bg-danger/10 transition-all"
              title={collapsed ? "Logout" : undefined}
            >
              <LogoutIcon className="w-4 h-4 shrink-0" />
              {!collapsed && "Logout"}
            </button>
          ) : (
            <Link
              href="/auth-demo"
              className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-fg-muted hover:text-accent hover:bg-accent/10 transition-all"
              title={collapsed ? "Try Auth Demo" : undefined}
            >
              <AuthDemoIcon className="w-4 h-4 shrink-0" />
              {!collapsed && "Try Auth Demo"}
            </Link>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Grid bg overlay */}
        <div
          className="fixed inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: "var(--tw-gradient-stops)",
            background:
              "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10 p-8 max-w-6xl mx-auto">
          <div className="mb-6 flex justify-end">
            <KeelStackPoweredBadge />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── Inline SVG icons ────────────────────────────────────────────────────────

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function BillingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );
}

function JobsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
    </svg>
  );
}

function AiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
}

function AuthDemoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 0h10.5A2.25 2.25 0 0119.5 12.75v5.25a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 18v-5.25A2.25 2.25 0 016.75 10.5z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m6 2.25c0 5.385-3.435 8.99-8.25 10.5C7.935 20.99 4.5 17.385 4.5 12V5.742a2.25 2.25 0 011.606-2.157l5.144-1.714a2.25 2.25 0 011.5 0l5.144 1.714A2.25 2.25 0 0119.5 5.742V12z" />
    </svg>
  );
}
