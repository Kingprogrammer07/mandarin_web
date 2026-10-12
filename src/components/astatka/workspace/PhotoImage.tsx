import { useState } from "react";
import { ImageOff } from "lucide-react";

import type { AstatkaCargoPhoto } from "@/api/services/astatkaFlights";
import { cn } from "@/lib/utils";

interface Props {
  photo: AstatkaCargoPhoto;
  className?: string;
  /**
   * A thumbnail: too small for the error sentence, so only the icon. The
   * large photo beside it already says what went wrong.
   */
  compact?: boolean;
  /** Empty for a decorative copy (a thumbnail beside the same large photo). */
  alt?: string;
  /**
   * Load now even though it is out of view: the slides next to the one on
   * screen, so a swipe never lands on a blank. Lazy loading alone waits until
   * a slide scrolls in, because a carousel track clips its neighbours.
   */
  eager?: boolean;
}

/**
 * One photo-report picture. A link the server could not sign, or one that
 * expired, shows why instead of a broken-image box.
 */
export function PhotoImage({ photo, className, compact = false, alt, eager = false }: Props) {
  // Per link, not per slot: a re-taken photo arrives under a new link and
  // must get its chance to load.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  if (!photo.url || brokenUrl === photo.url) {
    return (
      <span
        className={cn(
          // text-2 sits at 4.4:1 on the surface-2 slide; the reason a photo is
          // missing is content, so it gets the full text tone.
          "flex h-full w-full flex-col items-center justify-center gap-1 text-center font-semibold text-mc-text",
          compact ? "p-1 text-[10px]" : "p-2 text-[11px]",
        )}
      >
        <ImageOff className={cn("text-mc-text-3", compact ? "h-4 w-4" : "h-5 w-5")} aria-hidden />
        {!compact && (photo.error ?? "Rasm ochilmadi")}
      </span>
    );
  }
  return (
    <img
      src={photo.url}
      alt={alt ?? `${photo.index + 1}-rasm`}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      // A desktop drag must move the carousel, not lift the picture out of it.
      draggable={false}
      onError={() => setBrokenUrl(photo.url)}
      className={cn("select-none", className)}
    />
  );
}
