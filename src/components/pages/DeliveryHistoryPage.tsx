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
  uzpost: 'bg-mc-brand-soft text-mc-brand dark:bg-mc-brand/15 dark:text-mc-brand',
  yandex: 'bg-mc-danger-soft text-mc-danger dark:bg-mc-danger/15 dark:text-mc-danger',
  mandarin: 'bg-mc-success/12 text-mc-success dark:bg-mc-success/15 dark:text-mc-success',
  bts: 'bg-mc-brand-soft text-mc-brand dark:bg-mc-brand/15 dark:text-mc-brand',
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
      cls: 'bg-mc-warn-soft text-mc-warn dark:bg-mc-brand/15 dark:text-mc-warn',
    },
    approved: {
      label: t('deliveryHistory.status.approved'),
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      cls: 'bg-mc-success/12 text-mc-success dark:bg-mc-success/12 dark:text-mc-success',
    },
    rejected: {
      label: t('deliveryHistory.status.rejected'),
      icon: <XCircle className="w-3.5 h-3.5" />,
      cls: 'bg-mc-danger-soft text-mc-danger dark:bg-mc-danger/20 dark:text-mc-danger',
    },
  };

  const c = config[status] ?? config.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${c.cls}`}
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
  <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 space-y-3 animate-pulse backdrop-blur-md">
    <div className="flex items-center justify-between">
      <div className="h-5 w-20 rounded-mc-sm bg-mc-surface-2" />
      <div className="h-6 w-24 rounded-full bg-mc-surface-2" />
    </div>
    <div className="h-4 w-3/4 rounded-mc-sm bg-mc-surface-2" />
    <div className="flex gap-2">
      <div className="h-7 w-20 rounded-mc-md bg-mc-surface-2" />
      <div className="h-7 w-20 rounded-mc-md bg-mc-surface-2" />
    </div>
    <div className="h-4 w-1/2 rounded-mc-sm bg-mc-surface-2" />
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
    <div className="w-20 h-20 rounded-full bg-mc-surface-2 flex items-center justify-center mb-5">
      <PackageOpen className="w-10 h-10 text-mc-text-3 dark:text-white/15" />
    </div>
    <h3 className="text-[15px] font-bold text-mc-text-2 mb-1">
      {t('deliveryHistory.emptyState.title')}
    </h3>
    <p className="text-[13px] text-mc-text-3 text-center max-w-xs">
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
    <div className="rounded-mc-lg bg-mc-surface border border-mc-border p-4 backdrop-blur-md transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-mc-md bg-mc-surface-2 flex items-center justify-center text-mc-text-2">
            <Truck className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className={`inline-block px-2 py-0.5 rounded-mc-sm text-[11px] font-bold ${typeColor}`}>
              {typeLabel}
            </span>
            <p className="text-[10px] text-mc-text-3 mt-0.5 font-medium">
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
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-mc-md bg-mc-brand-soft dark:bg-mc-brand/10 text-mc-brand text-[11px] font-semibold"
          >
            <Plane className="w-3 h-3" />
            {f}
          </span>
        ))}
      </div>

      {/* Phone */}
      {item.phone && (
        <div className="flex items-center gap-2 text-[11px] text-mc-text-2 mt-2">
          <Phone className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">{item.phone}</span>
        </div>
      )}

      {/* Address */}
      {addressText && (
        <div className="flex items-start gap-2 text-[11px] text-mc-text-2 mt-2">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="line-clamp-2">
            {addressText}
          </span>
        </div>
      )}

      {/* Caption / Courier note */}
      {item.caption && (
        <div className="mt-2 rounded-mc-sm bg-mc-surface-2 border border-mc-border p-2.5">
          <p className="text-[10px] font-bold text-mc-text-3 uppercase tracking-wide mb-1">
            {t('deliveryHistory.card.caption')}
          </p>
          <p className="text-[11px] text-mc-text leading-relaxed">
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
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-mc-brand underline-offset-2 dark:text-mc-brand"
        >
          <MapPin className="w-3.5 h-3.5" />
          {t('deliveryHistory.card.openInMap')}
        </a>
      )}

      {item.delivery_type === 'uzpost' && (item.uzpost_order_number || uzpostTrackingStatus || item.uzpost_label_pdf_url) && (
        <div className="mt-3 rounded-mc-md border border-mc-brand/25 bg-mc-brand-soft p-3 text-[11px] dark:border-mc-brand/20 dark:bg-mc-brand/10">
          <div className="flex flex-wrap items-center gap-2">
            {item.uzpost_order_number && (
              <span className="rounded-mc-sm bg-white px-2 py-1 font-bold text-mc-brand dark:bg-white/10 dark:text-mc-brand">
                #{item.uzpost_order_number}
              </span>
            )}
            {uzpostTrackingStatus && (
              <span className="rounded-mc-sm bg-mc-success/12 px-2 py-1 font-bold text-mc-success dark:bg-mc-success/10 dark:text-mc-success">
                {uzpostTrackingStatus}
              </span>
            )}
            {item.uzpost_tracking_error && (
              <span className="rounded-mc-sm bg-mc-warn-soft px-2 py-1 font-bold text-mc-warn dark:bg-mc-brand/10 dark:text-mc-warn">
                {t('deliveryHistory.card.trackingUnavailable')}
              </span>
            )}
          </div>
          {item.uzpost_label_pdf_url && (
            <a
              href={item.uzpost_label_pdf_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex font-bold text-mc-brand underline-offset-2 dark:text-mc-brand"
            >
              {t('deliveryHistory.card.uzpostLabel')}
            </a>
          )}
        </div>
      )}

      {/* Payment receipt (our generated check) + card that paid */}
      {(item.payment_receipt_order_id || item.payment_card_masked) && (
        <div className="mt-3 rounded-mc-md border border-mc-success/25 bg-mc-success/12 p-3 text-[11px] dark:border-mc-success/20 dark:bg-mc-success/10">
          <div className="flex flex-wrap items-center gap-2">
            {item.payment_card_masked && (
              <span className="inline-flex items-center gap-1.5 rounded-mc-sm bg-white px-2 py-1 font-mono font-bold text-mc-success dark:bg-white/10 dark:text-mc-success">
                <CreditCard className="w-3.5 h-3.5" />
                {item.payment_card_masked}
              </span>
            )}
            {item.payment_amount_uzs != null && (
              <span className="rounded-mc-sm bg-white px-2 py-1 font-bold text-mc-success dark:bg-white/10 dark:text-mc-success">
                {item.payment_amount_uzs.toLocaleString(numberLocale)} {t('deliveryHistory.card.currencyUzs')}
              </span>
            )}
          </div>
          {item.payment_receipt_order_id && (
            <button
              type="button"
              onClick={openReceipt}
              disabled={loadingReceipt}
              className="mt-2 inline-flex items-center gap-1.5 font-bold text-mc-success underline-offset-2 disabled:opacity-50 dark:text-mc-success"
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
            className="max-h-[88svh] max-w-[min(92vw,420px)] rounded-mc-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      )}

      {/* Pending: client can edit or cancel until an admin processes it */}
      {item.status === 'pending' && (
        <div className="mt-3">
          {editing ? (
            <div className="rounded-mc-md bg-mc-surface-2 dark:bg-white/[0.04] border border-mc-border p-3 space-y-2">
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder={t('deliveryHistory.card.editPhonePlaceholder')}
                className="w-full rounded-mc-sm border border-mc-border bg-mc-surface px-3 py-2 text-[16px] outline-none focus:border-mc-brand"
              />
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder={t('deliveryHistory.card.editCaptionPlaceholder')}
                rows={2}
                className="w-full rounded-mc-sm border border-mc-border bg-mc-surface px-3 py-2 text-[16px] outline-none focus:border-mc-brand resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveEdit}
                  className="flex-1 rounded-mc-sm bg-mc-brand text-mc-on-brand text-[13px] font-bold py-2 disabled:opacity-60"
                >
                  {busy ? '…' : t('deliveryHistory.card.save')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                  className="rounded-mc-sm border border-mc-border text-[13px] font-semibold px-4 py-2"
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
                className="flex-1 flex items-center justify-center gap-1.5 rounded-mc-md border border-mc-border text-[13px] font-semibold py-2 text-mc-text disabled:opacity-60"
              >
                <Pencil className="w-3.5 h-3.5" /> {t('deliveryHistory.card.edit')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleCancel}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-mc-md border border-mc-danger/25 dark:border-mc-danger/30 text-[13px] font-semibold py-2 text-mc-danger disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" /> {t('deliveryHistory.card.cancel')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Admin comment for rejected */}
      {item.status === 'rejected' && item.admin_comment && (
        <div className="mt-3 rounded-mc-md bg-mc-danger-soft border border-mc-danger/25 p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-mc-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-mc-danger mb-0.5">
              {t('deliveryHistory.card.rejectedReason')}
            </p>
            <p className="text-[11px] text-mc-danger dark:text-mc-danger">
              {item.admin_comment}
            </p>
          </div>
        </div>
      )}

      {/* Processed date */}
      {item.processed_at && (
        <p className="mt-2 text-[10px] text-mc-text-3 font-medium">
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
    // The page had no shell: no background, no width limit and no horizontal
    // padding, so it ran to the screen edges. Same treatment as every other
    // client screen.
    <div className="min-h-dvh bg-mc-bg">
      <div className="mx-auto max-w-lg px-4 pb-8 pt-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <button
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-sm
                     bg-mc-surface-2 text-mc-text transition-transform duration-150
                     active:scale-95"
          aria-label={t('deliveryHistory.back', 'Ortga')}
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
        <h1 className="min-w-0 truncate text-[16px] font-extrabold text-mc-text">
          {t('deliveryHistory.title')}
        </h1>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonList />
      ) : error ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-full bg-mc-danger-soft dark:bg-mc-danger/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-mc-danger" />
          </div>
          <p className="text-mc-danger font-semibold mb-1">{error}</p>
          <button
            onClick={() => { setPage(1); }}
            className="mt-3 px-5 py-2.5 rounded-mc-md bg-mc-surface-2 text-[13px] font-bold active:scale-95 transition-transform"
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
                className="px-6 py-2.5 rounded-full bg-mc-brand-soft dark:bg-mc-brand/10 text-mc-brand font-semibold text-[13px] transition-transform active:scale-95 disabled:opacity-50"
              >
                {isLoadingMore ? t('deliveryHistory.loadingMore') : t('deliveryHistory.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
    </div>
  );
}
