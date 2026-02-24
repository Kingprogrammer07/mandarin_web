import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Filter, Download } from 'lucide-react';
import { exportPayments } from '@/api/services/stats';
import { getTashkentDateIso } from '@/lib/format';

interface PaymentFiltersProps {
  onFilterChange: (filters: PaymentFilters) => void;
  isLoading?: boolean;
}

export interface PaymentFilters {
  startDate?: string;
  endDate?: string;
  provider?: 'cash' | 'click' | 'payme' | 'all';
  format?: 'csv' | 'json';
}

export default function PaymentFilters({ onFilterChange, isLoading = false }: PaymentFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<PaymentFilters>({
    provider: 'all',
    format: 'csv'
  });

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    const newFilters = { ...filters, [`${type}Date`]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleProviderChange = (provider: 'cash' | 'click' | 'payme' | 'all') => {
    const newFilters = { ...filters, provider };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleFormatChange = (format: 'csv' | 'json') => {
    const newFilters = { ...filters, format };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleExport = () => {
    exportPayments(filters.startDate, filters.endDate, filters.provider === 'all' ? undefined : filters.provider, filters.format);
  };

  const handleQuickDateRange = (range: 'today' | 'week' | 'month') => {
    const now = new Date();
    let startDate: string;
    const endDate: string = getTashkentDateIso(now);


    switch (range) {
      case 'today':
        startDate = endDate;
        break;
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = getTashkentDateIso(weekAgo);
        break;
      }
      case 'month': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = getTashkentDateIso(monthAgo);
        break;
      }
    }

    const newFilters = { ...filters, startDate, endDate };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const newFilters: PaymentFilters = {
      provider: 'all',
      format: 'csv'
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 mb-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center text-white">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800">To'lov filtrlari</h3>
            <p className="text-sm text-gray-600">Statistikani filterlash va eksport qilish</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={clearFilters}
            size="sm"
            variant="outline"
            className="text-gray-600 hover:text-gray-800"
          >
            Filterlarni tozalash
          </Button>
          <Button
            onClick={() => setShowAdvanced(!showAdvanced)}
            size="sm"
            variant="outline"
            className="text-indigo-600 hover:text-indigo-800"
          >
            {showAdvanced ? 'Yashirish' : 'Qo\'shimcha filtrlar'}
          </Button>
        </div>
      </div>

      {/* Quick Date Range Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Button
          onClick={() => handleQuickDateRange('today')}
          size="sm"
          variant={filters.startDate === filters.endDate ? 'default' : 'outline'}
          className="text-xs"
        >
          Bugun
        </Button>
        <Button
          onClick={() => handleQuickDateRange('week')}
          size="sm"
          variant="outline"
          className="text-xs"
        >
          Oxirgi 7 kun
        </Button>
        <Button
          onClick={() => handleQuickDateRange('month')}
          size="sm"
          variant="outline"
          className="text-xs"
        >
          Oxirgi 30 kun
        </Button>
        <Button
          onClick={() => setShowAdvanced(true)}
          size="sm"
          variant="outline"
          className="text-xs"
        >
          Sana oralig'i
        </Button>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
          className="border-t border-gray-200 pt-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date Range */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Sana oralig'i</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Boshlanish sanasi
                  </label>
                  <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => handleDateChange('start', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Tugash sanasi
                  </label>
                  <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => handleDateChange('end', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Provider Filter */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">To'lov provayderi</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'all', label: 'Barchasi' },
                  { value: 'cash', label: 'Naqd' },
                  { value: 'click', label: 'Click' },
                  { value: 'payme', label: 'Payme' }
                ].map((provider) => (
                  <Button
                    key={provider.value}
                    onClick={() => handleProviderChange(provider.value as 'cash' | 'click' | 'payme' | 'all')}

                    size="sm"
                    variant={filters.provider === provider.value ? 'default' : 'outline'}
                    className="text-xs"
                  >
                    {provider.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Export Format */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Eksport formati</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => handleFormatChange('csv')}
                size="sm"
                variant={filters.format === 'csv' ? 'default' : 'outline'}
                className="text-xs"
              >
                CSV
              </Button>
              <Button
                onClick={() => handleFormatChange('json')}
                size="sm"
                variant={filters.format === 'json' ? 'default' : 'outline'}
                className="text-xs"
              >
                JSON
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Export Actions */}
      <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {filters.startDate && filters.endDate ? (
            <span>
              Filter: {filters.startDate} dan {filters.endDate} gacha • 
              {filters.provider && filters.provider !== 'all' && ` ${filters.provider.toUpperCase()}`}
            </span>
          ) : (
            <span>Barcha vaqtdagi to'lovlar</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleExport}
            disabled={isLoading}
            size="sm"
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Eksport qilish
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
