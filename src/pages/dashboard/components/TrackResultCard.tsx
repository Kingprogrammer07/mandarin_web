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
      ? "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/12 dark:bg-white/10 dark:text-slate-200"
      : summaryStatus === "reportReady" || summaryStatus === "inUzb"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
        : summaryStatus === "inChina"
          ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300"
          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-300";

  return (
    <motion.div
      layout
      onClick={() => setExpanded((value) => !value)}
      className={[
        "overflow-hidden rounded-3xl border bg-white shadow-sm transition-all duration-200 active:scale-[0.995]",
        "dark:bg-[#0b1018] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_34px_rgba(0,0,0,0.22)]",
        expanded
          ? "border-orange-300 ring-4 ring-orange-500/10 dark:border-orange-300/35"
          : "border-slate-200 dark:border-white/[0.12]",
      ].join(" ")}
    >
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t("tracking.resultLabel")}
            </p>
            <h3 className="truncate font-mono text-2xl font-black tracking-normal text-slate-950 sm:text-3xl dark:text-white">
              {data.track_code}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusClass}`}>
                {t(`cargoStatus.${summaryStatus}`)}
              </span>
              {primaryItem?.flight_name && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
                  {t("cargoHistory.flight", { name: primaryItem.flight_name })}
                </span>
              )}
            </div>
          </div>

          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.05]"
          >
            <ChevronDown className="size-5 text-slate-400" />
          </motion.div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                {getStepTitle(activeStep, t)}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {getStatusLabel(activeStep.visualStatus, t)}
              </p>
            </div>
            <span className="font-mono text-sm font-black text-orange-600 dark:text-orange-300">
              {progressPercentage}%
            </span>
          </div>

          <div className="relative grid grid-cols-6 gap-1">
            <div className="absolute left-[8%] right-[8%] top-3.5 h-1 rounded-full bg-slate-200 dark:bg-white/10" />
            <div
              className="absolute left-[8%] top-3.5 h-1 max-w-[84%] rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all"
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
                      "flex size-9 items-center justify-center rounded-xl border text-xs font-black transition",
                      isCompleted
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                        : isActive
                          ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20 ring-4 ring-amber-500/15"
                          : "border-slate-200 bg-white text-slate-300 dark:border-white/10 dark:bg-[#0b1018] dark:text-slate-600",
                    ].join(" ")}
                  >
                    {isCompleted ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
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
            <div className="space-y-3 border-t border-slate-100 px-4 pb-5 pt-3 dark:border-white/[0.08] sm:px-5">
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
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.035]">
      <div className={`absolute inset-y-0 left-0 w-1 ${item.is_taken_away ? "bg-slate-500" : item.is_sent_web ? "bg-emerald-500" : "bg-sky-500"}`} />
      <div className="space-y-4 pl-1">
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
          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
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
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
      <Icon className="size-3.5 shrink-0 text-orange-500" />
      <span className="shrink-0 text-slate-400">{label}:</span>
      <span className="min-w-0 truncate">{value}</span>
    </span>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#0b1018]">
      <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-900 dark:text-white">{value}</p>
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
    <div className={`rounded-xl border p-3 ${accent ? "border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/8" : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#0b1018]"}`}>
      <p className={`mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide ${accent ? "text-emerald-600 dark:text-emerald-300" : "text-slate-400"}`}>
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className={`font-mono text-sm font-black ${accent ? "text-emerald-700 dark:text-emerald-300" : "text-slate-900 dark:text-white"}`}>
        {value}
      </p>
    </div>
  );
}
