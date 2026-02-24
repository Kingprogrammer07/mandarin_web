import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

interface ComparisonBarChartProps {
  data: Array<{
    name: string;
    value: number;
    comparison?: number;
  }>;
  title?: string;
  valueLabel?: string;
  comparisonLabel?: string;
  valueFormatter?: (value: number) => string;
  color?: string;
  comparisonColor?: string;
}

export default function ComparisonBarChart({
  data,
  title,
  valueLabel = 'Value',
  comparisonLabel = 'Previous',
  valueFormatter = (value) => value.toString(),
  color = '#f97316',
  comparisonColor = '#94a3b8'
}: ComparisonBarChartProps) {
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
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
          <Bar
            dataKey="value"
            fill={color}
            name={valueLabel}
            radius={[8, 8, 0, 0]}
            animationDuration={1000}
          />
          {data[0]?.comparison !== undefined && (
            <Bar
              dataKey="comparison"
              fill={comparisonColor}
              name={comparisonLabel}
              radius={[8, 8, 0, 0]}
              animationDuration={1000}
              
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
