import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
} from "lucide-react";
import { warehouseKeys, useUzPostOrders } from "../../api/hooks/useWarehouse";
import {
  cancelUzPostOrder,
  downloadUzPostOrdersExport,
  getUzPostOrderDetail,
  getUzPostOrderLabel,
  type UzPostOrderItem,
  type UzPostOrdersParams,
} from "../../api/services/warehouse";
import { formatTashkentDateTime } from "../../lib/format";

const PAGE_SIZE = 20;

const UZPOST_ORDER_STATUS_LABELS: Record<string, string> = {
  unassigned: "Biriktirilmagan",
  assigned: "Biriktirilgan",
  in_transit: "Yo'lda",
  in_delivery: "Yetkazilmoqda",
  delivered: "Yetkazildi",
  issued_to_recipient: "Yetkazildi",
  returned: "Qaytarildi",
  cancelled: "Bekor qilindi",
  created: "Yaratildi",
  active: "Faol",
  lost: "Yo'qoldi",
};

const PRINTER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Kutmoqda",
  CLAIMED: "Qabul qilindi",
  DOWNLOADED: "Yuklab olindi",
  PRINTED: "Chop etildi",
  FAILED: "Xatolik",
  CANCELLED: "Bekor qilindi",
};

function uzpostOrderStatusLabel(status: string | null): string {
  if (!status) return "Status yo'q";
  return UZPOST_ORDER_STATUS_LABELS[status] ?? status;
}

function printerStatusLabel(status: string | null): string {
  if (!status) return "";
  return PRINTER_STATUS_LABELS[status] ?? status;
}

function normalizeDateInput(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

function statusClassName(status: string | null): string {
  if (!status) return "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300";
  if (status === "cancelled") return "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300";
  if (status === "delivered" || status === "issued_to_recipient") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (status.includes("created") || status.includes("active") || status === "assigned") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  }
  return "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300";
}

function printerStatusClassName(status: string | null): string {
  if (!status) return "";
  if (status === "PRINTED") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (status === "FAILED") return "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300";
  return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300";
}

const actionBadgeBaseClassName =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-[11px] font-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45";

function OrderCard({
  order,
  onOpenLabel,
  onRefresh,
  onCancel,
  isBusy,
}: {
  order: UzPostOrderItem;
  onOpenLabel: (order: UzPostOrderItem) => void;
  onRefresh: (order: UzPostOrderItem) => void;
  onCancel: (order: UzPostOrderItem) => void;
  isBusy: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-black text-gray-900 dark:text-white">
              {order.order_number || `#${order.delivery_request_id}`}
            </span>
            <span className={`rounded-xl px-2.5 py-1 text-[11px] font-bold ${statusClassName(order.order_status)}`}>
              {uzpostOrderStatusLabel(order.order_status)}
            </span>
            {order.printer.status && (
              <span className={`rounded-xl px-2.5 py-1 text-[11px] font-bold ${printerStatusClassName(order.printer.status)}`}>
                Printer: {printerStatusLabel(order.printer.status)}
              </span>
            )}
          </div>

          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
            {order.client_code} · {order.full_name}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {order.flight_names.join(", ") || "Reys yo'q"} · {formatTashkentDateTime(order.created_at)}
          </p>
          <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
            {order.recipient.location_name || order.recipient.index || "UzPost filial"} · {order.recipient.address}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => onRefresh(order)}
            disabled={isBusy}
            className={`${actionBadgeBaseClassName} border-sky-200 bg-sky-50 text-sky-700 shadow-sm shadow-sky-500/5 dark:border-sky-400/15 dark:bg-sky-500/10 dark:text-sky-300`}
            title="Live ma'lumotni yangilash"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>Yangilash</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenLabel(order)}
            disabled={isBusy}
            className={`${actionBadgeBaseClassName} border-orange-200 bg-orange-50 text-orange-700 shadow-sm shadow-orange-500/5 dark:border-orange-400/15 dark:bg-orange-500/10 dark:text-orange-300`}
            title="PDF label"
          >
            <FileText className="h-4 w-4" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={() => onCancel(order)}
            disabled={isBusy || order.order_status === "cancelled" || !order.order_number}
            className={`${actionBadgeBaseClassName} border-red-200 bg-red-50 text-red-700 shadow-sm shadow-red-500/5 dark:border-red-400/15 dark:bg-red-500/10 dark:text-red-300`}
            title="Bekor qilish"
          >
            <Ban className="h-4 w-4" />
            <span>Bekor</span>
          </button>
        </div>
      </div>

      {order.label_pdf_url && (
        <a
          href={order.label_pdf_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 underline-offset-2 hover:underline dark:text-orange-300"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          PDF yorliq
        </a>
      )}
    </div>
  );
}

