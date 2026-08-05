/**
 * The default cashier layout.
 *
 * Data, not code: these definitions are the same shape an admin-built template
 * will produce, so the grid never learns that one came from a file and the
 * other from the database. When the template editor lands, this becomes the
 * seed for the "Kunlik kassa" preset rather than something to replace.
 *
 * Order and widths are chosen for the question a cashier asks first — who paid,
 * for which flight, how much — with identity pinned so it survives horizontal
 * scroll on a 1366px counter monitor.
 */

import type { CashierLogItem } from "@/api/pos";
import type { GridColumn } from "@/components/grid/types";

/** Uzbek labels for the provider values the backend stores. */
const PROVIDER_LABELS: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  terminal: "Terminal",
  click: "Click",
  payme: "Payme",
  nbu: "NBU",
  uzpost: "UzPost",
  wallet: "Hamyon",
  online: "Online",
};

const SOURCE_LABELS: Record<string, string> = {
  pos: "Kassa",
  bot: "Bot",
  webapp: "Ilova",
  nbu: "NBU",
  uzpost: "UzPost",
};

export const CASHIER_LOG_COLUMNS: GridColumn<CashierLogItem>[] = [
  {
    key: "created_at",
    label: "Sana",
    width: 116,
    format: "datetime",
    frozen: true,
    accessor: (r) => r.created_at,
  },
  {
    key: "client_code",
    label: "Mijoz kodi",
    width: 108,
    format: "code",
    frozen: true,
    // Nullable on the ledger branch only: that join is a LEFT OUTER, so an
    // event whose transaction was deleted still produces a row with no client.
    // Labelled rather than blank — a blank cell reads as "not loaded yet".
    accessor: (r) => r.client_code ?? "(kodsiz)",
  },
  {
    key: "flight",
    label: "Reys",
    width: 132,
    format: "text",
    accessor: (r) => r.flight ?? "—",
  },
  {
    key: "paid_amount",
    label: "Summa",
    width: 130,
    format: "money",
    // The one column whose footer matters: it is the till total, and it must be
    // readable without scrolling to the end of 1,760 rows.
    total: "sum",
    accessor: (r) => r.paid_amount,
  },
  {
    key: "payment_provider",
    label: "To'lov turi",
    width: 100,
    format: "text",
    accessor: (r) => PROVIDER_LABELS[r.payment_provider] ?? r.payment_provider,
  },
  {
    key: "payment_source",
    label: "Manba",
    width: 92,
    format: "text",
    accessor: (r) => SOURCE_LABELS[r.payment_source] ?? r.payment_source,
  },
  {
    key: "cashier_name",
    label: "Kassir",
    width: 120,
    format: "text",
    // Automatic NBU entries genuinely have no cashier; an em dash says so
    // rather than leaving a blank the reader has to interpret.
    accessor: (r) => r.cashier_name ?? "—",
  },
  {
    key: "transaction_id",
    label: "Tranzaksiya",
    width: 96,
    format: "number",
    accessor: (r) => r.transaction_id,
  },
  {
    key: "id",
    label: "Yozuv ID",
    width: 88,
    format: "number",
    // Counted, not summed: summing primary keys is meaningless, but the row
    // count belongs somewhere visible.
    total: "count",
    accessor: (r) => r.id,
  },
];
