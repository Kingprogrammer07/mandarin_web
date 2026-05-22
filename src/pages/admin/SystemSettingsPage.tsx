import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  CreditCard,
  Users,
  Loader2,
  ChevronDown,
  Activity,
} from 'lucide-react';
import { systemService } from '@/api/services/systemService';

export default function SystemSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showRedisInfo, setShowRedisInfo] = useState(false);
  const [showRedisClients, setShowRedisClients] = useState(false);

  const { data: maintenanceData, isLoading: maintenanceLoading } = useQuery({
    queryKey: ['system-maintenance'],
    queryFn: systemService.getMaintenanceStatus,
    refetchInterval: 30_000,
  });

  const { data: nbuData, isLoading: nbuLoading } = useQuery({
    queryKey: ['system-nbu'],
    queryFn: systemService.getNbuStatus,
    refetchInterval: 30_000,
  });

  const { data: redisInfo, isLoading: redisInfoLoading } = useQuery({
    queryKey: ['system-redis-info'],
    queryFn: systemService.getRedisInfo,
    enabled: showRedisInfo,
  });

  const { data: redisClients, isLoading: redisClientsLoading } = useQuery({
    queryKey: ['system-redis-clients'],
    queryFn: systemService.getRedisClients,
    enabled: showRedisClients,
  });

  const maintenanceMutation = useMutation({
    mutationFn: systemService.toggleMaintenance,
    onSuccess: (data) => {
      toast.success(data.maintenance ? 'Maintenance yoqildi' : 'Maintenance o\'chirildi');
      queryClient.invalidateQueries({ queryKey: ['system-maintenance'] });
    },
    onError: () => {
      toast.error(t('makePayment.errorOccurred'));
    },
  });

  const nbuMutation = useMutation({
    mutationFn: systemService.toggleNbu,
    onSuccess: (data) => {
      toast.success(data.enabled ? 'NBU to\'lovi yoqildi' : 'NBU to\'lovi o\'chirildi');
      queryClient.invalidateQueries({ queryKey: ['system-nbu'] });
      queryClient.invalidateQueries({ queryKey: ['nbu-status'] });
    },
    onError: () => {
      toast.error(t('makePayment.errorOccurred'));
    },
  });

  const handleToggleMaintenance = useCallback(() => {
    const next = !(maintenanceData?.maintenance === true);
    maintenanceMutation.mutate({ active: next });
  }, [maintenanceData, maintenanceMutation]);

  const handleToggleNbu = useCallback(() => {
    const next = !(nbuData?.enabled === true);
    nbuMutation.mutate({ active: next });
  }, [nbuData, nbuMutation]);

  const isMaintenanceOn = maintenanceData?.maintenance === true;
  const isNbuOn = nbuData?.enabled === true;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-6">
        Tizim sozlamalari
      </h1>

      {/* Maintenance Toggle */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isMaintenanceOn ? 'bg-amber-100 dark:bg-amber-500/15' : 'bg-gray-100 dark:bg-white/5'}`}>
              <Wrench className={`w-5 h-5 ${isMaintenanceOn ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`} />
            </div>
            <div>
              <p className="font-bold text-base text-gray-900 dark:text-white">Maintenance mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isMaintenanceOn ? 'Yoqilgan — faqat adminlar kiradi' : 'O\'chiq — barcha foydalanuvchilar'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleMaintenance}
            disabled={maintenanceLoading || maintenanceMutation.isPending}
            className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${isMaintenanceOn ? 'bg-amber-500' : 'bg-gray-300 dark:bg-white/20'} disabled:opacity-60`}
          >
            <motion.div
              className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm"
              animate={{ left: isMaintenanceOn ? 26 : 4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </div>

      {/* NBU Toggle */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isNbuOn ? 'bg-sky-100 dark:bg-sky-500/15' : 'bg-gray-100 dark:bg-white/5'}`}>
              <CreditCard className={`w-5 h-5 ${isNbuOn ? 'text-sky-600 dark:text-sky-400' : 'text-gray-500 dark:text-gray-400'}`} />
            </div>
            <div>
              <p className="font-bold text-base text-gray-900 dark:text-white">NBU onlayn to'lov</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isNbuOn ? 'Yoqilgan — kartali to\'lov ishlayapti' : 'O\'chiq — faqat manual to\'lov'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleNbu}
            disabled={nbuLoading || nbuMutation.isPending}
            className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${isNbuOn ? 'bg-sky-500' : 'bg-gray-300 dark:bg-white/20'} disabled:opacity-60`}
          >
            <motion.div
              className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm"
              animate={{ left: isNbuOn ? 26 : 4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </div>

      {/* Redis Info */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] shadow-sm overflow-hidden">
        <button
          onClick={() => setShowRedisInfo(!showRedisInfo)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="font-bold text-base text-gray-900 dark:text-white">Redis INFO</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Server statistikasi va xotira</p>
            </div>
          </div>
          <motion.div animate={{ rotate: showRedisInfo ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </motion.div>
        </button>
        <AnimatePresence>
          {showRedisInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                {redisInfoLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                  </div>
                ) : redisInfo ? (
                  <pre className="text-xs font-mono bg-gray-50 dark:bg-black/30 rounded-xl p-4 overflow-auto max-h-96 text-gray-700 dark:text-gray-300">
                    {redisInfo.info}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">Ma'lumot yo'q</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Redis Clients */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] shadow-sm overflow-hidden">
        <button
          onClick={() => setShowRedisClients(!showRedisClients)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-left">
              <p className="font-bold text-base text-gray-900 dark:text-white">Redis CLIENT LIST</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Ulangan clientlar va ular holati</p>
            </div>
          </div>
          <motion.div animate={{ rotate: showRedisClients ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </motion.div>
        </button>
        <AnimatePresence>
          {showRedisClients && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                {redisClientsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                  </div>
                ) : redisClients ? (
                  <pre className="text-xs font-mono bg-gray-50 dark:bg-black/30 rounded-xl p-4 overflow-auto max-h-96 text-gray-700 dark:text-gray-300">
                    {redisClients.clients}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">Ma'lumot yo'q</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
