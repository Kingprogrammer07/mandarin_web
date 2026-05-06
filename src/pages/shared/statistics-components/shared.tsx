import { Download } from 'lucide-react';

interface ExportBtnProps {
  tab: 'cargo' | 'clients' | 'finance' | 'operational';
  exporting: string | null;
  onExport: (tab: 'cargo' | 'clients' | 'finance' | 'operational') => void;
}

export function ExportBtn({ tab, exporting, onExport }: ExportBtnProps) {
  return (
    <button
      onClick={() => onExport(tab)}
      disabled={!!exporting}
      className="flex items-center gap-1.5 h-8 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 border border-emerald-200/60 dark:border-emerald-500/20 active:scale-[0.98] disabled:opacity-60 rounded-xl transition-all"
    >
      {exporting === tab
        ? <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        : <Download className="w-3.5 h-3.5" />}
      {exporting === tab ? 'Yuklanmoqda...' : 'Excel'}
    </button>
  );
}

interface SectionHeaderProps {
  title: string;
  tab?: 'cargo' | 'clients' | 'finance' | 'operational';
  exporting?: string | null;
  onExport?: (tab: 'cargo' | 'clients' | 'finance' | 'operational') => void;
}

export function SectionHeader({ title, tab, exporting, onExport }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h2>
      {tab && onExport && <ExportBtn tab={tab} exporting={exporting ?? null} onExport={onExport} />}
    </div>
  );
}

interface TableBlockProps {
  title: string;
  children: React.ReactNode;
}

export function TableBlock({ title, children }: TableBlockProps) {
  return (
    <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <h3 className="text-sm font-bold mb-3 text-gray-700 dark:text-gray-300 uppercase tracking-wide">{title}</h3>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
