import type { AstatkaPackage, AstatkaPackagePrice } from "@/api/services/astatkaFlights";
import { formatDateTime, paymentLabel } from "@/lib/astatkaFormat";
import { sourceCompanyLabel, sourceCompanyOf } from "@/lib/astatkaSource";
import {
  rowCodes,
  rowView,
  stateLabel,
  type WorkRow,
  type WorkRowState,
} from "@/lib/astatkaWorkQueue";

/**
 * What the bag window shows about one bag, whichever list it was opened
 * from: a saved package of the astatka, or a row of the work-mode screen.
 */

export type BagStatusTone = "success" | "warn" | "brand" | "danger" | "neutral";

export interface BagSummary {
  statusLabel: string;
  statusTone: BagStatusTone;
  clientCode: string;
  clientName: string | null;
  /** "" when the flight the bag came from is unknown. */
  sourceFlight: string;
  weightKg: number | null;
  /** The weight was typed by a worker, not taken from the photo report. */
  weightEdited: boolean;
  /** "Bor · 2 ta" / "Yo'q"; `null` while nothing is known about the bag. */
  photoReport: string | null;
  payment: string | null;
  /** The payment row says the client already took it. */
  takenAway: boolean;
  confirmedBy: string | null;
  timeIso: string | null;
  comment: string | null;
  trackCodes: string[];
  /** Why a scan row is stuck, and the server's warnings about it. */
  notes: string[];
  /** "" for our own cargo, otherwise the partner's code ("AKB"). */
  sourceCompany: string;
  /** The partner's name for its chip; "" for our own cargo. */
  sourceCompanyName: string;
  /**
   * How the astatka's own «Yuborish» already notified the client, one line
   * per channel ("Bot · 16.10.2026, 14:20"); `null` while it has not.
   */
  astatkaSent: string | null;
  /** A weight typed here repriced the bag: the first price and today's. */
  price: AstatkaPackagePrice | null;
  /** «Ostatkadan berish»: "22.10.2026, 15:40 · ombor1"; `null` while on the shelf. */
  handedOut: string | null;
}

/** Under the weight field of our own bag: what typing a weight does. */
export function ownWeightHint(sourceFlight: string): string {
  const flight = sourceFlight || "eski";
  return `Vazn o'zgarsa, to'lanmagan yukning narxi ${flight} reysida shu vazndan qayta hisoblanadi. Bo'sh qolsa, foto hisobotdagi og'irlik olinadi.`;
}

function handedOutLabel(
  pkg: Pick<AstatkaPackage, "handed_out_at" | "handed_out_by"> | null | undefined,
): string | null {
  if (!pkg?.handed_out_at) return null;
  return [formatDateTime(pkg.handed_out_at), pkg.handed_out_by].filter(Boolean).join(" · ");
}

type SentFields = Pick<AstatkaPackage, "sent_at" | "sent_web_at">;

/** The astatka's own «Yuborish» already notified the client about the bag. */
export function isSentFromAstatka(pkg: SentFields | null | undefined): boolean {
  return Boolean(pkg?.sent_at || pkg?.sent_web_at);
}

export function astatkaSentLabel(pkg: SentFields | null | undefined): string | null {
  const parts: string[] = [];
  if (pkg?.sent_at) parts.push(`Bot · ${formatDateTime(pkg.sent_at)}`);
  if (pkg?.sent_web_at) parts.push(`Sayt · ${formatDateTime(pkg.sent_web_at)}`);
  return parts.length > 0 ? parts.join("\n") : null;
}

function photoReportLabel(hasPhoto: boolean, bags: number): string {
  return hasPhoto ? `Bor · ${bags} ta` : "Yo'q";
}

export function summaryFromPackage(pkg: AstatkaPackage): BagSummary {
  const confirmed = pkg.status === "confirmed";
  return {
    statusLabel: confirmed ? "Tasdiqlangan" : "Kutilmoqda",
    statusTone: confirmed ? "success" : "warn",
    clientCode: pkg.client_code,
    clientName: pkg.client_name,
    sourceFlight: pkg.source_flight_name,
    weightKg: pkg.weight_kg,
    weightEdited: pkg.weight_edited,
    photoReport: photoReportLabel(pkg.has_photo, pkg.bags),
    payment: paymentLabel(pkg.payment_state),
    takenAway: pkg.taken_away,
    confirmedBy: pkg.confirmed_by,
    timeIso: pkg.confirmed_at ?? pkg.created_at,
    comment: pkg.comment,
    trackCodes: pkg.track_codes,
    notes: [],
    sourceCompany: sourceCompanyOf(pkg),
    sourceCompanyName: sourceCompanyLabel(pkg),
    astatkaSent: astatkaSentLabel(pkg),
    price: pkg.price ?? null,
    handedOut: handedOutLabel(pkg),
  };
}

const ROW_TONE: Record<WorkRowState, BagStatusTone> = {
  checking: "neutral",
  waiting_net: "warn",
  ready: "brand",
  saving: "neutral",
  queued: "warn",
  confirmed: "success",
  other_astatka: "danger",
  not_found: "danger",
  failed: "danger",
};

/** States whose message says what is wrong, not just what happened. */
const STUCK: WorkRowState[] = ["waiting_net", "other_astatka", "not_found", "failed"];

export function summaryFromRow(row: WorkRow): BagSummary {
  const view = rowView(row);
  const pkg = row.pkg;
  return {
    statusLabel: stateLabel(row.state),
    statusTone: ROW_TONE[row.state],
    clientCode: view.clientCode,
    clientName: view.clientName,
    sourceFlight: view.sourceFlight,
    weightKg: view.weightKg,
    weightEdited: view.weightEdited,
    photoReport: pkg ? photoReportLabel(view.hasPhoto, view.bags) : null,
    payment: paymentLabel(pkg?.payment_state),
    takenAway: view.takenAway,
    confirmedBy: pkg?.confirmed_by ?? null,
    timeIso: view.timeIso,
    comment: row.edits.comment ?? pkg?.comment ?? null,
    trackCodes: rowCodes(row),
    notes: [...(STUCK.includes(row.state) && row.message ? [row.message] : []), ...row.warnings],
    sourceCompany: view.sourceCompany,
    sourceCompanyName: view.sourceCompanyName,
    astatkaSent: astatkaSentLabel(pkg),
    price: pkg?.price ?? null,
    handedOut: handedOutLabel(pkg),
  };
}
