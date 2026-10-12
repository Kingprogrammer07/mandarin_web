import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, ImageOff, RefreshCw } from "lucide-react";

import {
  astatkaCargoPhotosQueryKey,
  getAstatkaCargoPhotos,
  type AstatkaBagCargo,
  type AstatkaCargoPhoto,
} from "@/api/services/astatkaFlights";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/utils/apiError";

import { PhotoImage } from "./PhotoImage";
import { PhotoViewer } from "./PhotoViewer";
import { useSnapCarousel } from "./useSnapCarousel";

interface Props {
  flightName: string;
  cargo: Pick<AstatkaBagCargo, "id" | "photo_count">;
  /** Re-take one photo (by its index); absent when the record is read-only. */
  onReplace?: (photoIndex: number) => void;
  /** A photo upload is running: the viewer's re-take button waits. */
  busy?: boolean;
}

/**
 * One photo-report record's photos inside the bag window: one large photo,
 * or a swipeable strip when there are several. Tapping a photo opens it full
 * screen.
 */
export function PhotoCarousel({ flightName, cargo, onReplace, busy = false }: Props) {
  const photos = useQuery({
    queryKey: astatkaCargoPhotosQueryKey(cargo.id),
    queryFn: () => getAstatkaCargoPhotos(flightName, cargo.id),
    enabled: cargo.photo_count > 0,
    // The links expire after about an hour.
    staleTime: 20 * 60_000,
  });

  if (cargo.photo_count === 0 || (photos.isSuccess && photos.data.length === 0)) {
    return (
      <p className="flex items-center gap-2 rounded-mc-sm bg-mc-surface-2 px-3 py-3 text-[13px] font-semibold text-mc-text">
        <ImageOff className="h-4 w-4 shrink-0 text-mc-text-3" />
        Rasm yo'q
      </p>
    );
  }
  if (photos.isPending) {
    return (
      <div aria-busy="true" aria-label="Rasmlar yuklanmoqda" className="space-y-2">
        <div className="aspect-[4/3] w-full animate-pulse rounded-mc-md bg-mc-surface-2" />
        {cargo.photo_count > 1 && (
          <div className="flex gap-2">
            {Array.from({ length: Math.min(cargo.photo_count, 5) }, (_, index) => (
              <div key={index} className="h-12 w-12 shrink-0 animate-pulse rounded-mc-sm bg-mc-surface-2" />
            ))}
          </div>
        )}
      </div>
    );
  }
  if (photos.isError) {
    return (
      <div className="rounded-mc-md border border-mc-danger/30 bg-mc-danger-soft p-3">
        <p className="text-[13px] font-semibold text-mc-danger">
          {apiErrorMessage(photos.error, "Rasmlarni ochib bo'lmadi.")}
        </p>
        <button
          type="button"
          onClick={() => void photos.refetch()}
          disabled={photos.isFetching}
          className="mt-2 inline-flex h-11 items-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.97] disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", photos.isFetching && "animate-spin")} />
          Qayta urinish
        </button>
      </div>
    );
  }
  return <PhotoGallery photos={photos.data} onReplace={onReplace} busy={busy} />;
}

// Same as the viewer's: `aria-disabled` keeps the focus (and the arrow keys)
// in the strip at either end, and a touch screen swipes instead.
const navButton =
  "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-mc-border bg-mc-surface/85 text-mc-text shadow-[var(--mc-shadow-card)] active:scale-95 aria-disabled:opacity-40 pointer-coarse:sr-only";

