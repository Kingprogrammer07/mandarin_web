import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CameraOff, Flashlight, FlashlightOff, Images, Loader2, X, ZoomIn } from "lucide-react";

import { useCameraStream } from "@/hooks/useCameraStream";
import { useTelegramVerticalSwipesOff } from "@/hooks/useTelegramVerticalSwipesOff";
import { formatZoomValue } from "@/lib/camera";
import { holdPhotoCamera } from "@/lib/photoCameraActivity";
import { cn } from "@/lib/utils";
import { triggerSoftHaptic } from "@/utils/haptics";

export interface CameraCaptureProps {
  /**
   * "one": the first photo is the answer (re-take one photo, add one).
   * "many": photos pile up below the viewfinder until «Tayyor».
   */
  mode: "one" | "many";
  /** How many photos this session may take; at least 1. */
  max: number;
  title: string;
  /** One line under the title on what saving does, e.g. that old photos go. */
  note?: string;
  onDone: (files: File[]) => void;
  onClose: () => void;
}

const FLASH_MS = 140;

const roundButton =
  "flex h-11 w-11 items-center justify-center rounded-full text-mc-text active:scale-95 disabled:opacity-40";

/**
 * The astatka's photo camera: the phone's back camera inside the app, as in
 * the cargo form, instead of a file picker that lands in the gallery. The
 * gallery stays one tap away for a photo taken earlier, and is the way out
 * when the camera cannot open.
 */
