import { useEffect } from "react";
import { useMaintenanceStore } from "@/store/useMaintenanceStore";
import { API_BASE_URL } from "@/config/config";

const POLL_INTERVAL_MS = 60_000;
const HEALTH_TIMEOUT_MS = 5_000;

export function useHealthCheck() {
  const isMaintenanceMode = useMaintenanceStore((s) => s.isMaintenanceMode);
  const clearMaintenance = useMaintenanceStore((s) => s.clearMaintenance);

  useEffect(() => {
    if (!isMaintenanceMode) return;

    let cancelled = false;

    const check = async () => {
      // Hidden tabs previously each hammered /health every 10s during any
      // hiccup. Skip while hidden — the visibility listener below catches up
      // when the user returns.
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }

      try {
        const resp = await fetch(`${API_BASE_URL}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        });
        if (!cancelled && resp.ok) {
          clearMaintenance();
        }
      } catch {
        // server still down — next interval will retry
      }
    };

    check(); // immediate first check
    const interval = setInterval(check, POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isMaintenanceMode, clearMaintenance]);
}
