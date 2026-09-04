import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  PackageCheck,
  PackageSearch,
  Plane,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  shipmentService,
  type ManifestParcel,
} from "@/api/services/shipmentService";
import { formatWeightKg } from "@/lib/format";
import { triggerSoftHaptic } from "@/utils/haptics";

/**
 * What the client has on a flight the billing table does not know about yet.
 *
 * The detail screen reads `/reports/history`, which filters on `is_sent_web` —
 * the flag that says the flight arrived and its report went out. A flight still
 * in the air has no such row, so the screen rendered "Ma'lumot topilmadi": an
 * empty answer to a question asked of the wrong table. The parcels were never
 * missing, they are in the China manifest.
 *
 * Shown wherever that history comes back empty, not only on the "Yo'ldagi" tab:
 * 19 flights that have arrived never had a report sent, and they land on the
 * same blank screen from "Faol".
 */

interface Props {
  flightName: string;
  /** Opens the shared track-code lookup, same as the billed list does. */
  onTrackClick: (code: string) => void;
}

/** Rows shown before the list has to be expanded. Matches `TrackCodeList`. */
const COLLAPSED_COUNT = 4;

type Stage = "in_transit" | "partly_arrived" | "arrived";

function stageOf(total: number, scanned: number): Stage {
  if (scanned === 0) return "in_transit";
  return scanned < total ? "partly_arrived" : "arrived";
}

const STAGE_STYLE: Record<
  Stage,
  { icon: typeof Plane; tone: string; ring: string }
> = {
  in_transit: {
    icon: Plane,
    tone: "text-mc-warn",
    ring: "border-mc-warn/30 bg-mc-warn-soft",
  },
  partly_arrived: {
    icon: PackageSearch,
    tone: "text-mc-warn",
    ring: "border-mc-warn/30 bg-mc-warn-soft",
  },
  arrived: {
    icon: PackageCheck,
    tone: "text-mc-success",
    ring: "border-mc-success/30 bg-mc-success/12",
  },
};

