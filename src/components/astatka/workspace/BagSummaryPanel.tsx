import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock, PackageCheck, Send } from "lucide-react";

import type { BagStatusTone, BagSummary } from "@/lib/astatkaBagSummary";
import { formatKg, formatScanTime } from "@/lib/astatkaFormat";
import { formatUzs } from "@/lib/format";
import { cn } from "@/lib/utils";

import { SourceCompanyChip } from "./SourceCompanyChip";

const TONE: Record<BagStatusTone, string> = {
  success: "bg-mc-success/12 text-mc-success",
  warn: "bg-mc-warn-soft text-mc-warn",
  brand: "bg-mc-brand-soft text-mc-brand",
  danger: "bg-mc-danger-soft text-mc-danger",
  neutral: "bg-mc-surface-2 text-mc-text-2",
};

function Fact({ label, children, tone }: { label: string; children: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">{label}</dt>
      <dd className={cn("break-words text-[13px] font-bold", tone ?? "text-mc-text")}>{children}</dd>
    </div>
  );
}

/** The bag at a glance: whose, from where, how heavy, and what state it is in. */
export function BagSummaryPanel({ summary }: { summary: BagSummary }) {
  // Our payment rows know nothing about a partner's bag: "Yozuv yo'q" and
  // "Yo'q" would read as facts about it.
  const partner = summary.sourceCompany !== "";
  return (
    <section aria-label="Yuk haqida" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold",
            TONE[summary.statusTone],
          )}
        >
          {summary.statusTone === "success" && <CheckCircle2 className="h-3.5 w-3.5" />}
          {summary.statusTone === "warn" && <Clock className="h-3.5 w-3.5" />}
          {summary.statusLabel}
        </span>
        {summary.astatkaSent && (
          <span className="inline-flex items-center gap-1 rounded-full bg-mc-brand-soft px-2.5 py-1 text-[12px] font-bold text-mc-brand">
            <Send className="h-3.5 w-3.5" />
            Astatkadan yuborilgan
          </span>
        )}
        {summary.handedOut && (
          <span className="inline-flex items-center gap-1 rounded-full bg-mc-success/12 px-2.5 py-1 text-[12px] font-bold text-mc-success">
            <PackageCheck className="h-3.5 w-3.5" />
            Ostatkadan berilgan
          </span>
        )}
        {partner && <SourceCompanyChip label={summary.sourceCompanyName} />}
      </div>

      {(summary.takenAway || summary.notes.length > 0) && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-mc-sm px-3 py-2 text-[12px] font-semibold",
            summary.takenAway || summary.statusTone === "danger"
              ? "bg-mc-danger-soft text-mc-danger"
              : "bg-mc-warn-soft text-mc-warn",
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">
            {summary.takenAway && (
              <span className="block">
                Diqqat: tizimda bu yuk mijozga berilgan deb turibdi. Tekshiring.
                {!summary.handedOut &&
                  " Javonda qolgan bo'lsa, ombor uni «Ostatkadan berish» bilan beradi."}
              </span>
            )}
            {summary.notes.map((note) => (
              <span key={note} className="block">
                {note}
              </span>
            ))}
          </span>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 @2xl:grid-cols-4">
        <Fact label="Mijoz kodi">
          {/* Never truncated: the code is what the worker writes on the bag. */}
          <span className="block break-all">{summary.clientCode || "Noma'lum"}</span>
          {summary.clientName && (
            <span className="block text-[12px] font-medium text-mc-text-2">{summary.clientName}</span>
          )}
        </Fact>
        <Fact label="Qaysi reysdan">{summary.sourceFlight || "Noma'lum"}</Fact>
        <Fact label="Og'irligi">
          <span className="tabular-nums">{formatKg(summary.weightKg)}</span>
          {summary.weightEdited ? " (qo'lda)" : ""}
        </Fact>
        <Fact label="Foto hisobot">{summary.photoReport ?? "—"}</Fact>
        {summary.price && summary.price.amount !== null && (
          <Fact label="Narx (astatka vaznidan)">
            <span className="tabular-nums">
              {summary.price.first_amount !== null && (
                <span className="font-semibold text-mc-text-3 line-through decoration-1">
                  {formatUzs(summary.price.first_amount)}
                </span>
              )}{" "}
              {formatUzs(summary.price.amount)}
            </span>
            {summary.price.first_weight_kg !== null && (
              <span className="block text-[12px] font-medium text-mc-text-2 tabular-nums">
                Asl vazn {formatKg(summary.price.first_weight_kg)}
              </span>
            )}
          </Fact>
        )}
        {!partner && (
          <>
            <Fact label="To'lov">{summary.payment ?? "Yozuv yo'q"}</Fact>
            <Fact label="Olib ketilganmi" tone={summary.takenAway ? "text-mc-danger" : undefined}>
              {summary.takenAway ? "Ha — tekshiring!" : "Yo'q"}
            </Fact>
          </>
        )}
        <Fact label="Tasdiqlagan">{summary.confirmedBy ?? "—"}</Fact>
        {summary.handedOut && <Fact label="Ostatkadan berilgan">{summary.handedOut}</Fact>}
        {summary.astatkaSent && (
          <Fact label="Astatkadan yuborilgan">
            <span className="whitespace-pre-line tabular-nums">{summary.astatkaSent}</span>
          </Fact>
        )}
        <Fact label="Vaqti">
          <span className="tabular-nums">{formatScanTime(summary.timeIso)}</span>
        </Fact>
      </dl>

      {summary.comment && (
        <p className="break-words rounded-mc-sm bg-mc-surface-2 px-3 py-2 text-[13px] font-medium text-mc-text-2">
          {summary.comment}
        </p>
      )}

      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
          Trek kodlar · {summary.trackCodes.length} ta
        </p>
        {summary.trackCodes.length > 0 ? (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {summary.trackCodes.map((code) => (
              <li
                key={code}
                className="break-all rounded-mc-sm bg-mc-surface-2 px-2 py-1 font-mono text-[12px] font-bold text-mc-text"
              >
                {code}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[12px] font-medium text-mc-text-3">Trek kod yo'q</p>
        )}
      </div>
    </section>
  );
}