export default function UzPostOrdersPanel() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);

  const queryParams = useMemo<UzPostOrdersParams>(
    () => ({
      page,
      size: PAGE_SIZE,
      search: search.trim() || undefined,
      order_status: orderStatus.trim() || undefined,
      date_from: normalizeDateInput(dateFrom),
      date_to: normalizeDateInput(dateTo),
    }),
    [dateFrom, dateTo, orderStatus, page, search],
  );

  const { data, isLoading, isFetching } = useUzPostOrders(queryParams);

  const invalidateOrders = async () => {
    await queryClient.invalidateQueries({ queryKey: ["warehouse_uzpost_orders"] });
    await queryClient.invalidateQueries({ queryKey: warehouseKeys.allTransactions() });
  };

  const handleOpenLabel = async (order: UzPostOrderItem) => {
    setBusyRequestId(order.delivery_request_id);
    try {
      const response = await getUzPostOrderLabel(order.delivery_request_id);
      window.open(response.pdf_url, "_blank", "noopener,noreferrer");
      await invalidateOrders();
    } catch (error: unknown) {
      toast.error((error as { message?: string }).message ?? "PDF label olishda xatolik");
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleRefresh = async (order: UzPostOrderItem) => {
    setBusyRequestId(order.delivery_request_id);
    try {
      const detail = await getUzPostOrderDetail(order.delivery_request_id, true);
      toast.success(`${detail.order_number || order.order_number} yangilandi`);
      await invalidateOrders();
    } catch (error: unknown) {
      toast.error((error as { message?: string }).message ?? "UzPost ma'lumotini yangilab bo'lmadi");
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleCancel = async (order: UzPostOrderItem) => {
    const confirmed = window.confirm(`${order.order_number} UzPost orderini bekor qilamizmi?`);
    if (!confirmed) return;

    setBusyRequestId(order.delivery_request_id);
    try {
      await cancelUzPostOrder(order.delivery_request_id);
      toast.success(`${order.order_number} bekor qilindi`);
      await invalidateOrders();
    } catch (error: unknown) {
      toast.error((error as { message?: string }).message ?? "UzPost orderni bekor qilib bo'lmadi");
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleExport = async () => {
    const exportPromise = downloadUzPostOrdersExport({
      search: search.trim() || undefined,
      order_status: orderStatus.trim() || undefined,
      date_from: normalizeDateInput(dateFrom),
      date_to: normalizeDateInput(dateTo),
    });
    toast.promise(exportPromise, {
      loading: "Excel tayyorlanmoqda...",
      success: "Excel yuklab olindi",
      error: (error: unknown) =>
        (error as { message?: string }).message ?? "Excel yuklab olishda xatolik",
    });
    await exportPromise;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="grid gap-2 sm:grid-cols-[1fr_140px_150px_150px_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Order, mijoz kodi, ism, telefon, indeks"
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-orange-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
            />
          </label>
          <input
            value={orderStatus}
            onChange={(event) => {
              setOrderStatus(event.target.value);
              setPage(1);
            }}
            placeholder="Status"
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-orange-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
          />
          <input
            type="datetime-local"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-orange-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
          />
          <input
            type="datetime-local"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-orange-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
          />
          <button
            type="button"
            onClick={handleExport}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white active:scale-95"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
          <PackageCheck className="h-4 w-4 text-orange-500" />
          UzPost orderlar
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
        </div>
        <span className="text-xs font-semibold text-gray-400">{data?.total_count ?? 0} ta</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-white dark:bg-white/[0.03]" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm font-semibold text-gray-400 dark:border-white/[0.08] dark:bg-white/[0.03]">
          UzPost order topilmadi
        </div>
      ) : (
        <div className="space-y-2">
          {data.items.map((order) => (
            <OrderCard
              key={order.delivery_request_id}
              order={order}
              isBusy={busyRequestId === order.delivery_request_id}
              onOpenLabel={handleOpenLabel}
              onRefresh={handleRefresh}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-gray-600 disabled:opacity-40 dark:bg-white/[0.04] dark:text-gray-300"
          >
            Oldingi
          </button>
          <span className="text-sm font-bold text-gray-500">
            {page} / {data.total_pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(data.total_pages, current + 1))}
            disabled={page >= data.total_pages}
            className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-gray-600 disabled:opacity-40 dark:bg-white/[0.04] dark:text-gray-300"
          >
            Keyingi
          </button>
        </div>
      )}
    </div>
  );
}
