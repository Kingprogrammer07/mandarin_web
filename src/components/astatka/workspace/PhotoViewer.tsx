import { useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { Camera, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

import type { AstatkaCargoPhoto } from "@/api/services/astatkaFlights";
import { shouldDismissVerticalSwipe } from "@/lib/swipeGesture";
import { cn } from "@/lib/utils";

import { PhotoImage } from "./PhotoImage";
import { useSnapCarousel } from "./useSnapCarousel";

interface Props {
  photos: AstatkaCargoPhoto[];
  /** The photo that was tapped; the viewer opens on it. */
  initialIndex: number;
  /** Gets the photo on screen when it closed. */
  onClose: (lastIndex: number) => void;
  /** "Shu rasmni qayta olish"; absent when the record is read-only. */
  onReplace?: (photoIndex: number) => void;
  busy?: boolean;
  /**
   * Where the focus goes back to. The viewer is opened from state, not from a
   * Radix Trigger, so without this the focus is left on <body>.
   */
  onCloseAutoFocus?: (event: Event) => void;
}

/** How far a pull fades the backdrop: fully see-through is never reached. */
const FADE_DISTANCE_PX = 260;

// `aria-disabled`, not `disabled`: a disabled button drops the focus to
// <body>, outside the dialog, and the arrow keys would stop working. Dimmed,
// not hidden, so a focused one stays visible; a press at the end is a no-op.
// On a touch screen the buttons are only for VoiceOver — over the photo they
// would be dead patches where a swipe does nothing.
const navButton =
  "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-mc-border bg-mc-surface/85 text-mc-text active:scale-95 aria-disabled:opacity-40 pointer-coarse:sr-only";

/**
 * Telegram minimises the whole Mini App on a downward swipe. While a photo is
 * open that gesture closes the photo, so Telegram's is switched off and put
 * back as it was.
 */
function useTelegramVerticalSwipesOff() {
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    // Older clients only print an "unsupported" warning.
    if (!webApp?.disableVerticalSwipes || webApp.isVersionAtLeast?.("7.7") !== true) return;
    const wasEnabled = webApp.isVerticalSwipesEnabled !== false;
    webApp.disableVerticalSwipes();
    return () => {
      if (wasEnabled) webApp.enableVerticalSwipes?.();
    };
  }, []);
}

/**
 * Full-size photos over the bag window, like the phone's own gallery: swipe
 * sideways (or ←/→ on a computer) between photos, pull the photo up or down
 * to close it.
 *
 * The sideways swipe is the browser's own scroll-snap, not a gesture library,
 * so it keeps native momentum. The vertical pull is framer-motion's `drag="y"`,
 * which sets `touch-action: pan-x` on the photo — the browser keeps the
 * horizontal pan and hands only the vertical one to the drag. `pinch-zoom` is
 * added back over framer's inline value, so a label on the parcel can still
 * be pinched up to read.
 */
export function PhotoViewer({
  photos,
  initialIndex,
  onClose,
  onReplace,
  busy = false,
  onCloseAutoFocus,
}: Props) {
  const reduceMotion = useReducedMotion() ?? false;
  useTelegramVerticalSwipesOff();
  const { attachTrack, trackProps, active, goTo, onKeyDown } = useSnapCarousel({
    count: photos.length,
    initialIndex,
    reduceMotion,
  });
  // One value for every slide: only the slide under the finger is ever
  // dragged, and the backdrop reads its distance from the same value.
  const dragY = useMotionValue(0);
  const backdropOpacity = useTransform(
    dragY,
    [-FADE_DISTANCE_PX, 0, FADE_DISTANCE_PX],
    [0.35, 1, 0.35],
  );

  const many = photos.length > 1;
  const photo = photos[active];

  const onDragEnd = (event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    // The browser took the gesture over (a second finger: a pinch). That is
    // zooming, never a pull to close.
    if (event.type === "pointercancel") return;
    if (shouldDismissVerticalSwipe({ offsetY: info.offset.y, velocityY: info.velocity.y })) {
      onClose(active);
    }
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose(active)}>
      <DialogPrimitive.Portal>
        {/* `dark` pins the dark token set: a photo is judged on a dark ground
            in both themes, as in the phone's own gallery. */}
        <DialogPrimitive.Overlay asChild>
          <motion.div
            style={{ opacity: backdropOpacity }}
            className="dark fixed inset-0 z-[60] bg-mc-bg"
          />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content
          aria-modal="true"
          onKeyDown={onKeyDown}
          onCloseAutoFocus={onCloseAutoFocus}
          className="dark fixed inset-0 z-[60] flex flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-mc-text outline-none"
        >
          <div className="flex shrink-0 items-center gap-2 px-2 py-2">
            <DialogPrimitive.Title className="min-w-0 flex-1 px-2 text-[15px] font-extrabold tabular-nums text-mc-text">
              {`${active + 1} / ${photos.length}`}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Rasmni kattalashtirib ko'rish. Keyingi rasm uchun yon tomonga suring yoki strelkalarni
              bosing; yopish uchun rasmni yuqoriga yoki pastga suring.
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              aria-label="Yopish"
              className="flex h-11 w-11 items-center justify-center rounded-mc-sm text-mc-text active:scale-95"
            >
              <X className="h-6 w-6" />
            </DialogPrimitive.Close>
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={attachTrack}
              {...trackProps}
              className="scrollbar-hide absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
            >
              {photos.map((item, slide) => (
                <div
                  key={item.index}
                  className="flex h-full w-full shrink-0 snap-center snap-always items-center justify-center px-2"
                  aria-hidden={slide !== active}
                >
                  <motion.div
                    drag="y"
                    dragDirectionLock
                    dragConstraints={{ top: 0, bottom: 0 }}
                    // Reduced motion: the photo stays put, but the pull still closes.
                    dragElastic={reduceMotion ? 0 : 0.9}
                    dragTransition={{ bounceStiffness: 420, bounceDamping: 42 }}
                    onDragEnd={onDragEnd}
                    style={{ y: dragY }}
                    className="flex h-full w-full items-center justify-center [touch-action:pan-x_pinch-zoom]!"
                  >
                    <PhotoImage
                      photo={item}
                      eager={Math.abs(slide - active) <= 1}
                      className="max-h-full max-w-full rounded-mc-sm object-contain"
                    />
                  </motion.div>
                </div>
              ))}
            </div>
            {many && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(active - 1)}
                  aria-disabled={active === 0}
                  aria-label="Oldingi rasm"
                  className={cn(navButton, "left-2")}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(active + 1)}
                  aria-disabled={active === photos.length - 1}
                  aria-label="Keyingi rasm"
                  className={cn(navButton, "right-2")}
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          {onReplace && photo && (
            <div className="flex shrink-0 justify-center px-4 py-3">
              <button
                type="button"
                onClick={() => onReplace(photo.index)}
                disabled={busy}
                className="flex h-12 items-center gap-2 rounded-mc-md bg-mc-brand px-5 text-[14px] font-extrabold text-mc-on-brand active:scale-[0.97] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                Shu rasmni qayta olish
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
