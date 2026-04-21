import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLongPress } from '@/hooks/useLongPress';
import type { FlightListItem } from '@/api/services/expectedCargo';

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

  const flightMap = new Map(flights.map((f) => [f.flight_name, f]));
  const orderedFlights: FlightListItem[] = [
    ...orderedFlightNames
      .map((name) => flightMap.get(name))
      .filter((f): f is FlightListItem => f !== undefined),
    ...flights.filter((f) => !orderedFlightNames.includes(f.flight_name)),
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#ffffff] dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-stretch">
      {/* Scrollable tabs area — grows to fill all space except the plus button */}
      <div
        ref={scrollRef}
        className="flex flex-1 overflow-x-auto items-center"
        style={{ scrollbarWidth: 'none' }}
      >
        {orderedFlights.map((flight) => (
          <FlightTab
            key={flight.flight_name}
            flight={flight}
            isActive={activeFlightName === flight.flight_name}
            onSelect={() => onSelectFlight(flight.flight_name)}
            onLongPress={() => onLongPressTab(flight.flight_name)}
          />
        ))}
        {orderedFlights.length === 0 && (
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
  );
}