export function CameraCapture(props: CameraCaptureProps) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && props.onClose()}>
      <DialogPrimitive.Portal>
        {/* `dark` pins the dark token set: a viewfinder is black in both themes. */}
        <DialogPrimitive.Overlay className="dark fixed inset-0 z-[70] bg-black" />
        <DialogPrimitive.Content
          aria-modal="true"
          className="dark fixed inset-0 z-[70] flex flex-col bg-mc-bg text-mc-text outline-none"
        >
          <CameraBody {...props} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function CameraBody({ mode, max, title, note, onDone }: CameraCaptureProps) {
  // Before the stream asks for the camera: the barcode scanner lets go of it.
  useEffect(() => holdPhotoCamera(), []);
  useTelegramVerticalSwipesOff();
  const camera = useCameraStream();
  const galleryRef = useRef<HTMLInputElement>(null);
  const zoomId = useId();
  const [shots, setShots] = useState<File[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState(false);

  const limit = Math.max(1, max);
  const full = shots.length >= limit;
  const many = mode === "many";

  const previews = useMemo(() => shots.map((file) => URL.createObjectURL(file)), [shots]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(false), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const accept = (files: File[]) => {
    if (files.length === 0) return;
    if (!many) {
      onDone(files.slice(0, 1));
      return;
    }
    setShots((current) => [...current, ...files].slice(0, limit));
  };

  const shoot = async () => {
    if (capturing || full || camera.status !== "ready") return;
    setCapturing(true);
    try {
      const file = await camera.capture();
      if (!file) return;
      triggerSoftHaptic();
      setFlash(true);
      accept([file]);
    } finally {
      setCapturing(false);
    }
  };

  const pickFromGallery = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    accept(files);
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-1 px-2 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <DialogPrimitive.Close aria-label="Yopish" className={roundButton}>
          <X className="h-6 w-6" />
        </DialogPrimitive.Close>
        <div className="min-w-0 flex-1 px-1">
          <DialogPrimitive.Title className="break-words text-[15px] font-extrabold text-mc-text">
            {title}
          </DialogPrimitive.Title>
          {note ? (
            <DialogPrimitive.Description className="text-[12px] font-medium text-mc-text-2">
              {note}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">
              Yukni kameraga tutib, pastdagi doira tugmasini bosing.
            </DialogPrimitive.Description>
          )}
        </div>
        {camera.status === "ready" && camera.torchSupported && (
          <button
            type="button"
            onClick={camera.toggleTorch}
            disabled={camera.torchBusy}
            aria-pressed={camera.torchOn}
            aria-label={camera.torchOn ? "Chiroqni o'chirish" : "Chiroqni yoqish"}
            className={cn(roundButton, camera.torchOn && "bg-mc-warn text-mc-on-warn")}
          >
            {camera.torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {/* `contain`, not `cover`: the photo is exactly the frame on screen. */}
        <video
          ref={camera.videoRef}
          autoPlay
          playsInline
          muted
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-contain"
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 bg-mc-text transition-opacity duration-150",
            flash ? "opacity-60" : "opacity-0",
          )}
        />

        {camera.status === "starting" && (
          <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-mc-text-2" />
            <p className="text-[13px] font-semibold text-mc-text-2">Kamera ochilmoqda…</p>
          </div>
        )}

        {camera.status === "failed" && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <CameraOff className="h-8 w-8 text-mc-text-3" />
            <p className="max-w-xs text-[14px] font-semibold text-mc-text">{camera.error}</p>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="mt-1 flex h-12 items-center gap-2 rounded-mc-md bg-mc-brand px-5 text-[14px] font-extrabold text-mc-on-brand active:scale-[0.97]"
            >
              <Images className="h-5 w-5" />
              Galereyadan tanlash
            </button>
          </div>
        )}

        {camera.status === "ready" && (camera.zoomRange || camera.controlError) && (
          <div className="absolute inset-x-3 bottom-3 space-y-2">
            {camera.controlError && (
              <p role="status" className="rounded-mc-sm bg-mc-bg/80 px-3 py-2 text-center text-[12px] font-semibold text-mc-warn">
                {camera.controlError}
              </p>
            )}
            {camera.zoomRange && (
              <div className="flex items-center gap-3 rounded-mc-md bg-mc-bg/70 px-3 py-2">
                <ZoomIn className="h-5 w-5 shrink-0 text-mc-text-2" aria-hidden="true" />
                <label htmlFor={zoomId} className="sr-only">
                  Yaqinlashtirish
                </label>
                <input
                  id={zoomId}
                  type="range"
                  min={camera.zoomRange.min}
                  max={camera.zoomRange.max}
                  step={camera.zoomRange.step}
                  value={camera.zoom}
                  onChange={(event) => camera.setZoom(Number(event.target.value))}
                  className="h-11 min-w-0 flex-1 accent-mc-brand"
                />
                <span className="w-10 shrink-0 text-right text-[13px] font-bold tabular-nums text-mc-text">
                  {formatZoomValue(camera.zoom)}x
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {many && shots.length > 0 && (
        <ul aria-label="Olingan rasmlar" className="flex shrink-0 gap-2 overflow-x-auto overscroll-x-contain px-3 pt-3">
          {previews.map((url, index) => (
            <li key={url} className="relative shrink-0">
              <img
                src={url}
                alt={`${index + 1}-rasm`}
                className="h-16 w-16 rounded-mc-sm border border-mc-border object-cover"
              />
              <button
                type="button"
                onClick={() => setShots((current) => current.filter((_, at) => at !== index))}
                aria-label={`${index + 1}-rasmni o'chirish`}
                // The badge is small; the button around it is the 44px target.
                className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center active:scale-90"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mc-danger-fill text-mc-on-danger">
                  <X className="h-3.5 w-3.5" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={full}
          className="flex min-h-11 flex-col items-center justify-center justify-self-start rounded-mc-sm px-2 text-mc-text-2 active:scale-95 disabled:opacity-40"
        >
          <Images className="h-6 w-6" />
          <span className="text-[11px] font-semibold">Galereya</span>
        </button>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => void shoot()}
            disabled={camera.status !== "ready" || capturing || full}
            aria-label="Rasmga olish"
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-mc-text active:scale-95 disabled:opacity-40"
          >
            <span className="h-14 w-14 rounded-full bg-mc-text" />
          </button>
          {many && (
            <span className="text-[11px] font-semibold tabular-nums text-mc-text-2">
              {shots.length} / {limit}
            </span>
          )}
        </div>

        {many ? (
          <button
            type="button"
            onClick={() => onDone(shots)}
            disabled={shots.length === 0}
            className="flex h-11 items-center justify-center justify-self-end rounded-mc-md bg-mc-brand px-4 text-[14px] font-extrabold text-mc-on-brand active:scale-[0.97] disabled:opacity-40"
          >
            Tayyor
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple={many}
        className="hidden"
        onChange={pickFromGallery}
      />
    </>
  );
}
