import { motion } from 'framer-motion';
import { ModernAreaChart } from '@/components/statistics/ModernAreaChart';
import type { AnalyticsStatsResponse, AnalyticsEventPage } from '@/api/services/stats';
import { TableBlock } from './shared';
import { formatNum, th, tr } from './utils';

interface AnalyticsTabProps {
  analyticsData: AnalyticsStatsResponse | null;
  analyticsEventsData: AnalyticsEventPage | null;
  analyticsEventType: string;
  analyticsPage: number;
  analyticsLoading: boolean;
  onEventTypeChange: (type: string) => void;
  onPageChange: (page: number) => void;
}

export function AnalyticsTab({
  analyticsData,
  analyticsEventsData,
  analyticsEventType,
  analyticsPage,
  analyticsLoading,
  onEventTypeChange,
  onPageChange,
}: AnalyticsTabProps) {
  return (
    <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Analytics statistikasi</h2>
          <div className="flex items-center gap-2">
            <select
              value={analyticsEventType}
              onChange={(e) => { onEventTypeChange(e.target.value); }}
              className="h-9 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Barcha event turlari</option>
              {analyticsData?.summary.map((s) => (
                <option key={s.event_type} value={s.event_type}>{s.event_type}</option>
              ))}
            </select>
            {analyticsEventType && (
              <button
                onClick={() => onEventTypeChange('')}
                className="h-9 px-3 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 transition-colors"
              >
                Tozalash
              </button>
            )}
            {analyticsLoading && (
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>

        {analyticsData?.summary && analyticsData.summary.length > 0 ? (
          <TableBlock title="Event turlari bo'yicha umumiy statistika">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className={th}>Event turi</th>
                  <th className={`${th} text-right`}>Jami</th>
                  <th className={`${th} text-right`}>Unique foydalanuvchilar</th>
                  <th className={`${th} text-right`}>Oxirgi marta</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.summary.map((row) => (
                  <tr
                    key={row.event_type}
                    className={`${tr} cursor-pointer`}
                    onClick={() => onEventTypeChange(row.event_type)}
                  >
                    <td className="py-2.5 pr-4 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {row.event_type}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-sm font-bold">{formatNum(row.total_count)}</td>
                    <td className="py-2.5 pr-4 text-right text-sm text-gray-600 dark:text-gray-400">{formatNum(row.unique_users)}</td>
                    <td className="py-2.5 pr-4 text-right text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                      {row.last_occurrence
                        ? new Date(row.last_occurrence).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBlock>
        ) : !analyticsLoading && (
          <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center text-sm text-gray-400 py-10">
            Analytics ma'lumotlari mavjud emas
          </div>
        )}

        {analyticsData?.daily_trends && (
          <ModernAreaChart
            data={analyticsData.daily_trends}
            title={analyticsEventType ? `"${analyticsEventType}" kunlik dinamikasi` : 'Kunlik eventlar dinamikasi'}
            description="Tanlangan davr ichida har kuni qayd etilgan analytics eventlar soni."
            dataKey="count"
            xAxisKey="date"
            color="purple"
          />
        )}

        {analyticsEventsData && (
          <TableBlock title={`So'nggi eventlar${analyticsEventType ? ` — ${analyticsEventType}` : ''} (jami: ${formatNum(analyticsEventsData.total)})`}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className={th}>#</th>
                  <th className={th}>Event turi</th>
                  <th className={`${th} text-right`}>User ID</th>
                  <th className={th}>Ma'lumot</th>
                  <th className={`${th} text-right`}>Vaqt</th>
                </tr>
              </thead>
              <tbody>
                {analyticsEventsData.items.map((ev) => (
                  <tr key={ev.id} className={tr}>
                    <td className="py-2 pr-3 text-xs text-gray-400 tabular-nums">{ev.id}</td>
                    <td className="py-2 pr-4 font-mono text-xs font-semibold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                      {ev.event_type}
                    </td>
                    <td className="py-2 pr-4 text-right text-xs text-gray-500">{ev.user_id ?? '—'}</td>
                    <td className="py-2 pr-4 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {ev.event_data ? JSON.stringify(ev.event_data) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right text-xs text-gray-400 tabular-nums whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {analyticsEventsData.total_pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-400">
                  {analyticsPage} / {analyticsEventsData.total_pages} sahifa
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onPageChange(Math.max(1, analyticsPage - 1))}
                    disabled={analyticsPage <= 1 || analyticsLoading}
                    className="h-8 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    ← Oldingi
                  </button>
                  <button
                    onClick={() => onPageChange(Math.min(analyticsEventsData.total_pages, analyticsPage + 1))}
                    disabled={analyticsPage >= analyticsEventsData.total_pages || analyticsLoading}
                    className="h-8 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Keyingi →
                  </button>
                </div>
              </div>
            )}
          </TableBlock>
        )}
      </div>
    </motion.div>
  );
}
