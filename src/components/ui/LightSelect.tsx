import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
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
}

interface DropdownCoords {
  top: number;
  bottom: number;
  left: number;
  width: number;
  triggerBottom: number;
  triggerTop: number;
  viewportHeight: number;
}

/**
 * Lightweight accessible select with optional search.
 * Search input is shown automatically when options.length > 4.
 *
 * The option list is rendered via createPortal to document.body so it always
 * escapes overflow:hidden / overflow-y:auto containers (e.g. modals, drawers,
 * sheets). Position is calculated from the trigger's getBoundingClientRect and
 * the dropdown flips above the trigger when there is insufficient space below.
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
  const [coords, setCoords] = useState<DropdownCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? '',
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  /**
   * Calculates dropdown coords from trigger's bounding rect.
   * Returns the coords object (does not call setCoords) so it can be used
   * synchronously inside toggle() before the state update flushes.
   */
  const getCoords = useCallback((): DropdownCoords | null => {
    if (!triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 4,
      bottom: rect.top - 4,
      left: rect.left,
      width: rect.width,
      triggerBottom: rect.bottom,
      triggerTop: rect.top,
      viewportHeight: window.innerHeight,
    };
  }, []);

  // Close on outside click/touch. We compare against both the trigger and the
  // portal-rendered dropdown because they are in separate DOM subtrees.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const insideTrigger = triggerRef.current?.contains(target) ?? false;
      const insideDropdown = dropdownRef.current?.contains(target) ?? false;
      if (!insideTrigger && !insideDropdown) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler, { passive: true });
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  // Close (and avoid stale coords) on scroll or resize while the dropdown is open.
  useEffect(() => {
    if (!open) return;
    const closeOnExternalScroll = (e: Event) => {
      // Ignore scroll events originating inside the dropdown list itself.
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setSearch('');
    };
    const closeOnResize = () => {
      setOpen(false);
      setSearch('');
    };
    window.addEventListener('scroll', closeOnExternalScroll, { passive: true, capture: true });
    window.addEventListener('resize', closeOnResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', closeOnExternalScroll, { capture: true });
      window.removeEventListener('resize', closeOnResize);
    };
  }, [open]);

  // Auto-focus search on desktop only (avoids keyboard pop-up on mobile)
  useEffect(() => {
    if (open && searchRef.current) {
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (!isMobile) {
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    }
  }, [open]);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      setSearch('');
    },
    [onChange],
  );

  // FIX: Calculate coords synchronously before opening so the portal renders
  // with correct position on the very first paint (no two-render flash).
  // setCoords must be called OUTSIDE the setOpen updater to avoid calling
  // setState inside another setState callback (React anti-pattern).
  const toggle = useCallback(() => {
    if (disabled) return;
    setOpen((prev) => {
      if (prev) {
        setSearch('');
        return false;
      }
      return true;
    });
    // setCoords called separately — safe to call alongside setOpen
    const c = getCoords();
    if (c) setCoords(c);
  }, [disabled, getCoords]);

  // Determine whether to render the dropdown above or below the trigger.
  // Prefer below; flip above when the remaining space below is less than 220px.
  const DROPDOWN_PREFERRED_HEIGHT = 220;
  const spaceBelow = coords ? coords.viewportHeight - coords.triggerBottom - 4 : 0;
  const renderAbove =
    !!coords &&
    spaceBelow < DROPDOWN_PREFERRED_HEIGHT &&
    coords.triggerTop > DROPDOWN_PREFERRED_HEIGHT;

  const dropdownStyle: React.CSSProperties = coords
    ? {
        position: 'fixed',
        left: coords.left,
        width: coords.width,
        zIndex: 9999,
        // FIX: Radix UI Dialog (modal mode) sets pointer-events:none on document.body
        // to trap interaction inside the dialog. Our portal is a child of body so it
        // inherits that and becomes unclickable even though it is visible.
        // Explicitly setting auto overrides the inherited none.
        pointerEvents: 'auto',
        ...(renderAbove
          ? { bottom: coords.viewportHeight - coords.triggerTop + 4 }
          : { top: coords.top }),
      }
    : { position: 'fixed', zIndex: 9999, pointerEvents: 'auto' };

  const dropdownPortal =
    open && coords
      ? createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            // FIX: replaced tailwindcss-animate classes (animate-in fade-in zoom-in-95)
            // with standard Tailwind transition classes that work without a plugin.
            className={[
              'bg-white dark:bg-[#1a1a1a]',
              'border border-gray-200/80 dark:border-white/[0.08]',
              'rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40',
              'overflow-hidden',
              'transition-all duration-100 ease-out',
            ].join(' ')}
          >
            {/* Search — only when more than 4 options */}
            {options.length > 4 && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-white/[0.05]">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="p-0.5">
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
              </div>
            )}

            {/* Option list */}
            <div className="max-h-52 overflow-y-auto overscroll-contain py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-sm text-gray-400 text-center">{emptyText}</p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    // FIX: onMouseDown fires before the document mousedown outside-click
                    // handler can close the dropdown. onClick fires AFTER mousedown —
                    // if the outside handler closes the portal first, the button unmounts
                    // and the click never reaches handleSelect.
                    onMouseDown={() => handleSelect(opt.value)}
                    className={[
                      'flex items-center w-full px-3 py-2.5 text-sm text-left',
                      'transition-colors duration-75',
                      'active:bg-orange-100 dark:active:bg-orange-500/20',
                      opt.value === value
                        ? 'text-orange-600 dark:text-orange-400 bg-orange-50/70 dark:bg-orange-500/10 font-medium'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.04]',
                    ].join(' ')}
                  >
                    <Check
                      className={`w-4 h-4 mr-2 shrink-0 ${
                        opt.value === value ? 'opacity-100 text-orange-500' : 'opacity-0'
                      }`}
                    />
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={[
          // FIX: added focus:outline-none to prevent native outline clashing with ring-2
          'flex items-center w-full p-3 rounded-xl text-left text-[14px]',
          'bg-gray-50/80 dark:bg-white/[0.04]',
          'border transition-all duration-100',
          'focus:outline-none',
          error
            ? 'border-red-400 dark:border-red-500/50 focus:ring-2 focus:ring-red-500/20'
            : 'border-gray-200/80 dark:border-white/[0.08]',
          disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer',
          open ? 'ring-2 ring-orange-500/20 border-orange-500/50' : '',
        ].join(' ')}
      >
        <span
          className={`flex-1 truncate ${
            value ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'
          }`}
        >
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {dropdownPortal}
    </div>
  );
});

export default LightSelect;