export function ShipmentManifestPanel({ flightName, onTrackClick }: Props) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["shipmentManifest", flightName],
    queryFn: () => shipmentService.manifest(flightName),
    enabled: Boolean(flightName),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2.5 px-4">
        <div className="h-[92px] animate-pulse rounded-mc-lg bg-mc-surface-2" />
        <div className="h-[168px] animate-pulse rounded-mc-lg bg-mc-surface-2" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4">
        <div className="rounded-mc-lg border border-mc-danger/30 bg-mc-danger-soft p-3">
          <p className="text-[13px] font-semibold text-mc-danger">
            {t("reports.manifestError", "Yuk ma‘lumotini olib bo‘lmadi.")}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isRefetching}
            className="mt-2 h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface
                       text-[13px] font-bold text-mc-text transition-transform duration-150
                       active:scale-[0.99] disabled:opacity-50"
          >
            {t("reports.retry", "Qayta urinish")}
          </button>
        </div>
      </div>
    );
  }

  const parcels: ManifestParcel[] = data?.items ?? [];

  // Nothing in the manifest either — the flight genuinely has nothing of this
  // client's on it. Distinct from the transit case and worded so, rather than
  // reusing the old blanket "Ma'lumot topilmadi".
  if (parcels.length === 0) {
    return (
      <div className="px-4 py-14 text-center">
        <PackageSearch
          className="mx-auto mb-3 h-9 w-9 text-mc-text-3"
          strokeWidth={1.7}
          aria-hidden="true"
        />
        <p className="text-[14px] font-bold text-mc-text-2">
          {t("reports.manifestEmptyTitle", "Bu reysda yuk topilmadi")}
        </p>
        <p className="mx-auto mt-1 max-w-[280px] text-[12px] font-medium leading-relaxed text-mc-text-3">
          {t(
            "reports.manifestEmptyHint",
            "Agar yukingiz shu reysda bo‘lishi kerak bo‘lsa, operator bilan bog‘laning.",
          )}
        </p>
      </div>
    );
  }

  const total = data?.total_count ?? parcels.length;
  const scanned = data?.scanned_count ?? 0;
  const stage = stageOf(total, scanned);
  const { icon: StageIcon, tone, ring } = STAGE_STYLE[stage];

  const headline = {
    in_transit: t("reports.stageInTransitTitle", "Yuk yo‘lda"),
    partly_arrived: t(
      "reports.stagePartlyTitle",
      "Yukingiz qisman yetib keldi",
    ),
    arrived: t("reports.stageArrivedTitle", "Yuk omborga yetib keldi"),
  }[stage];

  const explanation = {
    in_transit: t(
      "reports.stageInTransitText",
      "Yukingiz Xitoyda ro‘yxatga olingan va yo‘lda. Toshkent omboriga yetib kelgach, skanerlanadi va hisob-kitob shu yerda paydo bo‘ladi.",
    ),
    partly_arrived: t("reports.stagePartlyText", {
      scanned,
      total,
      defaultValue:
        "{{total}} ta yukdan {{scanned}} tasi omborga yetib keldi. Qolganlari yo‘lda — odatda bir necha kun ichida yetib keladi.",
    }),
    arrived: t(
      "reports.stageArrivedText",
      "Yuklaringiz omborda. Hisob-kitob tayyorlanmoqda — tayyor bo‘lgach shu yerda summa va to‘lov tugmasi paydo bo‘ladi.",
    ),
  }[stage];

  const visible = isExpanded ? parcels : parcels.slice(0, COLLAPSED_COUNT);
  const hidden = parcels.length - visible.length;

  return (
    <div className="space-y-2.5">
      {/* Status. The icon and the wording carry the meaning; the tint only
          reinforces it, so the state is still readable without colour. */}
      <div className="px-4">
        <div className={`rounded-mc-lg border p-3 ${ring}`}>
          <div className="flex items-start gap-2.5">
            <StageIcon
              className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`}
              strokeWidth={2}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 className={`text-[14px] font-extrabold ${tone}`}>
                {headline}
              </h2>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-mc-text-2">
                {explanation}
              </p>
            </div>
          </div>

          {/* Wraps rather than sitting in a fixed row: at 320px a count and a
              weight next to each other would squeeze both. */}
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-mc-border/60 pt-2.5">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[11px] font-medium text-mc-text-3">
                {t("reports.manifestCount", "Yuklar")}
              </dt>
              <dd className="text-[13px] font-extrabold text-mc-text tabular-nums">
                {total}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[11px] font-medium text-mc-text-3">
                {t("reports.manifestWeight", "Og‘irlik")}
              </dt>
              <dd className="text-[13px] font-extrabold text-mc-text tabular-nums">
                {formatWeightKg(data?.total_weight ?? 0)}{" "}
                {t("reports.kg", "kg")}
              </dd>
            </div>
            {stage !== "in_transit" && (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-[11px] font-medium text-mc-text-3">
                  {t("reports.manifestArrived", "Omborda")}
                </dt>
                <dd className="text-[13px] font-extrabold text-mc-text tabular-nums">
                  {scanned}/{total}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* The parcels themselves — the thing the client actually came to see. */}
      <div className="px-4">
        <div className="rounded-mc-lg border border-mc-border bg-mc-surface p-3 shadow-[var(--mc-shadow-card)]">
          <h2 className="text-[14px] font-extrabold text-mc-text">
            {t("reports.trackCodes", "Trek-kod")}
          </h2>

          <ul className="mt-2 space-y-1.5">
            {visible.map((parcel) => (
              <li key={parcel.track_code}>
                <button
                  type="button"
                  onClick={() => {
                    triggerSoftHaptic();
                    onTrackClick(parcel.track_code);
                  }}
                  className="flex w-full min-h-11 items-center gap-3 rounded-mc-md bg-mc-surface-2
                             px-3 py-2.5 text-left transition-transform duration-150
                             active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-mc-text">
                      {parcel.track_code}
                    </span>
                    {parcel.item_name && (
                      <span className="mt-0.5 block truncate text-[11px] font-medium text-mc-text-3">
                        {parcel.item_name}
                      </span>
                    )}
                  </div>

                  {parcel.weight > 0 && (
                    <span className="shrink-0 text-[11px] font-medium text-mc-text-2 tabular-nums">
                      {formatWeightKg(parcel.weight)} {t("reports.kg", "kg")}
                    </span>
                  )}

                  {/* Per-parcel state. A dot alone would be colour-only, so the
                      badge carries a word too. */}
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      parcel.is_scanned
                        ? "bg-mc-success/12 text-mc-success"
                        : "bg-mc-surface text-mc-text-3"
                    }`}
                  >
                    {parcel.is_scanned
                      ? t("reports.parcelArrived", "Omborda")
                      : t("reports.parcelInTransit", "Yo‘lda")}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {(hidden > 0 || isExpanded) && (
            <button
              type="button"
              onClick={() => setIsExpanded((value) => !value)}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-1
                         text-[12px] font-bold text-mc-brand"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  {t("reports.showLessTracks", "Kamroq ko‘rsatish")}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  {t("reports.showMoreTracks", {
                    count: hidden,
                    defaultValue: "Yana {{count}} ta ko‘rsatish",
                  })}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Clears the sticky dock so the last row is never trapped underneath. */}
      <div className="h-20" aria-hidden="true" />
    </div>
  );
}
