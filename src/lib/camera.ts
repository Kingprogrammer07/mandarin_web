/**
 * The phone camera for photos taken inside the app (not the barcode scanner).
 *
 * Shared by the cargo form's camera (`MultiPhotoUpload`) and the astatka's
 * (`useCameraStream`), so both ask for the same stream and write the same
 * picture: at most 1280px wide, JPEG at 0.7 — small enough for a Telegram
 * WebView's memory and a warehouse's mobile data.
 */

/** Widest picture written; caps RAM in the Telegram WebView. */
export const MAX_CANVAS_WIDTH = 1280;

/** Ideal getUserMedia resolution (720p, optimised for Telegram). */
export const IDEAL_WIDTH = 1280;
export const IDEAL_HEIGHT = 720;

export const JPEG_QUALITY = 0.7;

const DEFAULT_ZOOM_STEP = 0.1;

interface CameraNumericCapability {
  min?: number;
  max?: number;
  step?: number;
}

export interface CameraZoomCapability {
  min: number;
  max: number;
  step: number;
}

type CameraSupportedConstraints = MediaTrackSupportedConstraints & {
  torch?: boolean;
};

export type CameraTrackCapabilities = Omit<MediaTrackCapabilities, "torch" | "zoom"> & {
  torch?: boolean | boolean[];
  zoom?: CameraNumericCapability;
};

export type CameraTrackSettings = Omit<MediaTrackSettings, "torch" | "zoom"> & {
  torch?: boolean;
  zoom?: number;
};

export type CameraConstraintSet = MediaTrackConstraintSet & {
  torch?: boolean;
  zoom?: number;
};

export type CameraMediaTrackConstraints = MediaTrackConstraints & {
  torch?: boolean;
  zoom?: number;
  advanced?: CameraConstraintSet[];
};

export const normalizeZoomCapability = (
  range: CameraNumericCapability | undefined,
): CameraZoomCapability | null => {
  if (!range) return null;

  const min = typeof range.min === "number" && Number.isFinite(range.min) ? range.min : 1;
  const max = typeof range.max === "number" && Number.isFinite(range.max) ? range.max : min;

  if (max <= min) return null;

  const step =
    typeof range.step === "number" && Number.isFinite(range.step) && range.step > 0
      ? range.step
      : DEFAULT_ZOOM_STEP;

  return { min, max, step };
};

export const clampZoom = (value: number, range: CameraZoomCapability): number => {
  return Math.min(range.max, Math.max(range.min, value));
};

export const formatZoomValue = (value: number): string => {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
};

const isTorchCapabilityEnabled = (capabilities: CameraTrackCapabilities): boolean => {
  const torch = capabilities.torch;
  if (Array.isArray(torch)) return torch.includes(true);
  return torch === true;
};

export const canAttemptTorch = (capabilities: CameraTrackCapabilities): boolean => {
  if (isTorchCapabilityEnabled(capabilities)) return true;
  if (capabilities.torch === false) return false;

  const supportedConstraints =
    typeof navigator !== "undefined" && navigator.mediaDevices?.getSupportedConstraints
      ? (navigator.mediaDevices.getSupportedConstraints() as CameraSupportedConstraints)
      : null;

  return supportedConstraints?.torch === true;
};

/** The back camera, or the front one on a device that has no back camera. */
export async function openPhotoCameraStream(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("getUserMedia is not available", "NotSupportedError");
  }
  const constraints = (facingMode: "environment" | "user"): MediaStreamConstraints => ({
    video: { facingMode, width: { ideal: IDEAL_WIDTH }, height: { ideal: IDEAL_HEIGHT } },
    audio: false,
  });
  try {
    return await navigator.mediaDevices.getUserMedia(constraints("environment"));
  } catch (error) {
    // A refused permission is refused for the front camera too.
    if (error instanceof DOMException && error.name === "NotAllowedError") throw error;
    return navigator.mediaDevices.getUserMedia(constraints("user"));
  }
}

/** What the worker is told when the camera does not open. */
export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Kameraga ruxsat berilmadi. Telegram yoki brauzer sozlamalarida kamerani yoqing.";
    case "NotReadableError":
    case "AbortError":
      return "Kamera band. Boshqa ilova kamerani ishlatayotgan bo'lishi mumkin.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Kamera topilmadi.";
    case "NotSupportedError":
      return "Bu qurilmada ilova ichidagi kamera ishlamaydi.";
    default:
      return "Kamera ochilmadi.";
  }
}

/** The frame on screen as a JPEG file, or null if the video has no frame yet. */
export function captureVideoFrame(video: HTMLVideoElement, fileName: string): Promise<File | null> {
  if (video.videoWidth === 0 || video.videoHeight === 0) return Promise.resolve(null);
  const width = Math.min(video.videoWidth, MAX_CANVAS_WIDTH);
  const height = Math.round((width * video.videoHeight) / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  context.drawImage(video, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? new File([blob], fileName, { type: "image/jpeg" }) : null),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}
