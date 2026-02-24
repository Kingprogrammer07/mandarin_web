import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { FilterType, SortOrder } from '@/api/transactions';
import { ArrowUpDown, Filter, X } from 'lucide-react';

interface TransactionFiltersProps {
  filterType: FilterType;
  sortOrder: SortOrder;
  flightCode?: string;
  flights: string[];
  onFilterTypeChange: (type: FilterType) => void;
  onSortOrderChange: (order: SortOrder) => void;
  onFlightCodeChange: (code: string | undefined) => void;
}

export function TransactionFilters({
  filterType,
  sortOrder,
  flightCode,
  flights,
  onFilterTypeChange,
  onSortOrderChange,
  onFlightCodeChange,
}: TransactionFiltersProps) {
  const handleClearFilters = () => {
    onFilterTypeChange('all');
    onSortOrderChange('desc');
    onFlightCodeChange(undefined);
  };

  const hasActiveFilters = filterType !== 'all' || sortOrder !== 'desc' || flightCode;

  return (
    <div className="space-y-3">
      {/* Mobile: Stack vertically, Desktop: Horizontal */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Select value={filterType} onValueChange={(v) => onFilterTypeChange(v as FilterType)}>
            <SelectTrigger className="w-full sm:w-[140px] h-11">
              <SelectValue placeholder="Holat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              <SelectItem value="taken">Olib ketilgan</SelectItem>
              <SelectItem value="not_taken">Kutilmoqda</SelectItem>
              <SelectItem value="partial">Qisman to'lov</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Select value={sortOrder} onValueChange={(v) => onSortOrderChange(v as SortOrder)}>
            <SelectTrigger className="w-full sm:w-[140px] h-11">
              <SelectValue placeholder="Tartib" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Yangi avval</SelectItem>
              <SelectItem value="asc">Eski avval</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {flights.length > 0 && (
          <Select
            value={flightCode || 'all'}
            onValueChange={(v) => onFlightCodeChange(v === 'all' ? undefined : v)}
          >
            <SelectTrigger className="w-full sm:w-[180px] h-11">
              <SelectValue placeholder="Reys tanlang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha reyslar</SelectItem>
              {flights.map((flight) => (
                <SelectItem key={flight} value={flight}>
                  {flight}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-muted-foreground hover:text-foreground w-full sm:w-auto h-11"
          >
            <X className="h-4 w-4 mr-1" />
            Tozalash
          </Button>
        )}
      </div>
    </div>
  );
}
