import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, X } from "lucide-react";

import { astatkaStore, type QueuedItem } from "@/utils/astatkaStore";
import { compressImageFile, formatFileSize } from "@/utils/imageCompression";

/**
 * Filling in or correcting one parcel.
 *
 * Opens automatically when a scan came back without a weight — the common case,
 * since the billing table covers 18 flights against the manifest's 129 — and on
 * demand when a worker taps a row to fix something.
 *
 * Everything here works offline. The weight, the price, the comment and the
 * photos all land in IndexedDB; the sync worker sends them when it can.
 */

/**
 * Bigger than the app-wide default of 1280×720.
 *
 * That default is tuned for pictures of goods. Here the photo is evidence about
 * a specific parcel and often has a label in it, and a portrait phone photo
 * capped at 720 tall comes out about 405px wide — too small to read a track
 * code off. 1600 on the long edge keeps labels legible and still lands around
 * 250 KB, so a 200-parcel shift is roughly 50 MB in IndexedDB.
 */
const PHOTO_OPTIONS = { maxWidth: 1600, maxHeight: 1600, quality: 0.8 };

interface LocalPhoto {
  id: string;
  url: string;
  size: number;
}

interface Props {
  open: boolean;
  item: QueuedItem | null;
  /** True when this opened straight after a scan rather than from a tap. */
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function newPhotoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Mounts only while open, so the fields start from the parcel in hand rather
 * than being reset by an effect — which would render the previous parcel's
 * weight for a frame before correcting itself.
 */
export function AstatkaItemSheet(props: Props) {
  if (!props.open || !props.item) return null;
  return <ItemSheetBody {...props} item={props.item} />;
}

function ItemSheetBody({
  item,
  isNew,
  onClose,
  onSaved,
}: Props & { item: QueuedItem }) {
  const [weight, setWeight] = useState(item.weightKg ?? "");
  const [price, setPrice] = useState(item.pricePerKg ?? "");
  const [comment, setComment] = useState(item.comment ?? "");
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // The weight is the one thing always missing when this opens after a scan,
    // so the caret starts there and the worker types without aiming.
    if (isNew) requestAnimationFrame(() => weightRef.current?.focus());
  }, [isNew]);

  // Object URLs are a leak if they are not released; a shift is hundreds.
  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, [photos]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const addPhoto = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const compressed = await compressImageFile(file, PHOTO_OPTIONS);
        const id = newPhotoId();
        // Stored before it is shown: if the tab dies while the worker is
        // looking at the preview, the bytes are already safe.
        await astatkaStore.putPhoto({
          id,
          astatkaId: item.astatkaId,
          blob: compressed.file,
          createdAt: Date.now(),
        });
        setPhotos((current) => [
          ...current,
          {
            id,
            url: URL.createObjectURL(compressed.file),
            size: compressed.compressedSize,
          },
        ]);
      }
    } catch {
      setError("Rasmni saqlab bo‘lmadi. Yana urinib ko‘ring.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = async (id: string) => {
    await astatkaStore.deletePhoto(id).catch(() => undefined);
    setPhotos((current) => {
      const gone = current.find((photo) => photo.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return current.filter((photo) => photo.id !== id);
    });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await astatkaStore.update(item.id, {
        weightKg: weight.trim() || null,
        pricePerKg: price.trim() || null,
        comment: comment.trim() || null,
        localPhotoIds: [
          ...item.localPhotoIds,
          ...photos.map((photo) => photo.id),
        ],
        // A number a person typed outranks anything a later sync might offer
        // from the source row, and this is what records that.
        enteredManually: true,
        // Back to pending so the correction is sent, even if the original row
        // had already been accepted by the server.
        status: "pending",
      });
      onSaved();
      onClose();
    } catch {
      setError(
        "Saqlab bo‘lmadi. Ma’lumot telefonda qoldi, yana urinib ko‘ring.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="astatka-item-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-mc-xl border border-mc-border bg-mc-surface pb-[env(safe-area-inset-bottom)] shadow-[var(--mc-shadow-card)] sm:max-w-md sm:rounded-mc-xl sm:pb-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 p-4 pb-3">
          <div className="min-w-0">
            <h2
              id="astatka-item-title"
              className="truncate text-[16px] font-extrabold text-mc-text"
            >
              {item.trackCode ?? "Trek kodsiz yuk"}
            </h2>
            <p className="mt-0.5 truncate text-[12px] font-medium text-mc-text-3">
              {item.clientCode ?? "Mijoz noma’lum"}
              {item.sourceFlightName ? ` · ${item.sourceFlightName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-3"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="astatka-weight"
                className="mb-1.5 block text-[12px] font-semibold text-mc-text-2"
              >
                Og‘irlik (kg)
              </label>
              <input
                id="astatka-weight"
                ref={weightRef}
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                inputMode="decimal"
                placeholder="12.4"
                className="h-11 w-full rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 text-[16px] font-bold text-mc-text placeholder:font-medium placeholder:text-mc-text-3 focus:border-mc-brand focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="astatka-price"
                className="mb-1.5 block text-[12px] font-semibold text-mc-text-2"
              >
                Narx (kg)
              </label>
              <input
                id="astatka-price"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                inputMode="decimal"
                placeholder="5"
                className="h-11 w-full rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 text-[16px] font-bold text-mc-text placeholder:font-medium placeholder:text-mc-text-3 focus:border-mc-brand focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="astatka-comment"
              className="mb-1.5 block text-[12px] font-semibold text-mc-text-2"
            >
              Izoh
            </label>
            <textarea
              id="astatka-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={2}
              placeholder="Masalan: quti yirtilgan"
              className="w-full rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-2 text-[16px] font-medium text-mc-text placeholder:text-mc-text-3 focus:border-mc-brand focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[12px] font-semibold text-mc-text-2">
                Rasm
              </span>
              <span className="text-[11px] font-medium text-mc-text-3">
                Internetsiz ham saqlanadi
              </span>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(event) => void addPhoto(event.target.files)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface-2 text-[13px] font-bold text-mc-text disabled:opacity-50"
            >
              <Camera className="h-4 w-4" strokeWidth={2.2} />
              Rasmga olish
            </button>

            {photos.length > 0 && (
              <ul className="mt-2 grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <li key={photo.id} className="relative">
                    <img
                      src={photo.url}
                      alt=""
                      className="aspect-square w-full rounded-mc-sm object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => void removePhoto(photo.id)}
                      aria-label="Rasmni o‘chirish"
                      className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </button>
                    <span className="mt-0.5 block text-center text-[10px] font-medium text-mc-text-3">
                      {formatFileSize(photo.size)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-mc-border p-4">
          {error && (
            <p className="mb-2 text-[12px] font-semibold text-mc-danger">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-mc-md border border-mc-border text-[13px] font-bold text-mc-text-2"
            >
              {isNew ? "Keyinroq" : "Bekor qilish"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="h-11 flex-1 rounded-mc-md bg-mc-brand text-[13px] font-extrabold text-mc-on-brand disabled:opacity-50"
            >
              {busy ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
