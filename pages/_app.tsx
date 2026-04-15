import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../lib/auth-context";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Toaster } from "react-hot-toast";
import "../styles/globals.css";
import { healthApi } from "../lib/api-client";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App({ Component, pageProps }: AppProps) {
  // Global pre-warmup for Render free tier.
  // Firing a ping on mount starts the cold start process immediately.
  useEffect(() => {
    // Silence errors to keep it invisible to the user
    healthApi.auth().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Component {...pageProps} />
        <Toaster position="bottom-right" toastOptions={{ style: { background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)' } }} />
        <Analytics/>
        <SpeedInsights/>
      </AuthProvider>
    </QueryClientProvider>
  );
}
