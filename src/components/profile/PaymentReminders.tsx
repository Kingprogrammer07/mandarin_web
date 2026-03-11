import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Calendar, Wallet, ChevronDown, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePaymentReminders } from '@/hooks/useProfile';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type PaymentReminderItem } from '@/types/profile';
import MakePaymentModal from '@/components/modals/MakePaymentModal';

// --- Card Component ---
const ReminderCard = memo(({ reminder, idx, onPay }: { reminder: PaymentReminderItem; idx: number; onPay: (flightName: string) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1, duration: 0.4 }}
      className={cn(
        "min-w-[90vw] sm:min-w-[350px] md:min-w-0 md:w-full",
        "snap-center shrink-0"
      )}
    >
      <Card
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "relative overflow-hidden border-0 shadow-md bg-white dark:bg-[#1a1625] dark:border-white/5 transition-all cursor-pointer group",
          isExpanded ? "ring-2 ring-red-500/20 shadow-xl" : "hover:shadow-lg"
        )}
      >
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300",
          isExpanded ? "bg-red-500" : "bg-gray-300 dark:bg-gray-700 group-hover:bg-red-400"
        )} />

        <CardContent className="p-5 pl-6">

          {/* --- ALWAYS VISIBLE HEADER --- */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                <Plane className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">
                  {reminder.flight}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                  {t('profile.payments.cargoPayment')}
                </p>
              </div>
            </div>

            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className="text-gray-400"
            >
              <ChevronDown className="w-5 h-5" />
            </motion.div>
          </div>

          {/* --- COMPACT SUMMARY --- */}
          <div className="mt-4 flex justify-between items-end">
            <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:border-white/10 dark:text-gray-400 gap-1.5 py-1 px-2.5">
              <Calendar className="w-3 h-3" />
              {reminder.deadline}
            </Badge>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">{t('profile.payments.remaining')}</span>
              <span className="text-lg font-black text-red-600 dark:text-red-500">
                {reminder.remaining.toLocaleString()} UZS
              </span>
            </div>
          </div>

          {/* --- EXPANDED DETAILS --- */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="pt-4 mt-4 border-t border-dashed border-gray-100 dark:border-white/10 space-y-3">

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{t('profile.payments.totalCharged')}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{reminder.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{t('profile.payments.totalPaid')}</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">{reminder.paid.toLocaleString()}</span>
                  </div>

                  <div className="pt-2">
                    <Button className="w-full rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 h-10 font-semibold" onClick={(e) => {
                      e.stopPropagation();
                      onPay(reminder.flight);
                    }}>
                      <CreditCard className="w-4 h-4 mr-2" />
                      {t('profile.payments.payNow')}
                    </Button>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </CardContent>
      </Card>
    </motion.div>
  );
});
ReminderCard.displayName = 'ReminderCard';

// --- Skeleton ---
const PaymentRemindersSkeleton = () => (
  <div className="w-full space-y-4 mb-8">
    <div className="flex justify-between items-center px-1">
      <Skeleton className="h-7 w-32 rounded-lg" />
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>
    <div className="flex gap-4 overflow-hidden">
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-40 min-w-[90vw] sm:min-w-[350px] rounded-2xl" />
      ))}
    </div>
  </div>
);

// --- Main Component ---
export const PaymentReminders = memo(() => {
  const { data, isLoading, refetch } = usePaymentReminders();
  const { t } = useTranslation();
  const [paymentFlight, setPaymentFlight] = useState<string | null>(null);

  if (isLoading) return <PaymentRemindersSkeleton />;

  if (!data?.reminders || data.reminders.length === 0) return null;

  return (
    <section className="w-full mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Section Header */}
      <div className="flex items-center justify-between px-1 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-red-100 dark:bg-red-500/10 rounded-lg">
            <Wallet className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('profile.payments.title')}
          </h3>
        </div>

        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1.5 animate-pulse" />
          {t('profile.payments.count', { count: data.reminders.length })}
        </span>
      </div>

      {/* Cards Container */}
      <div
        className={cn(
          "flex overflow-x-auto pb-6 gap-4 snap-x snap-mandatory",
          "scrollbar-hide",
          "md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible md:pb-0"
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {data.reminders.map((reminder, idx) => (
          <ReminderCard key={idx} reminder={reminder} idx={idx} onPay={setPaymentFlight} />
        ))}
      </div>

      {/* Payment Modal */}
      <MakePaymentModal
        isOpen={!!paymentFlight}
        onClose={() => {
          setPaymentFlight(null);
          refetch?.();
        }}
        preselectedFlightName={paymentFlight}
      />
    </section>
  );
});

PaymentReminders.displayName = 'PaymentReminders';