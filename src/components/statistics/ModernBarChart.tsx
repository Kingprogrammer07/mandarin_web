import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ModernBarChartProps {
  data: object[];
  title: string;
  /** Short description shown below the title */
  description?: string;
  dataKey: string;
  xAxisKey: string;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'indigo' | 'cyan' | 'gray';
  /** Full formatter used in the tooltip (may be long) */
  valueFormatter?: (value: string | number) => string;
  /** Short formatter used on the Y-axis ticks — defaults to valueFormatter */
  axisFormatter?: (value: string | number) => string;
}

const colorMaps = {
  blue: '#3b82f6',
  green: '#10b981',
  orange: '#f97316',
  purple: '#a855f7',
  red: '#f43f5e',
  indigo: '#6366f1',
  cyan: '#06b6d4',
  gray: '#6b7280',
};

export const ModernBarChart: React.FC<ModernBarChartProps> = ({
  data,
  title,
  description,
  dataKey,
  xAxisKey,
  color = 'blue',
  valueFormatter = (val) => val.toString(),
  axisFormatter,
}) => {
  const chartColor = colorMaps[color] || colorMaps.blue;
  const yTickFormatter = axisFormatter ?? valueFormatter;

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm w-full overflow-hidden">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
        {description && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="h-64 sm:h-72 md:h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
            <XAxis
              dataKey={xAxisKey}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickFormatter={yTickFormatter}
              width={55}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
              cursor={{ fill: '#f3f4f6' }}
              formatter={(value) => [value != null ? valueFormatter(value as string | number) : '', 'Qiymat']}
              labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '4px' }}
            />
            <Bar
              dataKey={dataKey}
              fill={chartColor}
              radius={[4, 4, 0, 0]}
              barSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
