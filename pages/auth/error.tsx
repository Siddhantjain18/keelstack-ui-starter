import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

export default function AuthErrorPage() {
  const router = useRouter();
  const errorValue = typeof router.query.error === "string" ? router.query.error : "unknown_error";

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <Head>
        <title>Auth Error | KeelStack Demo</title>
      </Head>
      <div className="w-full max-w-md rounded-xl border border-border p-6" style={{ background: "var(--surface)" }}>
        <p className="font-mono text-xs uppercase tracking-wider text-danger mb-2">OAuth error</p>
        <h1 className="font-display font-bold text-xl text-fg mb-3">Sign-in could not be completed</h1>
        <p className="text-sm text-fg-muted mb-2">The identity provider redirected back with an error.</p>
        <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2 mb-5">
          {decodeURIComponent(errorValue)}
        </p>
        <div className="flex gap-4 text-sm">
          <Link href="/auth/login" className="text-accent hover:underline">
            Try sign in again
          </Link>
          <Link href="/auth-demo" className="text-accent hover:underline">
            Back to auth demo
          </Link>
        </div>
      </div>
    </div>
  );
}
