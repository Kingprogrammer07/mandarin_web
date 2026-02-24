import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

interface TrendChartProps {
  data: Array<{
    name: string;
    current: number;
    previous: number;
  }>;
  title?: string;
  currentLabel?: string;
  previousLabel?: string;
  valueFormatter?: (value: number) => string;
}

export default function TrendChart({
  data,
  title,
  currentLabel = 'Current',
  previousLabel = 'Previous',
  valueFormatter = (value) => value.toString()
}: TrendChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.01 }}
      className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100"
    >
      {title && <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            stroke="#6b7280"
            style={{ fontSize: '11px' }}
            tick={{ fill: '#6b7280' }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '11px' }}
            tick={{ fill: '#6b7280' }}
            tickFormatter={valueFormatter}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '12px'
            }}
            formatter={(value) => typeof value === 'number' ? valueFormatter(value) : ''}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="current"
            stroke="#f97316"
            strokeWidth={3}
            name={currentLabel}
            dot={{ fill: '#f97316', r: 4 }}
            activeDot={{ r: 6 }}
            animationDuration={1000}
          />
          <Line
            type="monotone"
            dataKey="previous"
            stroke="#94a3b8"
            strokeWidth={2}
            name={previousLabel}
            dot={{ fill: '#94a3b8', r: 3 }}
            strokeDasharray="5 5"
            animationDuration={1000}
            
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
