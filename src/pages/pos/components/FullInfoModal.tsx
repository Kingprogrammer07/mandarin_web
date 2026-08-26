/**
 * A client's full record.
 *
 * Opened from inside `ClientProfileDrawer`, and rendered as a child of that
 * drawer's backdrop — which is what made it feel broken:
 *
 * - The drawer's backdrop carries `onClick={onClose}`. This dialog's own
 *   backdrop closed itself but did not stop the event, so the click carried on
 *   up and closed the drawer as well. Both panels vanished at once, and getting
 *   back meant reopening the client from scratch. Every handler here now stops
 *   propagation for that reason, Escape included.
 * - `if (!profile) return null` sat above everything, so while the profile
 *   query was still in flight the button did nothing at all — no panel, no
 *   spinner, no error. There is a loading state now.
 *
 * Ported to `--mc-*` tokens: it is opened from a screen built entirely on them,
 * and a white panel with a blue gradient rail read as a different application.
 */

import { memo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";

import { formatTashkentDate } from "@/lib/format";

interface FullInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    client_code: string;
    full_name: string;
    phone?: string | null;
    passport_series?: string | null;
    pinfl?: string | null;
    date_of_birth?: string | null;
    region?: string | null;
    district?: string | null;
    address?: string | null;
    transaction_count: number;
    referral_count: number;
    extra_passports_count: number;
  } | null;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** ISO in, readable date out. The raw value was being printed as stored. */
function readableDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatTashkentDate(parsed, undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const FullInfoModal = memo(function FullInfoModal({
  isOpen,
  onClose,
  profile,
}: FullInfoModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [isOpen]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        // Stopped, or the drawer underneath closes on the same keystroke.
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  const fields = profile
    ? [
        { label: "Ism Familiya", value: profile.full_name },
        { label: "Telefon", value: profile.phone ?? "—" },
        { label: "Pasport seriyasi", value: profile.passport_series ?? "—" },
        { label: "JSHSHIR (PINFL)", value: profile.pinfl ?? "—" },
        { label: "Tug'ilgan sana", value: readableDate(profile.date_of_birth) },
        { label: "Viloyat", value: profile.region ?? "—" },
        { label: "Tuman", value: profile.district ?? "—" },
        { label: "Manzil", value: profile.address ?? "—" },
        { label: "Tranzaksiyalar", value: String(profile.transaction_count) },
        { label: "Referallar", value: String(profile.referral_count) },
        {
          label: "Qo'shimcha pasportlar",
          value: String(profile.extra_passports_count),
        },
      ]
    : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
          onClick={(event) => {
            // Closes THIS dialog only. Without the stop, the drawer's own
            // backdrop handler fires too and the cashier loses both.
            event.stopPropagation();
            onClose();
          }}
          onKeyDown={onKeyDown}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="full-info-title"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[88dvh] w-full max-w-sm flex-col overflow-hidden rounded-mc-xl border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]"
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-mc-border px-4 py-3">
              <div className="min-w-0">
                <h3
                  id="full-info-title"
                  className="text-[16px] font-extrabold text-mc-text"
                >
                  To&apos;liq ma&apos;lumot
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-mc-text-2">
                  {profile?.client_code ?? "—"}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Yopish"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 transition-transform active:scale-95"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              {!profile ? (
                <span
                  className="flex h-40 items-center justify-center text-mc-text-3"
                  aria-busy="true"
                >
                  <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2} />
                </span>
              ) : (
                <dl className="overflow-hidden rounded-mc-md bg-mc-surface-2 text-[13px]">
                  {fields.map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex items-start justify-between gap-3 border-b border-mc-border px-3.5 py-2.5 last:border-b-0"
                    >
                      <dt className="shrink-0 text-mc-text-2">{label}</dt>
                      <dd className="break-words text-right font-semibold text-mc-text">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
