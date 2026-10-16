import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import {
  astatkaExternalPhotosQueryKey,
  getAstatkaExternalPhotos,
  type AstatkaCargoPhoto,
  type AstatkaExternalBag,
} from "@/api/services/astatkaFlights";
import { formatDateTime, formatKg, formatUsd } from "@/lib/astatkaFormat";
import { cn } from "@/lib/utils";

import { PhotoImage } from "./PhotoImage";
import { PhotoViewer } from "./PhotoViewer";
import { SourceCompanyChip } from "./SourceCompanyChip";

export interface ExternalBagCardProps {
  /** The partner's name, or its code ("AKB"). */
  companyName: string;
  /** The partner's data for the bag as chosen; null when none was kept. */
  bag: AstatkaExternalBag | null;
  /** Every flight the partner holds for the client, newest first (a scan row's). */
  options?: AstatkaExternalBag[];
  /** The flight the bag is on now. */
  selectedFlight?: string;
  /** False when the partner did not say which flight the code is in. */
  flightKnown?: boolean;
  /** Picks the bag's flight; absent once the choice can no longer change. */
  onPickFlight?: (flightName: string) => void;
  /** A saved bag: where its stored photo copies are read from. */
  storedPhotos?: { flightName: string; packageId: number };
}

const labelClass =
  "text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3";

function Fact({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className={labelClass}>{label}</dt>
      <dd className="break-words text-[13px] font-bold text-mc-text">{children}</dd>
    </div>
  );
}

