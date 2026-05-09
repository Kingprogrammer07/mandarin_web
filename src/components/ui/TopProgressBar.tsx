import { useEffect } from 'react';
import { useNavLoadingStore } from '@/store/navLoadingStore';

/**
 * Indeterminate top-of-viewport loading bar.
 * Used as a Suspense fallback indicator — no fake percentage, just a
 * sliding bar that signals "something is loading" without implying progress.
 * Side-effect: broadcasts loading state to navLoadingStore so FloatingNavbar
 * can mirror the animation while this bar is visible.
 */
export function TopProgressBar() {
  const setLoading = useNavLoadingStore((s) => s.setLoading);

  useEffect(() => {
    setLoading(true);
    return () => setLoading(false);
  }, [setLoading]);

  return (
    <div
      role="progressbar"
      aria-label="Yuklanmoqda"
      className="fixed top-0 inset-x-0 z-[9999] h-[3px] overflow-hidden pointer-events-none"
    >
      <div className="absolute inset-0 bg-orange-500/10" />
      <div
        className="absolute top-0 h-full bg-orange-500"
        style={{ animation: 'topbar-slide 1.6s cubic-bezier(0.4,0,0.2,1) infinite' }}
      />
      <style>{`
        @keyframes topbar-slide {
          0%   { left: -40%; right: 100%; }
          50%  { left:  20%; right: -30%; }
          100% { left: 100%; right: -40%; }
        }
      `}</style>
    </div>
  );
}
