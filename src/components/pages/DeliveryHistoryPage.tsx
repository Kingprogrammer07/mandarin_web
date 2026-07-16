import { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Plane,
  Clock,
  CheckCircle2,
  XCircle,
  PackageOpen,
  Truck,
  AlertTriangle,
  MapPin,
  Phone,
  Receipt,
  CreditCard,
  Loader2,
  X,
  Trash2,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getDeliveryHistory,
  cancelDeliveryRequest,
  editDeliveryRequest,
  type DeliveryRequestHistoryItem,
} from '@/api/services/deliveryService';
import { nbuPaymentService } from '@/api/services/nbuPaymentService';

// Native Telegram confirm dialog when available, else the browser confirm.
function askConfirm(message: string): Promise<boolean> {
  const tg = (
    window as unknown as {
      Telegram?: {
        WebApp?: { showConfirm?: (m: string, cb: (ok: boolean) => void) => void };
      };
    }
  ).Telegram?.WebApp;
  if (tg?.showConfirm) {
    return new Promise<boolean>((resolve) => tg.showConfirm!(message, (ok) => resolve(ok)));
  }
  return Promise.resolve(window.confirm(message));
}

// ============================================
// TYPES
// ============================================

interface Props {
  onBack: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const DELIVERY_TYPE_COLORS: Record<string, string> = {
  uzpost: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  yandex: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  mandarin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  bts: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
};

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return dateStr;
  }
}

// ============================================
// STATUS BADGE
// ============================================

const StatusBadge = memo(({ status }: { status: string }) => {
  const { t } = useTranslation();
  const config: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    pending: {
      label: t('deliveryHistory.status.pending'),
      icon: <Clock className="w-3.5 h-3.5" />,
      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    },
    approved: {
      label: t('deliveryHistory.status.approved'),
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      cls: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    },
    rejected: {
      label: t('deliveryHistory.status.rejected'),
      icon: <XCircle className="w-3.5 h-3.5" />,
      cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    },
  };

  const c = config[status] ?? config.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${c.cls}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
});

// ============================================
// SKELETON
// ============================================

const SkeletonCard = () => (
  <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 space-y-3 animate-pulse backdrop-blur-md">
    <div className="flex items-center justify-between">
      <div className="h-5 w-20 rounded-lg bg-gray-200 dark:bg-white/10" />
      <div className="h-6 w-24 rounded-full bg-gray-200 dark:bg-white/10" />
    </div>
    <div className="h-4 w-3/4 rounded-lg bg-gray-200 dark:bg-white/10" />
    <div className="flex gap-2">
      <div className="h-7 w-20 rounded-xl bg-gray-200 dark:bg-white/10" />
      <div className="h-7 w-20 rounded-xl bg-gray-200 dark:bg-white/10" />
    </div>
    <div className="h-4 w-1/2 rounded-lg bg-gray-200 dark:bg-white/10" />
  </div>
);

