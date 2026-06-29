import { useRef, useState, useMemo } from 'react';
import { Plus, Menu, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLongPress } from '@/hooks/useLongPress';
import type { FlightListItem } from '@/api/services/expectedCargo';

/** How many flights stay pinned inline; the rest move into the searchable menu. */
const MAX_INLINE_TABS = 10;

interface FlightTabProps {
  flight: FlightListItem;
  isActive: boolean;
  onSelect: () => void;
  onLongPress: () => void;
}

function FlightTab({
  flight,
  isActive,
  onSelect,
  onLongPress,
}: FlightTabProps) {
  const { consumeLongPressClick, ...longPressEventHandlers } = useLongPress(onLongPress, 500);

  const handleClick = () => {
    // Suppress the synthetic click that the browser fires after a long-press,
    // so opening the rename modal doesn't simultaneously switch the active tab.
    if (consumeLongPressClick()) return;
    onSelect();
  };

  return (
    <div
      onClick={handleClick}
      {...longPressEventHandlers}
      role="tab"
      aria-selected={isActive}
      className={cn(
        'relative flex-shrink-0 flex flex-col items-center justify-center',
        'px-4 py-2 min-w-[80px] max-w-[140px] cursor-pointer select-none',
        'border-t-2 transition-all duration-150',
        isActive
          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400'
          : 'border-transparent bg-[#ffffff] dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800',
      )}
    >
      <span
        className={cn(
          'text-xs font-semibold truncate max-w-full',
          isActive
            ? 'text-orange-600 dark:text-orange-400'
            : 'text-zinc-700 dark:text-zinc-300',
        )}
      >
        {flight.flight_name}
      </span>
      <span
        className={cn(
          'text-[10px] mt-0.5',
          isActive ? 'text-orange-500/70' : 'text-zinc-400 dark:text-zinc-500',
        )}
      >
        {flight.track_code_count}
      </span>
    </div>
  );
}

interface FlightBottomTabsProps {
  flights: FlightListItem[];
  orderedFlightNames: string[];
  activeFlightName: string | null;
  onSelectFlight: (name: string) => void;
  onLongPressTab: (flightName: string) => void;
  onReorder: (newOrder: string[]) => void;
  onAddFlight: () => void;
}

export function FlightBottomTabs({
  flights,
  orderedFlightNames,
  activeFlightName,
  onSelectFlight,
  onLongPressTab,
  onReorder: _onReorder,  // eslint-disable-line @typescript-eslint/no-unused-vars
  onAddFlight,
}: FlightBottomTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState('');

  // Show only the newest MAX_INLINE_TABS inline (new flights append to the end);
  // the older remainder lives in the searchable hamburger menu. The active flight
  // is always kept inline so the current selection stays visible even if it's old.
  const { inlineFlights, overflowFlights } = useMemo(() => {
    const flightMap = new Map(flights.map((f) => [f.flight_name, f]));
    const orderedFlights: FlightListItem[] = [
      ...orderedFlightNames
        .map((name) => flightMap.get(name))
        .filter((f): f is FlightListItem => f !== undefined),
      ...flights.filter((f) => !orderedFlightNames.includes(f.flight_name)),
    ];

    const inline = orderedFlights.slice(-MAX_INLINE_TABS);
    const overflow = orderedFlights.slice(0, -MAX_INLINE_TABS);
    if (activeFlightName) {
      const idx = overflow.findIndex((f) => f.flight_name === activeFlightName);
      if (idx !== -1) {
        const [activeFlight] = overflow.splice(idx, 1);
        inline.unshift(activeFlight);
      }
    }
    return { inlineFlights: inline, overflowFlights: overflow };
  }, [flights, orderedFlightNames, activeFlightName]);

  const filteredOverflow = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return overflowFlights;
    return overflowFlights.filter((f) => f.flight_name.toLowerCase().includes(q));
  }, [overflowFlights, menuQuery]);

  const hasOverflow = overflowFlights.length > 0;

  const closeMenu = () => {
    setIsMenuOpen(false);
    setMenuQuery('');
  };

  const handleSelectFromMenu = (name: string) => {
    onSelectFlight(name);
    closeMenu();
  };

  return (
    <>
      {/* Searchable overflow menu — slides up above the bottom bar */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMenu}
              className="fixed inset-0 z-[45] bg-black/40"
            />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              style={{ bottom: 64 }}
              className="fixed left-0 right-0 z-[46] mx-auto max-w-2xl px-2"
            >
              <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[55vh]">
                {/* Search header */}
                <div className="flex items-center gap-2 p-2.5 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      autoFocus
                      value={menuQuery}
                      onChange={(e) => setMenuQuery(e.target.value)}
                      placeholder="Reys nomi bo'yicha qidiring..."
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-[13px] focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all"
                    />
                  </div>
                  <button
                    onClick={closeMenu}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                    aria-label="Yopish"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Overflow flight list */}
                <div className="overflow-y-auto overscroll-contain p-1.5">
                  {filteredOverflow.length === 0 ? (
                    <p className="text-[13px] text-zinc-400 dark:text-zinc-500 text-center py-6">
                      Reys topilmadi
                    </p>
                  ) : (
                    filteredOverflow.map((flight) => {
                      const isActive = activeFlightName === flight.flight_name;
                      return (
                        <button
                          key={flight.flight_name}
                          onClick={() => handleSelectFromMenu(flight.flight_name)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            onLongPressTab(flight.flight_name);
                          }}
                          className={cn(
                            'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                            isActive
                              ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800',
                          )}
                        >
                          <span className="text-[13px] font-semibold truncate">
                            {flight.flight_name}
                          </span>
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono shrink-0">
                            {flight.track_code_count}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#ffffff] dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-stretch">
        {/* Hamburger — opens the searchable list of older flights. Only when overflow exists. */}
        {hasOverflow && (
          <button
            onClick={() => (isMenuOpen ? closeMenu() : setIsMenuOpen(true))}
            className={cn(
              'flex-shrink-0 flex flex-col items-center justify-center w-14 border-r border-zinc-100 dark:border-zinc-800 transition-colors',
              isMenuOpen
                ? 'text-orange-500 bg-orange-50 dark:bg-orange-500/10'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800',
            )}
            title="Barcha reyslar"
          >
            <Menu className="size-5" />
            <span className="text-[10px] mt-0.5 font-medium">{overflowFlights.length}</span>
          </button>
        )}

        {/* Scrollable tabs area — grows to fill all space except the plus button */}
        <div
          ref={scrollRef}
          className="flex flex-1 overflow-x-auto items-center"
          style={{ scrollbarWidth: 'none' }}
        >
          {inlineFlights.map((flight) => (
            <FlightTab
              key={flight.flight_name}
              flight={flight}
              isActive={activeFlightName === flight.flight_name}
              onSelect={() => onSelectFlight(flight.flight_name)}
              onLongPress={() => onLongPressTab(flight.flight_name)}
            />
          ))}
          {inlineFlights.length === 0 && (
            <div className="px-4 py-2 text-xs text-zinc-400 dark:text-zinc-500">Reyslar yo'q</div>
          )}
        </div>

        {/* Plus button — fixed at the right, always visible regardless of tab count */}
        <button
          onClick={onAddFlight}
          className="flex-shrink-0 flex items-center justify-center w-14 border-l border-zinc-100 dark:border-zinc-800 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
          title="Yangi reys qo'shish"
        >
          <div className="size-8 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
            <Plus className="size-5" />
          </div>
        </button>
      </div>
    </>
  );
}
