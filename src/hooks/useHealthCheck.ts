import { useEffect } from "react";
import { useMaintenanceStore } from "@/store/useMaintenanceStore";
import { API_BASE_URL } from "@/config/config";

const POLL_INTERVAL_MS = 10_000;
const HEALTH_TIMEOUT_MS = 5_000;

export function useHealthCheck() {
  const isMaintenanceMode = useMaintenanceStore((s) => s.isMaintenanceMode);
  const clearMaintenance = useMaintenanceStore((s) => s.clearMaintenance);

  useEffect(() => {
    if (!isMaintenanceMode) return;

    let cancelled = false;

    const check = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
          cache: "no-store",
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

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isMaintenanceMode, clearMaintenance]);
}
