import {
  useState,
  useRef,
  useMemo,
  useCallback,
  memo,
  type WheelEvent,
} from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface LightSelectOption {
  value: string;
  label: string;
}

interface LightSelectProps {
  options: LightSelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  /**
   * @deprecated No longer needed. Radix Popover handles Dialog / Drawer
   * focus-scope and positioning automatically. Kept for API compatibility
   * but has no effect.
   */
  portalContainer?: Element | null;
}

/**
 * Lightweight accessible select with optional search, built on Radix Popover.
 *
 * WHY RADIX POPOVER (not a custom portal):
 * - Radix Popover correctly handles `position: fixed` + CSS-transform conflicts
 *   that arise when nesting inside Radix Dialog (which uses
 *   `translate-x-[-50%] translate-y-[-50%]` for centering).
 * - It participates in the Dialog's FocusScope, so the search input receives
 *   focus without Radix re-trapping it back to the dialog.
 * - `avoidCollisions` + `side` give automatic flip-above/below behavior.
 * - The `portalContainer` prop is now a no-op (kept for API compatibility).
 *
 * Search input is shown automatically when options.length > 4.
 */
const LightSelect = memo(function LightSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Qidirish...',
  emptyText = 'Topilmadi.',
  disabled = false,
  error = false,
  className = '',
}: LightSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Manual wheel handler for the options list.
   *
   * WHY: Radix Dialog uses `react-remove-scroll` which intercepts native wheel
   * events and may call `preventDefault()` on them (blocking native browser
   * scroll) when the scroll target is outside the Dialog's isolated content
   * area. Our options list is portaled to `document.body`, so it's technically
   * "outside" from react-remove-scroll's perspective.
   *
   * Directly assigning to `scrollTop` bypasses the browser's native scroll
   * pipeline entirely — `preventDefault()` cannot cancel it — so the list
   * always scrolls correctly regardless of any lock.
   */
  const handleListWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (listRef.current) {
      listRef.current.scrollTop += e.deltaY;
    }
  }, []);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? '',
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const showSearch = options.length > 4;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (disabled) return;
      setOpen(nextOpen);
      if (!nextOpen) setSearch('');
    },
    [disabled],
  );

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      setSearch('');
    },
    [onChange],
  );

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <div className={`relative ${className}`}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-expanded={open}
            aria-haspopup="listbox"
            className={[
              'flex items-center w-full px-3 py-2.5 rounded-xl text-left text-[14px]',
              'bg-gray-50/80 dark:bg-white/[0.04]',
              'border transition-all duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30',
              error
                ? 'border-red-400 dark:border-red-500/50'
                : open
                  ? 'border-orange-400/60 dark:border-orange-500/40 ring-2 ring-orange-500/20'
                  : 'border-gray-200/80 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14]',
              disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer',
            ].join(' ')}
          >
            <span
              className={`flex-1 truncate ${
                value
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-600'
              }`}
            >
              {selectedLabel || placeholder}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
        </PopoverPrimitive.Trigger>

        {/*
         * Popover.Portal renders outside the Dialog's DOM tree (to document.body)
         * BUT Radix automatically adds focus-guard elements so the Dialog's
         * FocusScope treats the portal content as "inside" — no focus-stealing.
         *
         * Popover.Content uses @floating-ui for positioning, which correctly
         * handles CSS-transform containing-block issues (unlike a hand-rolled
         * `position: fixed` that breaks inside translated dialogs).
         */}
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            side="bottom"
            align="start"
            avoidCollisions
            collisionPadding={8}
            sideOffset={4}
            onOpenAutoFocus={(e) => {
              // Focus the search input on open (desktop only).
              // We handle this manually so we can skip it on touch devices
              // (prevents the mobile keyboard from popping up unexpectedly).
              e.preventDefault();
              const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
              if (!isMobile && showSearch && searchRef.current) {
                searchRef.current.focus();
              }
            }}
            style={{ width: 'var(--radix-popover-trigger-width)' }}
            className={[
              'z-[9999]',
              'bg-white dark:bg-[#1c1c1c]',
              'border border-gray-200/80 dark:border-white/[0.08]',
              'rounded-2xl shadow-2xl shadow-black/[0.12] dark:shadow-black/50',
              'overflow-hidden',
              'outline-none',
            ].join(' ')}
          >
            {/* Search bar */}
            {showSearch && (
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-white/[0.06]">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="flex-1 bg-transparent text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Option list */}
            <div
              ref={listRef}
              onWheel={handleListWheel}
              className="max-h-56 overflow-y-auto overscroll-contain py-1"
            >
              {filtered.length === 0 ? (
                <p className="px-3 py-5 text-[13px] text-gray-400 text-center">
                  {emptyText}
                </p>
              ) : (
                filtered.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={[
                        'flex items-center w-full px-3 py-2.5 text-[13px] text-left',
                        'transition-colors duration-75',
                        isSelected
                          ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/[0.1] font-semibold'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.04]',
                      ].join(' ')}
                    >
                      <span
                        className={`w-4 h-4 mr-2.5 shrink-0 flex items-center justify-center rounded-full transition-all ${
                          isSelected
                            ? 'bg-orange-500 text-white'
                            : 'border border-gray-300 dark:border-white/20'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                      </span>
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </div>
    </PopoverPrimitive.Root>
  );
});

export default LightSelect;
