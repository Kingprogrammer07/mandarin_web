import { useEffect, useId, useMemo } from "react";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";

import type { PendingPhotos } from "@/hooks/useAstatkaPendingPhotos";
import { MAX_OWN_PHOTOS } from "@/lib/astatkaPendingPhotos";

import { CameraCapture } from "./CameraCapture";

interface Props {
  /** What the row holds so far; undefined before the first photo. */
  entry: PendingPhotos | undefined;
  /** False once the row is being sent or is saved: new photos go to the saved bag instead. */
  canAdd: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onRetry: () => void;
  /**
   * The camera's open state lives with the caller, which keeps this section
   * on screen while it is open: a confirm landing meanwhile must not close
   * the camera and lose the shots.
   */
  cameraOpen: boolean;
  onCameraOpenChange: (open: boolean) => void;
}

const heading = "text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3";

const outlineButton =
  "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-3 py-1.5 text-center text-[13px] font-bold leading-tight text-mc-text active:scale-[0.97] disabled:opacity-60 @md:w-auto";

/**
 * Photos for a bag that is not saved in this astatka yet — the photo report
 * may not even have it. They wait on this device and go to the bag when it
 * is confirmed.
 */
export function BagPendingPhotos({
  entry,
  canAdd,
  onAdd,
  onRemove,
  onRetry,
  cameraOpen,
  onCameraOpenChange,
}: Props) {
  const headingId = useId();
  const files = useMemo(() => entry?.files ?? [], [entry]);
  const saving = entry?.status === "saving";
  const room = MAX_OWN_PHOTOS - files.length;

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div>
        <h3 id={headingId} className={heading}>
          Astatka rasmlari
        </h3>
        <p className="mt-0.5 text-[12px] font-medium text-mc-text-3">
          Yuk tasdiqlanganda shu yukka saqlanadi. Tasdiqlashdan oldin sahifa yopilsa, rasmlar
          yo'qoladi.
        </p>
      </div>

      {files.length > 0 ? (
        <ul aria-label="Saqlanishini kutayotgan rasmlar" className="flex flex-wrap gap-2 pr-3 pt-3">
          {previews.map((url, index) => (
            <li key={url} className="relative">
              <img
                src={url}
                alt={`${index + 1}-rasm`}
                className="h-[72px] w-[72px] rounded-mc-sm border border-mc-border object-cover"
              />
              {!saving && (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label={`${index + 1}-rasmni o'chirish`}
                  // The badge is small; the button around it is the 44px target.
                  className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center active:scale-90"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mc-danger-fill text-mc-on-danger">
                    <X className="h-3.5 w-3.5" />
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-mc-sm bg-mc-surface-2 px-3 py-3 text-[13px] font-semibold text-mc-text-2">
          Hali rasm olinmagan.
        </p>
      )}

      {saving && (
        <p role="status" className="flex items-center gap-2 text-[13px] font-semibold text-mc-text-2">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          Rasmlar yukka saqlanmoqda…
        </p>
      )}

      {entry?.status === "failed" && (
        <div role="alert" className="rounded-mc-md border border-mc-danger/30 bg-mc-danger-soft p-3">
          <p className="text-[13px] font-semibold text-mc-danger">{entry.error}</p>
          {entry.packageId != null && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex h-11 items-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.97]"
            >
              <RefreshCw className="h-4 w-4" />
              Qayta yuborish
            </button>
          )}
        </div>
      )}

      {canAdd && !saving && room > 0 && (
        <button type="button" onClick={() => onCameraOpenChange(true)} className={outlineButton}>
          <Camera className="h-4 w-4" />
          {files.length === 0 ? "Rasm olish" : "Yana rasm olish"}
        </button>
      )}

      {cameraOpen && (
        <CameraCapture
          mode="many"
          max={room}
          title={files.length === 0 ? "Rasm olish" : "Yana rasm olish"}
          note="Yuk tasdiqlanganda shu yukka saqlanadi."
          onDone={(taken) => {
            onCameraOpenChange(false);
            onAdd(taken);
          }}
          onClose={() => onCameraOpenChange(false)}
        />
      )}
    </section>
  );
}
