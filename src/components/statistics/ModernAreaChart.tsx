import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ModernAreaChartProps {
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
  blue: { stroke: '#3b82f6', fill: 'url(#colorBlue)' },
  green: { stroke: '#10b981', fill: 'url(#colorGreen)' },
  orange: { stroke: '#f97316', fill: 'url(#colorOrange)' },
  purple: { stroke: '#a855f7', fill: 'url(#colorPurple)' },
  red: { stroke: '#f43f5e', fill: 'url(#colorRed)' },
  indigo: { stroke: '#6366f1', fill: 'url(#colorIndigo)' },
  cyan: { stroke: '#06b6d4', fill: 'url(#colorCyan)' },
  gray: { stroke: '#6b7280', fill: 'url(#colorGray)' },
};

const gradientStops = {
  blue: ['#3b82f6', '#93c5fd'],
  green: ['#10b981', '#6ee7b7'],
  orange: ['#f97316', '#fdba74'],
  purple: ['#a855f7', '#d8b4fe'],
  red: ['#f43f5e', '#fda4af'],
  indigo: ['#6366f1', '#a5b4fc'],
  cyan: ['#06b6d4', '#67e8f9'],
  gray: ['#6b7280', '#d1d5db'],
};

export const ModernAreaChart: React.FC<ModernAreaChartProps> = ({
  data,
  title,
  description,
  dataKey,
  xAxisKey,
  color = 'indigo',
  valueFormatter = (val) => val.toString(),
  axisFormatter,
}) => {
  const chartColor = colorMaps[color] || colorMaps.indigo;
  const gStops = gradientStops[color] || gradientStops.indigo;
  const yTickFormatter = axisFormatter ?? valueFormatter;

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm w-full overflow-hidden">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
        {description && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      {data.length === 0 ? (
        <div className="h-64 sm:h-72 md:h-80 w-full flex items-center justify-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">Ma'lumot mavjud emas</p>
        </div>
      ) : (
        <div className="h-64 sm:h-72 md:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id={`color${color.charAt(0).toUpperCase() + color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={gStops[0]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={gStops[1]} stopOpacity={0} />
                </linearGradient>
              </defs>
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
                formatter={(value) => [value != null ? valueFormatter(value as string | number) : '', 'Qiymat']}
                labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '4px' }}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={chartColor.stroke}
                strokeWidth={3}
                fillOpacity={1}
                fill={chartColor.fill}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
