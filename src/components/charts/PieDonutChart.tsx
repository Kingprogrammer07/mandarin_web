import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

interface PieDonutChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  title?: string;
  colors?: string[];
  innerRadius?: number;
  valueFormatter?: (value: number) => string;
}

const DEFAULT_COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];

export default function PieDonutChart({
  data,
  title,
  colors = DEFAULT_COLORS,
  innerRadius = 60,
  valueFormatter = (value) => value.toString()
}: PieDonutChartProps) {
  const renderLabel = (entry: { value: number }) => {

    const percent = ((entry.value / data.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1);
    return `${percent}%`;
  };

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
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={90}
            fill="#8884d8"
            paddingAngle={2}
            dataKey="value"
            label={renderLabel}
            labelLine={false}
            animationDuration={1000}
            animationBegin={0}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
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
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: '11px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
