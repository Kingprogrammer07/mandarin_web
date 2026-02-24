import { motion } from 'framer-motion';
import type { ReactElement } from 'react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Plane, DollarSign, Users, TrendingUp } from 'lucide-react';
import type { FlightPaymentStatsResponse, FlightPaymentStats } from '@/api/services/stats';
import { formatCurrencyUz } from '@/lib/format';

interface FlightPaymentStatsProps {
  data: FlightPaymentStatsResponse;
}

const PROVIDER_COLORS = {
  cash: '#10b981',
  click: '#3b82f6', 
  payme: '#f59e0b',
  account: '#8b5cf6'
};

const PROVIDER_LABELS = {
  cash: 'Naqd',
  click: 'Click',
  payme: 'Payme', 
  account: 'Hisob'
};

export default function FlightPaymentStatsComponent({ data }: FlightPaymentStatsProps): ReactElement {
  const getFlightProviderData = (flight: FlightPaymentStats) => [
    { name: PROVIDER_LABELS.cash, value: flight.providers.cash, provider: 'cash' },
    { name: PROVIDER_LABELS.click, value: flight.providers.click, provider: 'click' },
    { name: PROVIDER_LABELS.payme, value: flight.providers.payme, provider: 'payme' },
    { name: PROVIDER_LABELS.account, value: flight.providers.account, provider: 'account' }
  ].filter(item => item.value > 0);

  const topFlights = data.flights.slice(0, 10);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name?: string; value?: number; amount?: number; flight_name?: string; count?: number; unique_clients?: number } }> }) => {
    if (active && payload && payload[0]) {
      const flightData = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900">{flightData.flight_name || flightData.name}</p>
          <p className="text-sm text-gray-600">Summa: {formatCurrencyUz((flightData.value ?? flightData.amount ?? 0) as number)} so'm</p>
          {flightData.count && <p className="text-sm text-gray-600">Soni: {flightData.count}</p>}
          {flightData.unique_clients && <p className="text-sm text-gray-600">Mijozlar: {flightData.unique_clients}</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center text-white">
            <Plane className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800">Reyslar bo'yicha to'lovlar</h3>
            <p className="text-sm text-gray-600">
              {data.total_flights} ta reys ({data.period_start} - {data.period_end})
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-cyan-50 rounded-lg p-4 border border-cyan-200"
        >
          <div className="flex items-center gap-2 mb-2">
            <Plane className="w-5 h-5 text-cyan-600" />
            <span className="text-sm font-medium text-cyan-800">Jami reyslar</span>
          </div>
          <p className="text-2xl font-bold text-cyan-900">{data.total_flights}</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-green-50 rounded-lg p-4 border border-green-200"
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">Umumiy to'lov</span>
          </div>
          <p className="text-2xl font-bold text-green-900">
            {formatCurrencyUz(data.flights.reduce((sum, flight) => sum + flight.providers.total, 0))}
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-blue-50 rounded-lg p-4 border border-blue-200"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Jami mijozlar</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">
            {data.flights.reduce((sum, flight) => sum + flight.unique_clients, 0)}
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-purple-50 rounded-lg p-4 border border-purple-200"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">O'rtacha to'lov</span>
          </div>
          <p className="text-2xl font-bold text-purple-900">
            {formatCurrencyUz(data.flights.reduce((sum, flight) => sum + flight.providers.total, 0) / data.total_flights)}
          </p>
        </motion.div>
      </div>

      {/* Top Flights Table */}
      <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Eng daromadli reyslar (Top 10)</h4>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Reys nomi</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Jami to'lov</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Tranzaksiyalar</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Mijozlar soni</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">To'lov turlari</th>
              </tr>
            </thead>
            <tbody>
              {topFlights.map((flight, index) => (
                <motion.tr
                  key={flight.flight_name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {flight.flight_name}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-800">
                    {formatCurrencyUz(flight.providers.total)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700">
                    {flight.total_transactions}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700">
                    {flight.unique_clients}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center">
                      {flight.providers.cash > 0 && (
                        <span className="inline-block w-3 h-3 rounded-full bg-green-500 mx-1" title="Naqd"></span>
                      )}
                      {flight.providers.click > 0 && (
                        <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mx-1" title="Click"></span>
                      )}
                      {flight.providers.payme > 0 && (
                        <span className="inline-block w-3 h-3 rounded-full bg-amber-500 mx-1" title="Payme"></span>
                      )}
                      {flight.providers.account > 0 && (
                        <span className="inline-block w-3 h-3 rounded-full bg-purple-500 mx-1" title="Hisob"></span>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 3 Flights Provider Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {topFlights.slice(0, 3).map((flight, index) => (
          <motion.div
            key={flight.flight_name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className="bg-white rounded-lg p-4 border border-gray-200"
          >
            <h5 className="font-semibold text-gray-800 mb-3 truncate" title={flight.flight_name}>
              {flight.flight_name}
            </h5>
            <div className="text-sm text-gray-600 mb-3">
              {formatCurrencyUz(flight.providers.total)} • {flight.unique_clients} mijoz
            </div>
            
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={getFlightProviderData(flight)}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={60}
                  fill="#8884d8"
                  paddingAngle={2}
                  dataKey="value"
                  animationDuration={800}
                >
                  {getFlightProviderData(flight).map((entry, idx) => (
                    <Cell 
                      key={`cell-${idx}`} 
                      fill={PROVIDER_COLORS[entry.provider as keyof typeof PROVIDER_COLORS]} 
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
