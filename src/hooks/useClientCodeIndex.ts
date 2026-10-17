import { useEffect, useState } from "react";

import { getClientCodeIndex } from "@/api/services/cargo";
import { buildClientCodeIndex, type ClientCodeIndex } from "@/lib/clientCodeCompletion";
import { clientCodeIndexStore } from "@/utils/clientCodeIndexStore";

/** How old the saved client list may get before it is downloaded again. */
const CLIENTS_REFRESH_MS = 30 * 60_000;

/**
 * All client codes plus `flightName`'s expected-cargo codes, for completing
 * codes on the device. Starts from the saved copy, then refreshes online:
 * the client list when it is older than CLIENTS_REFRESH_MS, the flight's codes
 * every time. Null until a list is available; the form then asks the server.
 */
export function useClientCodeIndex(flightName: string): ClientCodeIndex | null {
  const [index, setIndex] = useState<ClientCodeIndex | null>(null);

  useEffect(() => {
    let cancelled = false;
    let clients: { codes: string[][]; savedAt: number } | null = null;

    const refresh = async () => {
      if (!navigator.onLine) return;
      const needClients = !clients || Date.now() - clients.savedAt > CLIENTS_REFRESH_MS;
      try {
        const res = await getClientCodeIndex(flightName, needClients);
        if (cancelled) return;
        if (res.clients) {
          clients = { codes: res.clients, savedAt: Date.now() };
          void clientCodeIndexStore.saveClients(res.clients);
        }
        void clientCodeIndexStore.saveFlightCodes(flightName, res.flight_codes);
        if (clients) setIndex(buildClientCodeIndex(clients.codes, res.flight_codes));
      } catch {
        // Keep the saved list; online the server lookup still answers.
      }
    };

    void (async () => {
      const [savedClients, savedFlight] = await Promise.all([
        clientCodeIndexStore.loadClients(),
        clientCodeIndexStore.loadFlightCodes(flightName),
      ]);
      if (cancelled) return;
      if (savedClients) {
        clients = savedClients;
        setIndex(buildClientCodeIndex(savedClients.codes, savedFlight?.codes ?? []));
      }
      await refresh();
    })();
    // The form can stay open for a whole shift.
    const timer = setInterval(() => void refresh(), CLIENTS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [flightName]);

  return index;
}
