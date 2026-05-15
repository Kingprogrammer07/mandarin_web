import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from "@vercel/speed-insights/react"
import './index.css'
import App from './App.tsx'
// import eruda from 'eruda';

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

// After a new Vercel deploy, old chunk hashes no longer exist on the CDN.
// Users with the old app open will get 404s on dynamic imports — force a
// hard reload so they pick up the new bundle automatically.
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  if (
    event.reason instanceof TypeError &&
    event.reason.message.includes('dynamically imported module')
  ) {
    window.location.reload();
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <App />
        <Analytics />
        <SpeedInsights />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
