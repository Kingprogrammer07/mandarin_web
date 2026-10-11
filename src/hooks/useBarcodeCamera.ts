import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

/** A bag held in front of the lens is read many times a second. */
const SAME_CODE_COOLDOWN_MS = 2000;

interface Options {
  /** DOM id of the element the video goes into. Must be mounted while active. */
  containerId: string;
  active: boolean;
  onCode: (code: string) => void;
  /** Called when the camera cannot start (no permission, no camera). */
  onError: (message: string) => void;
}

/**
 * The phone camera as a barcode scanner, same engine and settings as the
 * expected-cargo scanner so a worker gets the same behaviour on both screens.
 */
export function useBarcodeCamera({ containerId, active, onCode, onError }: Options): void {
  const onCodeRef = useRef(onCode);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCodeRef.current = onCode;
    onErrorRef.current = onError;
  }, [onCode, onError]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let last: { code: string; at: number } | null = null;
    const scanner = new Html5Qrcode(containerId, {
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      verbose: false,
    });

    const started = scanner
      .start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 280, height: 150 } },
        (decoded) => {
          const code = decoded.trim();
          const now = Date.now();
          if (!code) return;
          if (last && last.code === code && now - last.at < SAME_CODE_COOLDOWN_MS) return;
          last = { code, at: now };
          onCodeRef.current(code);
        },
        () => {},
      )
      .then(() => true)
      .catch(() => {
        if (!cancelled) {
          onErrorRef.current(
            "Kamera ochilmadi. Brauzer sozlamalarida kameraga ruxsat bering.",
          );
        }
        return false;
      });

    return () => {
      cancelled = true;
      void started.then((running) => {
        if (running) scanner.stop().catch(() => {});
      });
    };
  }, [active, containerId]);
}
