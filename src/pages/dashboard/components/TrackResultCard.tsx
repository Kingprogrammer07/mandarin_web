import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Box,
  CalendarClock,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardCheck,
  MapPin,
  PackageCheck,
  Plane,
  Scale,
  ShieldCheck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { CargoItemResponse, PublicTrackingStep, TrackCodeSearchResponse } from "@/api/services/cargo";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { computeStepProgress, deriveVisualStatuses, type VisualStepStatus } from "@/utils/trackingProgress";

interface TrackResultCardProps {
  data: TrackCodeSearchResponse;
}

const stepIcons = [Warehouse, Plane, ShieldCheck, ClipboardCheck, PackageCheck, CheckCircle2] as const;

function formatMoney(val?: string | number | null) {
  if (val == null || val === "") return null;
  const num = Number(val);
  return Number.isNaN(num) ? val : num.toLocaleString("ru-RU");
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "dd.MM.yyyy HH:mm");
}

function buildFallbackTracking(items: CargoItemResponse[], t: (key: string) => string): PublicTrackingStep[] {
  const hasChina = items.some((item) => Boolean(item.pre_checkin_date) || item.checkin_status === "pre" || item.checkin_status === "post");
  const hasUz = items.some((item) => Boolean(item.post_checkin_date) || item.checkin_status === "post");
  const hasReport = items.some((item) => item.is_sent_web);
  const hasTaken = items.some((item) => item.is_taken_away);
  const readyDate = items.find((item) => item.post_checkin_date)?.post_checkin_date ?? null;

  return [
    { step: 1, title: t("tracking.steps.step1"), status: hasChina ? "available" : "nodata", updated_at: items[0]?.pre_checkin_date ?? null },
    { step: 2, title: t("tracking.steps.step2"), status: hasChina ? (hasUz ? "available" : "pending") : "nodata", updated_at: readyDate },
    { step: 3, title: t("tracking.steps.step3"), status: hasUz ? "available" : "nodata", updated_at: readyDate },
    { step: 4, title: t("tracking.steps.step4"), status: hasReport ? "available" : "nodata", updated_at: readyDate },
    { step: 5, title: t("tracking.steps.step5"), status: hasReport ? "available" : "pending", updated_at: readyDate },
    { step: 6, title: t("tracking.steps.step6"), status: hasTaken ? "available" : hasReport ? "pending" : "nodata", updated_at: items.find((item) => item.taken_away_date)?.taken_away_date ?? null },
  ];
}

function getStatusLabel(status: VisualStepStatus, t: (key: string) => string) {
  if (status === "completed") return t("tracking.stepStatus.completed");
  if (status === "active") return t("tracking.stepStatus.active");
  return t("tracking.stepStatus.upcoming");
}

function getStepTitle(step: PublicTrackingStep, t: (key: string) => string) {
  const key = `tracking.steps.step${step.step}`;
  const translated = t(key);
  return translated === key ? step.title : translated;
}

