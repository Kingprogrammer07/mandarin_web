import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from "@vercel/speed-insights/react"
import { toast } from 'sonner'
import { flushPendingErrors } from '@/api/services/frontendErrors'
import './index.css'
import App from './App.tsx'
// import eruda from 'eruda';

// In-app dev console for mobile / Telegram WebApp (no native devtools there).
// Remove these two lines to disable.
// eruda.init();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      gcTime: 10 * 60 * 1000,
    },
  },
})

// Tracks whether we have already prompted the user about a stale bundle so
// repeated preload errors do not stack toasts.
let staleBundlePromptShown = false;

const promptForReloadIfStale = (reason: unknown): void => {
  if (staleBundlePromptShown) return;
  staleBundlePromptShown = true;

  if (reason !== undefined) {
    console.warn('[app] stale bundle detected', reason);
  }

  toast.message("Yangi versiya mavjud", {
    description: "Iltimos, sahifani yangilang.",
    duration: Infinity,
    action: {
      label: "Yangilash",
      onClick: () => window.location.reload(),
    },
  });
};

// After a new Vercel deploy, old chunk hashes no longer exist on the CDN.
// Previously we hard-reloaded immediately, which produced a request storm
// (HTML + every chunk + every asset) per affected tab. Surface a toast so
// the user decides when to reload, eliminating the storm.
window.addEventListener('vite:preloadError', (event) => {
  promptForReloadIfStale(event);
});
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  if (
    event.reason instanceof TypeError &&
    event.reason.message.includes('dynamically imported module')
  ) {
    promptForReloadIfStale(event.reason);
  }
});

// Register service worker in production only — enables PWA install prompt
// and offline shell caching without disrupting the Vite dev HMR workflow.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal — app works fine without the service worker
    });
  });
}

// Vercel Analytics / SpeedInsights beacons used to fire for every admin tab
// on every navigation. Admin sessions are long-lived (hours), generate the
// bulk of pageviews, and are not the audience these tools are meant to
// measure. Restrict them to client-facing routes only.
const isAdminPath = (path: string): boolean =>
  path === '/admin' ||
  path.startsWith('/admin/') ||
  path === '/pos' ||
  path.startsWith('/pos/') ||
  path === '/warehouse' ||
  path.startsWith('/warehouse/') ||
  path === '/manager' ||
  path.startsWith('/manager/') ||
  path === '/cargo' ||
  path.startsWith('/cargo/') ||
  path === '/flights' ||
  path.startsWith('/flights/');

const shouldEnableAnalytics = !isAdminPath(window.location.pathname);

// Drain any queued frontend errors on a relaxed cadence and at unload. The
// previous implementation called `flushPendingErrors` from every Axios
// response interceptor, multiplying queue-check overhead with traffic.
if (typeof window !== 'undefined') {
  const flush = () => {
    flushPendingErrors().catch(() => {});
  };
  window.setInterval(flush, 60_000);
  window.addEventListener('beforeunload', flush);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <App />
        {shouldEnableAnalytics && <Analytics />}
        {shouldEnableAnalytics && <SpeedInsights />}
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
