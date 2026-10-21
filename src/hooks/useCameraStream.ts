import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import {
  canAttemptTorch,
  captureVideoFrame,
  cameraErrorMessage,
  clampZoom,
  normalizeZoomCapability,
  openPhotoCameraStream,
  type CameraMediaTrackConstraints,
  type CameraTrackCapabilities,
  type CameraTrackSettings,
  type CameraZoomCapability,
} from "@/lib/camera";

export type CameraStatus = "starting" | "ready" | "failed";

/** A cold camera on an older phone can take a few seconds to send a frame. */
const FIRST_FRAME_TIMEOUT_MS = 8000;
/** The barcode scanner may still be letting go of the camera. */
const BUSY_RETRY_DELAY_MS = 600;

export interface CameraStream {
  /** Goes on the `<video playsInline muted>` the stream is shown in. */
  videoRef: RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  /** Why the camera did not open; set when `status` is "failed". */
  error: string | null;
  zoomRange: CameraZoomCapability | null;
  zoom: number;
  setZoom: (value: number) => void;
  torchSupported: boolean;
  torchOn: boolean;
  torchBusy: boolean;
  toggleTorch: () => void;
  /** A torch or zoom the device refused. */
  controlError: string | null;
  /** The frame on screen as a JPEG; null if there is none yet. */
  capture: () => Promise<File | null>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function waitForFirstFrame(video: HTMLVideoElement, isCancelled: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = performance.now() + FIRST_FRAME_TIMEOUT_MS;
    const check = () => {
      if (isCancelled()) return resolve();
      if (video.videoWidth > 0 && video.videoHeight > 0) return resolve();
      if (performance.now() > deadline) {
        return reject(new DOMException("No frame from the camera", "AbortError"));
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

async function openWithOneRetry(): Promise<MediaStream> {
  try {
    return await openPhotoCameraStream();
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== "NotReadableError") throw error;
    await sleep(BUSY_RETRY_DELAY_MS);
    return openPhotoCameraStream();
  }
}

/**
 * The back camera, live in a `<video>`, from mount to unmount — the same
 * stream, torch and zoom as the cargo form's camera. Mount it only while the
 * camera is on screen: unmounting stops every track, so the phone's camera
 * light goes off and the barcode scanner can have the camera back.
 */
export function useCameraStream(): CameraStream {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<CameraStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const [zoomRange, setZoomRange] = useState<CameraZoomCapability | null>(null);
  const [zoom, setZoomValue] = useState(1);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchBusy, setTorchBusy] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    let stream: MediaStream | null = null;
    const video = videoRef.current;
    const stop = () => {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    void (async () => {
      try {
        const opened = await openWithOneRetry();
        stream = opened;
        if (cancelled) return stop();
        if (!video) throw new DOMException("No video element", "AbortError");
        const track = opened.getVideoTracks().find((item) => item.readyState === "live") ?? null;
        trackRef.current = track;
        video.srcObject = opened;
        // iOS starts a muted inline video without a gesture; a refusal here
        // still leaves the frames flowing on every phone this app runs on.
        await video.play().catch(() => undefined);
        await waitForFirstFrame(video, () => cancelled);
        if (cancelled) return stop();

        if (track && typeof track.getCapabilities === "function") {
          const capabilities = track.getCapabilities() as CameraTrackCapabilities;
          const settings = track.getSettings() as CameraTrackSettings;
          const range = normalizeZoomCapability(capabilities.zoom);
          setZoomRange(range);
          if (range) {
            setZoomValue(
              typeof settings.zoom === "number" && Number.isFinite(settings.zoom)
                ? clampZoom(settings.zoom, range)
                : range.min,
            );
          }
          setTorchSupported(canAttemptTorch(capabilities));
          setTorchOn(Boolean(settings.torch));
        }
        setStatus("ready");
      } catch (reason) {
        stop();
        if (cancelled) return;
        console.warn("Photo camera failed:", reason);
        setError(cameraErrorMessage(reason));
        setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      stop();
      trackRef.current = null;
      if (video) video.srcObject = null;
    };
  }, []);

  const setZoom = useCallback(
    (value: number) => {
      const track = trackRef.current;
      if (!track || !zoomRange) return;
      const next = clampZoom(value, zoomRange);
      setZoomValue(next);
      track
        .applyConstraints({ advanced: [{ zoom: next }] } as CameraMediaTrackConstraints)
        .catch((reason: unknown) => console.warn("Camera zoom failed:", reason))
        .finally(() => {
          const settings = track.getSettings() as CameraTrackSettings;
          if (mountedRef.current && typeof settings.zoom === "number" && Number.isFinite(settings.zoom)) {
            setZoomValue(clampZoom(settings.zoom, zoomRange));
          }
        });
    },
    [zoomRange],
  );

  const toggleTorch = useCallback(() => {
    const track = trackRef.current;
    if (!track || !torchSupported || torchBusy) return;
    const wanted = !torchOn;
    // Some phones take the torch only through `advanced`, others only plain.
    const attempts: CameraMediaTrackConstraints[] = [
      { advanced: [{ torch: wanted }] },
      { torch: wanted },
    ];
    setTorchBusy(true);
    setControlError(null);
    void (async () => {
      let applied = false;
      for (const constraints of attempts) {
        try {
          await track.applyConstraints(constraints);
          applied = true;
          break;
        } catch (reason) {
          console.warn("Torch toggle failed:", reason);
        }
      }
      if (!mountedRef.current) return;
      const settings = track.getSettings() as CameraTrackSettings;
      setTorchOn(applied ? (typeof settings.torch === "boolean" ? settings.torch : wanted) : Boolean(settings.torch));
      if (!applied) setControlError("Chiroqni yoqib bo'lmadi. Qurilma buni qo'llamasligi mumkin.");
      setTorchBusy(false);
    })();
  }, [torchBusy, torchOn, torchSupported]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || status !== "ready") return null;
    return captureVideoFrame(video, `astatka-${Date.now()}.jpg`);
  }, [status]);

  return {
    videoRef,
    status,
    error,
    zoomRange,
    zoom,
    setZoom,
    torchSupported,
    torchOn,
    torchBusy,
    toggleTorch,
    controlError,
    capture,
  };
}