export function TrackResultCard({ data }: TrackResultCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const allItems = useMemo(() => data.items ?? [], [data.items]);
  const primaryItem = allItems[0];

  const steps = useMemo(
    () => (data.tracking?.steps?.length ? data.tracking.steps : buildFallbackTracking(allItems, t)),
    [allItems, data.tracking, t],
  );

  const visualSteps = useMemo(() => {
    const visuals = deriveVisualStatuses(steps.map((step) => step.status));
    return steps.map((step, index) => ({ ...step, visualStatus: visuals[index] }));
  }, [steps]);

  const activeStep = visualSteps.find((step) => step.visualStatus === "active")
    ?? [...visualSteps].reverse().find((step) => step.visualStatus === "completed")
    ?? visualSteps[0];

  const progressPercentage = useMemo(
    () => computeStepProgress(steps.map((step) => step.status)),
    [steps],
  );

  const summaryStatus = useMemo(() => {
    if (allItems.some((item) => item.is_taken_away)) {
      return "taken";
    }
    if (allItems.some((item) => item.is_sent_web)) {
      return "reportReady";
    }
    if (allItems.some((item) => item.checkin_status === "post")) {
      return "inUzb";
    }
    if (allItems.some((item) => item.checkin_status === "pre")) {
      return "inChina";
    }
    return "pending";
  }, [allItems]);

  const statusClass =
    summaryStatus === "taken"
      ? "border-mc-border bg-mc-surface-2 text-mc-text-2"
      : summaryStatus === "reportReady" || summaryStatus === "inUzb"
        ? "border-mc-success/25 bg-mc-success/12 text-mc-success"
        : summaryStatus === "inChina"
          ? "border-mc-brand/25 bg-mc-brand-soft text-mc-brand"
          : "border-mc-border bg-mc-surface-2 text-mc-text-2";

  return (
    <motion.div
      layout
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={() => setExpanded((value) => !value)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        setExpanded((value) => !value);
      }}
      className={[
        "overflow-hidden rounded-mc-lg border bg-mc-surface shadow-[var(--mc-shadow-card)]",
        "transition-colors duration-200 active:scale-[0.995]",
        expanded ? "border-mc-brand/35 ring-2 ring-mc-brand/15" : "border-mc-border",
      ].join(" ")}
    >
      <div className="space-y-2.5 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-mc-text-3">
              {t("tracking.resultLabel")}
            </p>
            <h3 className="truncate font-mono text-[22px] font-extrabold leading-tight text-mc-text">
              {data.track_code}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${statusClass}`}>
                {t(`cargoStatus.${summaryStatus}`)}
              </span>
              {primaryItem?.flight_name && (
                <span className="rounded-full border border-mc-border bg-mc-surface-2 px-2.5 py-0.5 text-[11px] font-bold text-mc-text-2">
                  {t("cargoHistory.flight", { name: primaryItem.flight_name })}
                </span>
              )}
            </div>
          </div>

          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-md border border-mc-border bg-mc-surface-2"
          >
            <ChevronDown className="h-[18px] w-[18px] text-mc-text-2" strokeWidth={2} />
          </motion.div>
        </div>

        <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 p-3">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-extrabold text-mc-text">
                {getStepTitle(activeStep, t)}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-mc-text-2">
                {getStatusLabel(activeStep.visualStatus, t)}
              </p>
            </div>
            <span className="font-mono text-[13px] font-extrabold tabular-nums text-mc-brand">
              {progressPercentage}%
            </span>
          </div>

          <div className="relative grid grid-cols-6 gap-1">
            <div className="absolute left-[8%] right-[8%] top-3.5 h-1 rounded-full bg-mc-border" />
            <div
              className="absolute left-[8%] top-3.5 h-1 max-w-[84%] rounded-full bg-gradient-to-r from-mc-brand to-mc-brand-strong transition-all"
              style={{ width: `${Math.min(progressPercentage * 0.84, 84)}%` }}
            />
            {visualSteps.map((step, index) => {
              const Icon = stepIcons[index] ?? Circle;
              const isCompleted = step.visualStatus === "completed";
              const isActive = step.visualStatus === "active";

              return (
                <div key={step.step} className="relative z-10 flex justify-center">
                  <span
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-mc-sm border transition-colors",
                      isCompleted
                        ? "border-mc-success bg-mc-success text-mc-on-success"
                        : isActive
                          ? "border-mc-brand bg-mc-brand text-mc-on-brand ring-4 ring-mc-brand/15"
                          : "border-mc-border bg-mc-surface text-mc-text-3",
                    ].join(" ")}
                  >
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> : <Icon className="h-4 w-4" strokeWidth={2} />}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
          >
            <div className="space-y-2.5 border-t border-mc-border px-3.5 pb-4 pt-3">
              <div className="space-y-3">
                {allItems.map((item) => (
                  <CargoItemPanel key={item.id} item={item} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CargoItemPanel({ item }: { item: CargoItemResponse }) {
  const { t } = useTranslation();
  const checkinDate = formatDate(item.pre_checkin_date);
  const arrivalDate = formatDate(item.post_checkin_date);
  const takenDate = formatDate(item.taken_away_date);
  const relevantDate = takenDate ?? arrivalDate ?? checkinDate;
  const itemName = item.item_name_ru || item.item_name_cn || t("cargoHistory.names.notEntered");

  return (
    <div className="relative overflow-hidden rounded-mc-md border border-mc-border bg-mc-surface-2 p-3.5">
      <div className={`absolute inset-y-0 left-0 w-1 ${item.is_taken_away ? "bg-mc-text-3" : item.is_sent_web ? "bg-mc-success" : "bg-mc-brand"}`} />
      <div className="space-y-3 pl-1">
        <div className="flex flex-wrap gap-2">
          {item.flight_name && (
            <DetailChip icon={Plane} label={t("reports.flight")} value={item.flight_name} />
          )}
          {relevantDate && (
            <DetailChip icon={CalendarClock} label={arrivalDate ? t("tracking.arrivalDate") : t("tracking.checkinDate")} value={relevantDate} />
          )}
          {item.box_number && (
            <DetailChip icon={Box} label={t("cargoHistory.details.boxCount")} value={item.box_number} />
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoBlock label={t("cargoHistory.names.ru")} value={itemName} />
          {item.item_name_cn && item.item_name_ru && (
            <InfoBlock label={t("cargoHistory.names.cn")} value={item.item_name_cn} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricBlock icon={Scale} label={t("cargoHistory.details.actualWeight")} value={item.weight_kg ? `${item.weight_kg} kg` : t("cargoHistory.details.notMeasured")} />
          <MetricBlock icon={Calculator} label={t("cargoHistory.details.count")} value={item.quantity ? `${item.quantity} ta` : "-"} />
          <MetricBlock
            icon={MapPin}
            label={t("cargoHistory.financials.totalPayment")}
            value={item.total_payment_uzs ? `${formatMoney(item.total_payment_uzs)} so'm` : t("cargoHistory.financials.notCalculated")}
            accent
          />
          <MetricBlock
            icon={ClipboardCheck}
            label={t("cargoHistory.financials.pricePerKg")}
            value={item.price_per_kg_uzs ? `${formatMoney(item.price_per_kg_uzs)} so'm` : "-"}
          />
        </div>

        {(checkinDate || arrivalDate || takenDate || item.exchange_rate) && (
          <div className="flex flex-wrap gap-2 border-t border-mc-border pt-2.5 text-[11px] font-medium text-mc-text-2">
            {checkinDate && <span>CN: {checkinDate}</span>}
            {arrivalDate && <span>UZ: {arrivalDate}</span>}
            {takenDate && <span>{t("cargoStatus.taken")}: {takenDate}</span>}
            {item.exchange_rate && <span>{t("cargoHistory.financials.exchangeRate", { rate: formatMoney(item.exchange_rate) })}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailChip({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-mc-border bg-mc-surface px-2.5 py-1 text-[11px] font-bold text-mc-text-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-mc-brand" strokeWidth={2} />
      <span className="shrink-0 text-mc-text-3">{label}:</span>
      <span className="min-w-0 truncate">{value}</span>
    </span>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-mc-sm border border-mc-border bg-mc-surface p-2.5">
      <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-[0.09em] text-mc-text-3">{label}</p>
      <p className="text-[13px] font-bold text-mc-text">{value}</p>
    </div>
  );
}

function MetricBlock({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number | null;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-mc-sm border p-2.5 ${accent ? "border-mc-success/25 bg-mc-success/12" : "border-mc-border bg-mc-surface"}`}>
      <p className={`mb-0.5 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.09em] ${accent ? "text-mc-success" : "text-mc-text-3"}`}>
        <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
        <span className="truncate">{label}</span>
      </p>
      <p className={`font-mono text-[13px] font-extrabold tabular-nums ${accent ? "text-mc-success" : "text-mc-text"}`}>
        {value}
      </p>
    </div>
  );
}
