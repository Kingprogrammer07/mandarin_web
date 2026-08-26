/**
 * The receipt image, in a dialog rather than a new browser tab.
 *
 * `window.open` cost the cashier their place: the till lost focus, the receipt
 * opened behind whatever else was already open, and coming back meant finding
 * the tab again — all to glance at one photograph and then decide on the
 * payment still sitting on the other screen. Here the queue stays visible
 * underneath and Escape returns to it.
 *
 * The URL is signed and short-lived, so it is fetched when the dialog opens
 * rather than carried on the list row: a key minted when the queue was loaded
 * would already be dead by the time a busy cashier reached that row.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, ImageOff, Loader2, X } from 'lucide-react';

import {
  posNotificationService,
  type PosNotificationItem,
} from '@/api/services/posNotificationService';
import { formatTashkentDateTime, formatUzs } from '@/lib/format';

import { describeApiFailure } from './apiErrors';

export function ReceiptImageModal({
  item,
  onClose,
}: {
  item: PosNotificationItem;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    posNotificationService
      .getReceiptUrl(item.id)
      .then((response) => {
        if (!cancelled) setUrl(response.url);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(describeApiFailure(err, 'Chekni ochib bo‘lmadi').message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  const name = item.client_name?.trim() || item.client_code;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={onKeyDown}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-image-title"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-mc-xl border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-mc-border px-4 py-3">
          <div className="min-w-0">
            <h3
              id="receipt-image-title"
              className="truncate text-[15px] font-extrabold text-mc-text"
              title={name}
            >
              {name}
            </h3>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold text-mc-text-2">
              <span className="tabular-nums">{formatUzs(item.amount_paid)}</span>
              <span className="tabular-nums">
                {formatTashkentDateTime(item.created_at)}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Yangi oynada ochish"
                title="Yangi oynada ochish"
                className="flex h-10 w-10 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 transition-transform active:scale-95"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={2.2} />
              </a>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="flex h-10 w-10 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 transition-transform active:scale-95"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <div className="min-h-[240px] flex-1 overflow-auto overscroll-contain bg-mc-surface-2 p-3">
          {error ? (
            <p
              role="alert"
              className="flex h-full flex-col items-center justify-center gap-2 text-center text-[12px] font-semibold text-mc-danger"
            >
              <ImageOff className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
              {error}
            </p>
          ) : url ? (
            <img
              src={url}
              alt={`${name} yuborgan to‘lov cheki`}
              className="mx-auto max-w-full rounded-mc-md"
            />
          ) : (
            <span
              className="flex h-full items-center justify-center text-mc-text-3"
              aria-busy="true"
            >
              <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2} />
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
