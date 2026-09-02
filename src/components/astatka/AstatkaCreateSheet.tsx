import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";

import { suggestAstatkaName } from "./naming";

/**
 * Creating a stock-take: give it a name, pick the flights it covers.
 *
 * A bottom sheet rather than a centred dialog because the worker is holding the
 * phone one-handed — the controls belong within thumb reach at the bottom, not
 * floating in the middle of the screen.
 */

interface Props {
  open: boolean;
  flights: string[];
  isLoadingFlights: boolean;
  flightsError: string | null;
  isCreating: boolean;
  error: string | null;
  onRetryFlights: () => void;
  onClose: () => void;
  onCreate: (payload: { name: string; flight_names: string[] }) => void;
}

/**
 * The sheet mounts only while it is open, so its state starts fresh every time
 * rather than being reset by an effect. Resetting in an effect renders once
 * with the previous values before correcting itself — which here would flash
 * the last stock-take's name and flight selection at the worker.
 */
export function AstatkaCreateSheet(props: Props) {
  if (!props.open) return null;
  return <CreateSheetBody {...props} />;
}

function CreateSheetBody({
  flights,
  isLoadingFlights,
  flightsError,
  isCreating,
  error,
  onRetryFlights,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState(() => suggestAstatkaName(new Date()));
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visible = useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) return flights;
    return flights.filter((flight) => flight.toUpperCase().includes(needle));
  }, [flights, query]);

  const toggle = (flight: string) => {
    setSelected((current) =>
      current.includes(flight)
        ? current.filter((item) => item !== flight)
        : [...current, flight],
    );
  };

  const canSubmit = name.trim().length >= 2 && !isCreating;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="astatka-create-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-mc-xl border border-mc-border bg-mc-surface pb-[env(safe-area-inset-bottom)] shadow-[var(--mc-shadow-card)] sm:max-w-md sm:rounded-mc-xl sm:pb-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 p-4 pb-3">
          <div>
            <h2
              id="astatka-create-title"
              className="text-[16px] font-extrabold text-mc-text"
            >
              Yangi astatka
            </h2>
            <p className="mt-0.5 text-[12px] font-medium text-mc-text-3">
              Nom bering va qaysi reyslarni qamrashini tanlang
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-3"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        {/* min-h-0 so this scrolls instead of pushing the footer off-screen */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          <label
            htmlFor="astatka-name"
            className="mb-1.5 block text-[12px] font-semibold text-mc-text-2"
          >
            Astatka nomi
          </label>
          <input
            id="astatka-name"
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="OSTATKA-02.09"
            // 16px is not a style choice: below it iOS zooms the page on focus
            // and never zooms back.
            className="h-11 w-full rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 text-[16px] font-medium text-mc-text placeholder:text-mc-text-3 focus:border-mc-brand focus:outline-none"
          />

          <div className="mt-4 mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-semibold text-mc-text-2">
              Reyslar
            </span>
            <span className="text-[11px] font-medium text-mc-text-3">
              {selected.length > 0
                ? `${selected.length} ta tanlandi`
                : "Tanlanmasa — barcha reys qabul qilinadi"}
            </span>
          </div>

          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mc-text-3" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Reys qidirish"
              aria-label="Reys qidirish"
              className="h-11 w-full rounded-mc-md border border-mc-border bg-mc-surface-2 pl-9 pr-3 text-[16px] font-medium text-mc-text placeholder:text-mc-text-3 focus:border-mc-brand focus:outline-none"
            />
          </div>

          {isLoadingFlights && (
            <div className="space-y-2 py-2">
              {[0, 1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="h-11 animate-pulse rounded-mc-md bg-mc-surface-2"
                />
              ))}
            </div>
          )}

          {flightsError && !isLoadingFlights && (
            <div className="rounded-mc-md border border-mc-danger/30 bg-mc-danger-soft p-3">
              <p className="text-[12px] font-semibold text-mc-danger">
                Reyslar ro‘yxatini olishda xatolik
              </p>
              <button
                type="button"
                onClick={onRetryFlights}
                className="mt-2 h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface text-[13px] font-bold text-mc-text"
              >
                Qayta urinish
              </button>
            </div>
          )}

          {!isLoadingFlights && !flightsError && visible.length === 0 && (
            <p className="py-6 text-center text-[12px] font-medium text-mc-text-3">
              {query.trim() ? "Bunday reys topilmadi" : "Reys yo‘q"}
            </p>
          )}

          <div className="space-y-1.5 pb-2">
            {visible.map((flight) => {
              const isSelected = selected.includes(flight);
              return (
                <button
                  key={flight}
                  type="button"
                  onClick={() => toggle(flight)}
                  aria-pressed={isSelected}
                  className={`flex h-11 w-full items-center justify-between gap-2 rounded-mc-md border px-3 text-left transition-colors active:scale-[0.99] ${
                    isSelected
                      ? "border-mc-brand bg-mc-brand-soft"
                      : "border-mc-border bg-mc-surface-2"
                  }`}
                >
                  <span className="truncate text-[13px] font-bold text-mc-text">
                    {flight}
                  </span>
                  {isSelected && (
                    <Check
                      className="h-4 w-4 shrink-0 text-mc-brand"
                      strokeWidth={2.5}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 border-t border-mc-border p-4">
          {error && (
            <p className="mb-2 text-[12px] font-semibold text-mc-danger">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-mc-md border border-mc-border text-[13px] font-bold text-mc-text-2"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() =>
                onCreate({ name: name.trim(), flight_names: selected })
              }
              className="h-11 flex-1 rounded-mc-md bg-mc-brand text-[13px] font-extrabold text-mc-on-brand disabled:opacity-50"
            >
              {isCreating ? "Yaratilmoqda…" : "Yaratish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
