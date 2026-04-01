import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { authApi, extractApiError } from "../../lib/api-client";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string>("");

  const params = useMemo(() => {
    const tokenParam = router.query.sessionToken;
    const refreshParam = router.query.refreshToken;
    const isNewUserParam = router.query.isNewUser;

    return {
      sessionToken: typeof tokenParam === "string" ? tokenParam : "",
      refreshToken: typeof refreshParam === "string" ? refreshParam : "",
      isNewUser: isNewUserParam === "true",
    };
  }, [router.query]);

  useEffect(() => {
    if (!router.isReady) return;

    if (!params.sessionToken || !params.refreshToken) {
      setError("OAuth callback is missing required session data.");
      return;
    }

    try {
      authApi.completeOAuthSession({
        sessionToken: params.sessionToken,
        refreshToken: params.refreshToken,
      });

      const destination = params.isNewUser ? "/auth/mfa?welcome=1" : "/auth/mfa";
      window.location.replace(destination);
    } catch (err) {
      const apiError = extractApiError(err);
      setError(apiError.message || "Could not complete OAuth sign-in.");
    }
  }, [params.isNewUser, params.refreshToken, params.sessionToken, router.isReady]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <Head>
        <title>Completing Sign-In | KeelStack Demo</title>
      </Head>
      <div className="w-full max-w-md rounded-xl border border-border p-6" style={{ background: "var(--surface)" }}>
        <h1 className="font-display font-bold text-xl text-fg mb-2">Completing sign-in</h1>
        {!error ? (
          <p className="text-sm text-fg-muted">Finalizing your secure session. You will be redirected shortly.</p>
        ) : (
          <>
            <p className="text-sm text-danger mb-4">{error}</p>
            <div className="flex gap-3 text-sm">
              <Link href="/auth/login" className="text-accent hover:underline">
                Back to sign in
              </Link>
              <Link href="/auth/error" className="text-accent hover:underline">
                Open auth error page
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