const SkeletonList = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map((i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

// ============================================
// EMPTY STATE
// ============================================

const EmptyState = memo(() => {
  const { t } = useTranslation();
  return (
  <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-5">
      <PackageOpen className="w-10 h-10 text-gray-300 dark:text-white/15" />
    </div>
    <h3 className="text-lg font-bold text-gray-600 dark:text-gray-300 mb-1">
      {t('deliveryHistory.emptyState.title')}
    </h3>
    <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-xs">
      {t('deliveryHistory.emptyState.desc')}
    </p>
  </div>
  );
});

// ============================================
// REQUEST CARD
// ============================================

const RequestCard = memo(({ item, onChanged }: { item: DeliveryRequestHistoryItem; onChanged: () => void }) => {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(item.caption ?? '');
  const [editPhone, setEditPhone] = useState(item.phone ?? '');

  const handleCancel = async () => {
    const ok = await askConfirm(t('deliveryHistory.card.cancelConfirm'));
    if (!ok) return;
    setBusy(true);
    try {
      await cancelDeliveryRequest(item.id);
      toast.success(t('deliveryHistory.card.cancelled'));
      onChanged();
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message || t('deliveryHistory.card.actionError'));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    setBusy(true);
    try {
      await editDeliveryRequest(item.id, {
        caption: editCaption.trim() || null,
        phone_number: editPhone.trim() || null,
      });
      toast.success(t('deliveryHistory.card.edited'));
      setEditing(false);
      onChanged();
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message || t('deliveryHistory.card.actionError'));
    } finally {
      setBusy(false);
    }
  };
  const numberLocale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  // Our generated payment receipt — fetched on demand (auth-scoped blob) and
  // shown in a lightweight image overlay.
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const openReceipt = async () => {
    if (!item.payment_receipt_order_id || loadingReceipt) return;
    setLoadingReceipt(true);
    try {
      const url = await nbuPaymentService.getReceiptBlobUrl(item.payment_receipt_order_id);
      setReceiptUrl(url);
    } catch {
      // Receipt is best-effort; silently ignore (the row still shows other info).
    } finally {
      setLoadingReceipt(false);
    }
  };
  const closeReceipt = () => {
    if (receiptUrl) URL.revokeObjectURL(receiptUrl);
    setReceiptUrl(null);
  };
  const typeLabel = t(`deliveryHistory.types.${item.delivery_type}`, item.delivery_type);
  const typeColor = DELIVERY_TYPE_COLORS[item.delivery_type] ?? DELIVERY_TYPE_COLORS.bts;
  const hasUzpostLocation =
    item.delivery_type === 'uzpost' &&
    (item.uzpost_location_name || item.uzpost_location_index || item.uzpost_location_address);
  const uzpostTrackingStatus = item.uzpost_tracking_status || item.uzpost_order_status;
  const addressText = hasUzpostLocation
    ? [
        item.uzpost_location_index ? `${t('deliveryHistory.card.uzpostIndex')}: ${item.uzpost_location_index}` : null,
        item.uzpost_location_name,
        item.uzpost_location_address,
      ].filter(Boolean).join(' · ')
    : [item.region, item.address].filter(Boolean).join(', ');

  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 backdrop-blur-md transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <Truck className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${typeColor}`}>
              {typeLabel}
            </span>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 font-medium">
              {formatDate(item.created_at)}
            </p>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {/* Flight chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {item.flight_names.map((f) => (
          <span
            key={f}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-semibold"
          >
            <Plane className="w-3 h-3" />
            {f}
          </span>
        ))}
      </div>

      {/* Phone */}
      {item.phone && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2">
          <Phone className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">{item.phone}</span>
        </div>
      )}

      {/* Address */}
      {addressText && (
        <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="line-clamp-2">
            {addressText}
          </span>
        </div>
      )}

      {/* Caption / Courier note */}
      {item.caption && (
        <div className="mt-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-2.5">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
            {t('deliveryHistory.card.caption')}
          </p>
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
            {item.caption}
          </p>
        </div>
      )}

      {/* Map link for standard deliveries */}
      {item.location_url && (
        <a
          href={item.location_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          <MapPin className="w-3.5 h-3.5" />
          {t('deliveryHistory.card.openInMap')}
        </a>
      )}

      {item.delivery_type === 'uzpost' && (item.uzpost_order_number || uzpostTrackingStatus || item.uzpost_label_pdf_url) && (
        <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs dark:border-orange-500/20 dark:bg-orange-500/10">
          <div className="flex flex-wrap items-center gap-2">
            {item.uzpost_order_number && (
              <span className="rounded-lg bg-white px-2 py-1 font-bold text-orange-700 dark:bg-white/10 dark:text-orange-300">
                #{item.uzpost_order_number}
              </span>
            )}
            {uzpostTrackingStatus && (
              <span className="rounded-lg bg-emerald-50 px-2 py-1 font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                {uzpostTrackingStatus}
              </span>
            )}
            {item.uzpost_tracking_error && (
              <span className="rounded-lg bg-amber-100 px-2 py-1 font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                {t('deliveryHistory.card.trackingUnavailable')}
              </span>
            )}
          </div>
          {item.uzpost_label_pdf_url && (
            <a
              href={item.uzpost_label_pdf_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex font-bold text-orange-600 underline-offset-2 hover:underline dark:text-orange-300"
            >
              {t('deliveryHistory.card.uzpostLabel')}
            </a>
          )}
        </div>
      )}

      {/* Payment receipt (our generated check) + card that paid */}
      {(item.payment_receipt_order_id || item.payment_card_masked) && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="flex flex-wrap items-center gap-2">
            {item.payment_card_masked && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 font-mono font-bold text-emerald-700 dark:bg-white/10 dark:text-emerald-300">
                <CreditCard className="w-3.5 h-3.5" />
                {item.payment_card_masked}
              </span>
            )}
            {item.payment_amount_uzs != null && (
              <span className="rounded-lg bg-white px-2 py-1 font-bold text-emerald-700 dark:bg-white/10 dark:text-emerald-300">
                {item.payment_amount_uzs.toLocaleString(numberLocale)} {t('deliveryHistory.card.currencyUzs')}
              </span>
            )}
          </div>
          {item.payment_receipt_order_id && (
            <button
              type="button"
              onClick={openReceipt}
              disabled={loadingReceipt}
              className="mt-2 inline-flex items-center gap-1.5 font-bold text-emerald-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-emerald-300"
            >
              {loadingReceipt ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Receipt className="w-3.5 h-3.5" />
              )}
              {t('deliveryHistory.card.viewPaymentReceipt')}
            </button>
          )}
        </div>
      )}

      {/* Receipt image overlay */}
      {receiptUrl && createPortal(
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onClick={closeReceipt}
        >
          <button
            onClick={closeReceipt}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white shadow-lg backdrop-blur-md transition active:scale-90"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={receiptUrl}
            alt={t('deliveryHistory.card.paymentReceiptAlt')}
            className="max-h-[88svh] max-w-[min(92vw,420px)] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      )}

      {/* Pending: client can edit or cancel until an admin processes it */}
      {item.status === 'pending' && (
        <div className="mt-3">
          {editing ? (
            <div className="rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 p-3 space-y-2">
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder={t('deliveryHistory.card.editPhonePlaceholder')}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder={t('deliveryHistory.card.editCaptionPlaceholder')}
                rows={2}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-amber-500 resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveEdit}
                  className="flex-1 rounded-lg bg-amber-500 text-white text-sm font-bold py-2 disabled:opacity-60"
                >
                  {busy ? '…' : t('deliveryHistory.card.save')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-gray-200 dark:border-white/10 text-sm font-semibold px-4 py-2"
                >
                  {t('deliveryHistory.card.cancelEdit')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(true)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-semibold py-2 text-gray-700 dark:text-gray-200 disabled:opacity-60"
              >
                <Pencil className="w-3.5 h-3.5" /> {t('deliveryHistory.card.edit')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleCancel}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-red-200 dark:border-red-500/30 text-sm font-semibold py-2 text-red-600 dark:text-red-400 disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" /> {t('deliveryHistory.card.cancel')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Admin comment for rejected */}
      {item.status === 'rejected' && item.admin_comment && (
        <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-0.5">
              {t('deliveryHistory.card.rejectedReason')}
            </p>
            <p className="text-xs text-red-600 dark:text-red-300/80">
              {item.admin_comment}
            </p>
          </div>
        </div>
      )}

      {/* Processed date */}
      {item.processed_at && (
        <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
          {t('deliveryHistory.card.processedAt', { date: formatDate(item.processed_at) })}
        </p>
      )}
    </div>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

export default function DeliveryHistoryPage({ onBack }: Props) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<DeliveryRequestHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      if (page === 1) {
        setLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const res = await getDeliveryHistory(page, 10);
        if (!cancelled) {
          if (page === 1) {
            setRequests(res.requests);
          } else {
            setRequests((prev) => [...prev, ...res.requests]);
          }
          setHasNext(res.has_next);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const e = err as { message?: string };
          setError(e?.message || t('deliveryHistory.error.loadFailed'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsLoadingMore(false);
        }
      }
    }

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey, t]);

  return (
    <div className="pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-white/5 active:scale-90 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">{t('deliveryHistory.title')}</h1>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonList />
      ) : error ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-red-600 dark:text-red-400 font-semibold mb-1">{error}</p>
          <button
            onClick={() => { setPage(1); }}
            className="mt-3 px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-sm font-bold active:scale-95 transition-transform"
          >
            {t('deliveryHistory.error.retry')}
          </button>
        </div>
      ) : requests.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="space-y-3">
            {requests.map((item) => (
              <RequestCard
                key={item.id}
                item={item}
                onChanged={() => {
                  setPage(1);
                  setReloadKey((k) => k + 1);
                }}
              />
            ))}
          </div>

          {hasNext && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={isLoadingMore}
                className="px-6 py-2.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-sm transition-transform active:scale-95 disabled:opacity-50"
              >
                {isLoadingMore ? t('deliveryHistory.loadingMore') : t('deliveryHistory.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
