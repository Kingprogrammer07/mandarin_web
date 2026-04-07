import { useRef, useCallback } from 'react';
import { Search } from 'lucide-react';

export type SearchType = 'name' | 'code' | 'phone';

interface SearchAndFilterBarProps {
  value: string;
  onChange: (value: string) => void;
  searchType: SearchType;
  onSearchTypeChange: (type: SearchType) => void;
}

const SEARCH_TYPE_OPTIONS: { value: SearchType; label: string; placeholder: string }[] = [
  { value: 'name', label: 'Ism', placeholder: "To'liq ism bo'yicha qidiring..." },
  { value: 'code', label: 'Kod', placeholder: "Mijoz kodi bo'yicha qidiring..." },
  { value: 'phone', label: 'Tel', placeholder: "Telefon raqam bo'yicha qidiring..." },
];

export default function SearchAndFilterBar({
  value,
  onChange,
  searchType,
  onSearchTypeChange,
}: SearchAndFilterBarProps) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => onChange(rawValue), 400);
    },
    [onChange],
  );

  const currentOption = SEARCH_TYPE_OPTIONS.find((o) => o.value === searchType)!;

  return (
    <div className="flex gap-2 items-center">
      {/* Search type segmented control */}
      <div className="flex rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] p-0.5 flex-shrink-0">
        {SEARCH_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSearchTypeChange(opt.value)}
            className={`px-3 h-8 rounded-[10px] text-[12px] font-semibold transition-all ${
              searchType === opt.value
                ? 'bg-white dark:bg-white/[0.12] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
        <input
          key={searchType}
          type="text"
          defaultValue={value}
          onChange={handleInputChange}
          placeholder={currentOption.placeholder}
          className="w-full h-10 pl-10 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all text-[13px]"
        />
      </div>
    </div>
  );
}
