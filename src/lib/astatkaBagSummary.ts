import type { AstatkaPackage } from "@/api/services/astatkaFlights";
import { paymentLabel } from "@/lib/astatkaFormat";
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
  };
}
