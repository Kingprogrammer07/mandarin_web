import React from 'react';
import { Calendar } from 'lucide-react';

interface DateFilterProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

const toISO = (d: Date) => d.toISOString().split('T')[0];

const buildPresets = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = toISO(now);

  return [
    {
      label: 'Bu oy',
      start: toISO(new Date(y, m, 1)),
      end: today,
    },
    {
      label: "O'tgan oy",
      start: toISO(new Date(y, m - 1, 1)),
      end: toISO(new Date(y, m, 0)),
    },
    {
      label: 'Bu yil',
      start: toISO(new Date(y, 0, 1)),
      end: today,
    },
    {
      label: "O'tgan yil",
      start: toISO(new Date(y - 1, 0, 1)),
      end: toISO(new Date(y - 1, 11, 31)),
    },
  ];
};

export const DateFilter: React.FC<DateFilterProps> = ({ startDate, endDate, onChange }) => {
  const presets = buildPresets();
  const activePreset = presets.find((p) => p.start === startDate && p.end === endDate)?.label ?? null;

  return (
    <div className="flex flex-col gap-2 w-full md:w-auto">
      {/* Shortcut preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const isActive = activePreset === preset.label;
          return (
            <button
              key={preset.label}
              onClick={() => onChange(preset.start, preset.end)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Date pickers */}
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 w-full md:w-auto">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-xl text-indigo-600 dark:text-indigo-400 hidden sm:flex">
            <Calendar className="w-4 h-4" />
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChange(e.target.value, endDate)}
            className="bg-transparent border-none text-sm font-medium focus:ring-0 text-gray-700 dark:text-gray-200 cursor-pointer w-full sm:w-auto px-2 outline-none"
          />
        </div>
        <div className="w-full sm:w-px h-px sm:h-6 bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
        <div className="text-gray-400 font-medium text-sm hidden sm:block">-</div>
        <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
          <input
            type="date"
            value={endDate}
            onChange={(e) => onChange(startDate, e.target.value)}
            className="bg-transparent border-none text-sm font-medium focus:ring-0 text-gray-700 dark:text-gray-200 cursor-pointer w-full sm:w-auto px-2 outline-none"
          />
        </div>
      </div>
    </div>
  );
};