function sameFlight(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

/**
 * The partner's photos: a row of thumbnails, each opening the full-size
 * viewer. Read-only — the photos are the partner's, re-taking them is not
 * ours to do.
 */
function PartnerPhotos({ photos }: { photos: AstatkaCargoPhoto[] }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const thumbsRef = useRef<(HTMLButtonElement | null)[]>([]);
  /** The thumbnail the focus returns to: the photo the viewer ended on. */
  const returnIndexRef = useRef(0);

  return (
    <>
      <ul className="mt-1.5 flex gap-2 overflow-x-auto overscroll-x-contain pb-1">
        {photos.map((photo, slide) => (
          <li key={photo.index} className="shrink-0">
            <button
              ref={(element) => {
                thumbsRef.current[slide] = element;
              }}
              type="button"
              onClick={() => {
                returnIndexRef.current = slide;
                setViewerIndex(slide);
              }}
              aria-label={`${slide + 1}-rasmni kattalashtirish`}
              className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-mc-sm border border-mc-border bg-mc-surface-2 active:scale-95"
            >
              <PhotoImage photo={photo} compact alt="" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={(lastIndex) => {
            returnIndexRef.current = lastIndex;
            setViewerIndex(null);
          }}
          // Opened from state, not a Radix Trigger: without this the focus
          // would land on <body>, outside the bag window.
          onCloseAutoFocus={(event) => {
            const thumb = thumbsRef.current[returnIndexRef.current];
            if (!thumb) return;
            event.preventDefault();
            thumb.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
}

/** How often, and for how long, a bag whose photos are still being copied is asked again. */
const COPY_POLL_MS = 3000;
const COPY_WATCH_MS = 60_000;

const refreshButtonClass =
  "mt-1.5 flex min-h-11 items-center justify-center rounded-mc-sm border border-mc-border bg-mc-surface px-3 py-1.5 text-[13px] font-bold text-mc-text active:scale-[0.97]";

function PhotoSkeleton({ count, label }: { count: number; label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="mt-1.5 flex gap-2">
      {Array.from({ length: Math.max(1, Math.min(count, 5)) }, (_, index) => (
        <div key={index} className="h-16 w-16 shrink-0 animate-pulse rounded-mc-sm bg-mc-surface-2" />
      ))}
    </div>
  );
}

/**
 * A saved bag's photos, from the copies made in our storage after its
 * confirm. The copy runs after the confirm has answered, so a bag confirmed a
 * moment ago is asked again for a minute; a copy that takes longer — a big
 * batch copies its bags one after another — is asked again on "Yangilash",
 * which also lets the server queue a copy a restart lost.
 */
function StoredPartnerPhotos({
  flightName,
  packageId,
  count,
  emptyText,
}: {
  flightName: string;
  packageId: number;
  count: number;
  /** Shown when no copy exists and none is on its way. */
  emptyText: string;
}) {
  const [watching, setWatching] = useState(true);
  useEffect(() => {
    if (!watching) return;
    const timer = window.setTimeout(() => setWatching(false), COPY_WATCH_MS);
    return () => window.clearTimeout(timer);
  }, [watching]);

  const photos = useQuery({
    queryKey: astatkaExternalPhotosQueryKey(packageId),
    queryFn: () => getAstatkaExternalPhotos(flightName, packageId),
    // The links expire after about an hour; a copy still under way is
    // asked again whenever the bag is opened.
    staleTime: (query) => ((query.state.data?.pending ?? 0) > 0 ? 0 : 20 * 60_000),
    refetchInterval: (query) =>
      watching && (query.state.data?.pending ?? 0) > 0 ? COPY_POLL_MS : false,
  });
  const refresh = () => {
    setWatching(true);
    void photos.refetch();
  };

  if (photos.isPending) {
    return <PhotoSkeleton count={count} label="Rasmlar yuklanmoqda" />;
  }
  if (photos.isError) {
    return (
      <span className="font-semibold text-mc-text-2">
        Rasmlarni ochib bo'lmadi. Oynani yangilab ko'ring.
      </span>
    );
  }
  const { pending } = photos.data;
  const stillCopying =
    pending > 0 &&
    (watching ? (
      <span className="mt-1 block text-[12px] font-semibold text-mc-text-2">
        Rasmlar nusxalanmoqda…
      </span>
    ) : (
      <>
        <span className="mt-1 block text-[12px] font-semibold text-mc-text-2">
          Rasmlar hali nusxalanmadi.
        </span>
        <button type="button" className={refreshButtonClass} onClick={refresh}>
          Yangilash
        </button>
      </>
    ));
  if (photos.data.photos.length > 0) {
    return (
      <>
        <PartnerPhotos photos={photos.data.photos} />
        {stillCopying}
      </>
    );
  }
  if (pending > 0) {
    return (
      <>
        {watching && <PhotoSkeleton count={pending} label="Rasmlar nusxalanmoqda" />}
        {stillCopying}
      </>
    );
  }
  return <span className="font-semibold text-mc-text-2">{emptyText}</span>;
}

/**
 * What a partner cargo's API says about a bag our database does not hold —
 * shown in the bag window instead of our photo report, which would describe
 * an unrelated client of ours with the same code. While the bag is not
 * confirmed yet and the partner holds several flights for the client, the
 * worker picks which one this bag is.
 */
export function ExternalBagCard({
  companyName,
  bag,
  options = [],
  selectedFlight = "",
  flightKnown = true,
  onPickFlight,
  storedPhotos,
}: ExternalBagCardProps) {
  const headingId = useId();
  const pickerLabelId = useId();
  const radioName = useId();
  const pickable = onPickFlight !== undefined && options.length > 1;
  const sentUrls = bag?.photo_urls;
  const livePhotos = useMemo<AstatkaCargoPhoto[]>(
    () =>
      (sentUrls ?? [])
        .filter(Boolean)
        .map((url, index) => ({ index, url, error: null })),
    [sentUrls],
  );
  const storedCount = bag?.stored_photos ?? 0;
  // A saved bag's photos are our copies; the view it came with may predate
  // them (it was built before the copy ran), so it is asked whenever the
  // partner said the bag has photos.
  const readStored =
    storedPhotos !== undefined &&
    livePhotos.length === 0 &&
    (storedCount > 0 || (bag?.photo_count ?? 0) > 0);
  const shownCount = livePhotos.length || storedCount;
  const noPhotosText =
    (bag?.photo_count ?? 0) > 0
      ? `${bag?.photo_count} ta rasm ${companyName} tizimida — bu yerda ko'rinmaydi`
      : "Rasm yo'q";

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className={labelClass}>
          {companyName} ma'lumoti
        </h3>
        <SourceCompanyChip label={companyName} />
      </div>

      {pickable && !flightKnown && (
        <div className="flex items-start gap-2 rounded-mc-sm bg-mc-warn-soft px-3 py-2 text-[12px] font-semibold text-mc-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">
            Kod qaysi reysga tegishli ekanini {companyName} aytmadi — eng oxirgi reys
            tanlandi. Qopdagi yozuvga qarab tekshiring.
          </span>
        </div>
      )}

      {pickable && (
        <div role="radiogroup" aria-labelledby={pickerLabelId} className="space-y-1.5">
          <p id={pickerLabelId} className={labelClass}>
            Qaysi reysdan · {options.length} ta
          </p>
          {options.map((option) => {
            const checked = sameFlight(option.flight_name, selectedFlight);
            return (
              <label
                key={option.flight_name}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-mc-md border bg-mc-surface px-3 py-2 active:scale-[0.99] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-mc-brand/40",
                  checked ? "border-mc-brand" : "border-mc-border",
                )}
              >
                <input
                  type="radio"
                  name={radioName}
                  value={option.flight_name}
                  checked={checked}
                  onChange={() => onPickFlight?.(option.flight_name)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                    checked ? "border-mc-brand" : "border-mc-text-3",
                  )}
                >
                  {checked && <span className="h-2 w-2 rounded-full bg-mc-brand" />}
                </span>
                {/* Never truncated: the flight name is what the bag's label says. */}
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[13px] font-extrabold text-mc-text">
                    {option.flight_name}
                  </span>
                  <span className="block text-[11px] font-medium tabular-nums text-mc-text-3">
                    {formatDateTime(option.created_at)}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-bold tabular-nums text-mc-text">
                  {formatKg(option.weight_kg)}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {bag ? (
        <div className="rounded-mc-lg border border-mc-border bg-mc-surface p-3">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 @2xl:grid-cols-4">
            <Fact label="Reys">{bag.flight_name || "—"}</Fact>
            <Fact label="Og'irligi">
              <span className="tabular-nums">{formatKg(bag.weight_kg)}</span>
            </Fact>
            <Fact label="1 kg narxi">
              <span className="tabular-nums">{formatUsd(bag.price_per_kg)}</span>
            </Fact>
            <Fact label="Foto hisobot qatorlari">
              <span className="tabular-nums">{bag.rows} ta</span>
            </Fact>
            <Fact label="Mijozga yuborilganmi">{bag.is_sent ? "Ha" : "Yo'q"}</Fact>
            <Fact label="Yaratilgan vaqti">
              <span className="tabular-nums">{formatDateTime(bag.created_at)}</span>
            </Fact>
            <Fact
              label={shownCount > 0 ? `Rasmlar · ${shownCount} ta` : "Rasmlar"}
              className="col-span-full"
            >
              {livePhotos.length > 0 ? (
                <PartnerPhotos photos={livePhotos} />
              ) : readStored && storedPhotos ? (
                <StoredPartnerPhotos
                  flightName={storedPhotos.flightName}
                  packageId={storedPhotos.packageId}
                  count={storedCount || bag.photo_count}
                  emptyText={noPhotosText}
                />
              ) : (
                <span className="font-semibold text-mc-text-2">{noPhotosText}</span>
              )}
            </Fact>
          </dl>
          {bag.comment && (
            <p className="mt-3 break-words rounded-mc-sm bg-mc-surface-2 px-3 py-2 text-[13px] font-medium text-mc-text-2">
              {bag.comment}
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-mc-md border border-dashed border-mc-border bg-mc-surface-2 px-4 py-6 text-center text-[13px] font-semibold text-mc-text-2">
          {companyName} ma'lumoti bu yuk bilan saqlanmagan.
        </p>
      )}
    </section>
  );
}