function PhotoGallery({
  photos,
  onReplace,
  busy,
}: {
  photos: AstatkaCargoPhoto[];
  onReplace?: (photoIndex: number) => void;
  busy: boolean;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const { attachTrack, trackRef, trackProps, active, goTo, onKeyDown } = useSnapCarousel({
    count: photos.length,
    reduceMotion,
  });
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const singleRef = useRef<HTMLButtonElement>(null);
  /** The slide the focus returns to once the viewer is gone. */
  const returnSlideRef = useRef(0);
  const many = photos.length > 1;

  // Keep the current thumbnail in view, scrolling only the thumbnail row:
  // `scrollIntoView` would also scroll the whole window up or down.
  useEffect(() => {
    const row = thumbsRef.current;
    const thumb = row?.children[active];
    if (!row || !(thumb instanceof HTMLElement)) return;
    const start = thumb.offsetLeft;
    const end = start + thumb.offsetWidth;
    if (start < row.scrollLeft) row.scrollLeft = start;
    else if (end > row.scrollLeft + row.clientWidth) row.scrollLeft = end - row.clientWidth;
  }, [active]);

  // Arrow keys on a focused photo move the focus with the strip; otherwise
  // Enter would open the photo that just slid out of view.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !track.contains(document.activeElement)) return;
    const slide = track.children[active];
    if (slide instanceof HTMLElement) slide.focus({ preventScroll: true });
  }, [active, trackRef]);

  // Back on the photo the viewer ended on, as the phone's gallery does.
  const closeViewer = (slide: number) => {
    returnSlideRef.current = slide;
    setViewerIndex(null);
    goTo(slide);
  };

  const viewer =
    viewerIndex !== null ? (
      <PhotoViewer
        photos={photos}
        initialIndex={Math.min(viewerIndex, photos.length - 1)}
        onClose={closeViewer}
        onReplace={
          onReplace
            ? (photoIndex) => {
                closeViewer(Math.max(0, photos.findIndex((photo) => photo.index === photoIndex)));
                onReplace(photoIndex);
              }
            : undefined
        }
        busy={busy}
        onCloseAutoFocus={(event) => {
          // The viewer has no Trigger, so Radix would leave the focus on
          // <body>. Back on the photo the viewer ended on — not the one that
          // was tapped, which may have slid out of view meanwhile.
          const slide = trackRef.current?.children[returnSlideRef.current];
          const target = slide instanceof HTMLElement ? slide : singleRef.current;
          if (!target) return;
          event.preventDefault();
          target.focus({ preventScroll: true });
        }}
      />
    ) : null;

  if (!many) {
    const photo = photos[0];
    return (
      <>
        <button
          ref={singleRef}
          type="button"
          onClick={() => setViewerIndex(0)}
          aria-label={`${photo.index + 1}-rasmni kattalashtirish`}
          className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-mc-md border border-mc-border bg-mc-surface-2 active:opacity-90"
        >
          <PhotoImage photo={photo} eager className="h-full w-full object-contain" />
        </button>
        {viewer}
      </>
    );
  }

  // The viewer sits outside the region: React events bubble through portals,
  // and an arrow key in the viewer must not also move the strip behind it.
  return (
    <>
      <div
        role="region"
        aria-roledescription="karusel"
        aria-label="Rasmlar"
        onKeyDown={onKeyDown}
        className="space-y-2"
      >
        <div className="relative overflow-hidden rounded-mc-md border border-mc-border bg-mc-surface-2">
          <div
            ref={attachTrack}
            {...trackProps}
            className="scrollbar-hide flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
          >
            {photos.map((photo, slide) => (
              <button
                key={photo.index}
                type="button"
                onClick={() => setViewerIndex(slide)}
                tabIndex={slide === active ? 0 : -1}
                aria-label={`${photo.index + 1}-rasmni kattalashtirish`}
                className="flex h-full w-full shrink-0 snap-center snap-always items-center justify-center active:opacity-90"
              >
                <PhotoImage
                  photo={photo}
                  eager={Math.abs(slide - active) <= 1}
                  className="h-full w-full object-contain"
                />
              </button>
            ))}
          </div>

          <span
            aria-live="polite"
            className="pointer-events-none absolute right-2 top-2 rounded-full bg-mc-surface/85 px-2 py-0.5 text-[11px] font-bold tabular-nums text-mc-text"
          >
            {`${active + 1} / ${photos.length}`}
          </span>
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            aria-disabled={active === 0}
            aria-label="Oldingi rasm"
            className={cn(navButton, "left-1.5")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-disabled={active === photos.length - 1}
            aria-label="Keyingi rasm"
            className={cn(navButton, "right-1.5")}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-mc-surface/80 px-2 py-1"
          >
            {photos.map((photo, slide) => (
              <span
                key={photo.index}
                className={cn(
                  "h-1.5 rounded-full",
                  slide === active ? "w-3.5 bg-mc-brand" : "w-1.5 bg-mc-text-3",
                )}
              />
            ))}
          </span>
        </div>

        <div
          ref={thumbsRef}
          className="relative flex gap-2 overflow-x-auto overscroll-x-contain pb-1"
        >
          {photos.map((photo, slide) => (
            <button
              key={photo.index}
              type="button"
              onClick={() => goTo(slide)}
              aria-label={`${photo.index + 1}-rasmga o'tish`}
              aria-current={slide === active ? "true" : undefined}
              className={cn(
                "h-12 w-12 shrink-0 overflow-hidden rounded-mc-sm border-2 bg-mc-surface-2 active:scale-95",
                slide === active ? "border-mc-brand" : "border-transparent opacity-70",
              )}
            >
              <PhotoImage photo={photo} compact alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
      {viewer}
    </>
  );
}
