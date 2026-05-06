import { Download } from 'lucide-react';
import {
  exportZombieClients,
  exportPassiveClients,
  exportFrequentClients,
} from '@/api/services/stats';

type ClientExportKey = 'zombie' | 'passive' | 'frequent';

interface ClientExportPanelProps {
  startDate: string;
  endDate: string;
  exporting: string | null;
  onExport: (key: string | null) => void;
}

const exports: { key: ClientExportKey; label: string; desc: string }[] = [
  { key: 'zombie',   label: 'Zombi mijozlar',  desc: "Hech qachon yuk buyurtma qilmaganlar" },
  { key: 'passive',  label: 'Passiv mijozlar', desc: "60+ kun ichida yuk olmagan (lekin avval olgan)" },
  { key: 'frequent', label: 'Faol mijozlar',   desc: "5+ reysda yuklari bo'lganlar" },
];

export function ClientExportPanel({ startDate, endDate, exporting, onExport }: ClientExportPanelProps) {
  const run = async (key: ClientExportKey) => {
    if (exporting) return;
    onExport(key);
    try {
      if (key === 'zombie')   await exportZombieClients(startDate, endDate);
      if (key === 'passive')  await exportPassiveClients(startDate, endDate);
      if (key === 'frequent') await exportFrequentClients(5);
    } finally {
      onExport(null);
    }
  };

  return (
    <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <h3 className="text-sm font-bold mb-1 text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        Mijozlar ro'yxatlarini yuklab olish
      </h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Har bir kategoriya bo'yicha alohida Excel fayli
      </p>
      <div className="flex flex-wrap gap-3">
        {exports.map(({ key, label, desc }) => (
          <button
            key={key}
            onClick={() => run(key)}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60 transition-all text-left group"
          >
            <span className="shrink-0">
              {exporting === key
                ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                : <Download className="w-4 h-4 text-indigo-500 group-hover:text-indigo-600" />}
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">{label}</span>
              <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
