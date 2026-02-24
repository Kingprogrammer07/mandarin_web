import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useClientProfile } from '@/hooks/useClientProfile';
import { BalanceCard } from '@/components/verification/BalanceCard';
import { formatCurrencySum, formatTashkentDate, formatTashkentDateTime } from '@/lib/format';
import {
  getFlightPaymentSummary,
  getUnpaidCargoFlights,
  type FlightPaymentSummary,
} from '@/api/verification';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  User,
  Phone,
  CreditCard,
  MapPin,
  Calendar,
  FileText,
  Plane,
  Package,
  Image,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  Receipt,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ClientProfilePageProps {
  clientId: number;
  onBack: () => void;
  onViewTransactions: (clientCode: string) => void;
  onViewUnpaidCargo: (clientCode: string) => void;
  onViewPassportImages: (clientId: number) => void;
}

export default function ClientProfilePage({
  clientId,
  onBack,
  onViewTransactions,
  onViewUnpaidCargo,
  onViewPassportImages,
}: ClientProfilePageProps) {
  const { profile, flights, isLoading, error, refetch } = useClientProfile(clientId);

  // Flight payment summary state
  const [expandedFlight, setExpandedFlight] = useState<string | null>(null);
  const [flightSummaries, setFlightSummaries] = useState<Record<string, FlightPaymentSummary>>({});
  const [loadingSummaries, setLoadingSummaries] = useState<Record<string, boolean>>({});

  // Unpaid cargo state
  const [unpaidFlights, setUnpaidFlights] = useState<string[]>([]);
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);

  // Fetch unpaid cargo flights on mount
  useEffect(() => {
    if (profile?.client_code) {
      setLoadingUnpaid(true);
      getUnpaidCargoFlights(profile.client_code)
        .then((response) => {
          setUnpaidFlights(response || []);
        })
        .catch(() => {
          setUnpaidFlights([]);
        })
        .finally(() => {
          setLoadingUnpaid(false);
        });
    }
  }, [profile?.client_code]);

  const handleFlightSummaryToggle = async (flightName: string) => {
    if (!profile?.client_code) return;

    if (expandedFlight === flightName) {
      setExpandedFlight(null);
      return;
    }

    setExpandedFlight(flightName);

    // If already loaded, don't fetch again
    if (flightSummaries[flightName]) return;

    setLoadingSummaries((prev) => ({ ...prev, [flightName]: true }));

    try {
      const summary = await getFlightPaymentSummary(profile.client_code, flightName);
      setFlightSummaries((prev) => ({ ...prev, [flightName]: summary }));
    } catch (err) {
      console.error('Failed to load flight summary:', err);
    } finally {
      setLoadingSummaries((prev) => ({ ...prev, [flightName]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700 mb-4">{typeof error === 'string' ? error : 'Xatolik yuz berdi'}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Orqaga
            </Button>
            <Button onClick={refetch}>Qayta urinish</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const getBalanceStatusBadge = (status: string) => {
    const badges = {
      debt: { label: 'Qarz', color: 'bg-red-100 text-red-700 border-red-200' },
      overpaid: { label: 'Ortiqcha to\'lov', color: 'bg-green-100 text-green-700 border-green-200' },
      balanced: { label: 'Balansda', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    };
    const badge = badges[status as keyof typeof badges] || badges.balanced;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-6 pb-20 space-y-6">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Button variant="ghost" onClick={onBack} className="pl-0 hover:bg-transparent text-muted-foreground hover:text-gray-900 -ml-2">
          <ArrowLeft className="h-5 w-5 mr-1" />
          Orqaga
        </Button>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col md:grid md:grid-cols-12 md:gap-6 md:space-y-0 space-y-6 items-start"
      >
        {/* LEFT COLUMN (Desktop: Profile, Personal Info, Actions) */}
        <div className="md:col-span-5 lg:col-span-4 space-y-6 w-full md:sticky md:top-6">
          {/* 1. CLIENT SUMMARY SECTION (Enhanced) */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-hidden relative"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center mb-4 ring-4 ring-white shadow-sm">
                <User className="h-10 w-10 text-orange-600" />
              </div>

              <h1 className="text-xl font-bold text-gray-900 mb-1">{profile.full_name}</h1>

              <div className="flex items-center gap-2 mb-4">
                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm font-medium text-gray-700">{profile.client_code}</span>
                {profile.phone && (
                  <a href={`tel:${profile.phone}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-orange-600 transition-colors">
                    <Phone className="h-3.5 w-3.5" />
                    {profile.phone}
                  </a>
                )}
              </div>

              <div className="w-full pt-4 border-t border-gray-100 flex justify-center">
                {getBalanceStatusBadge(profile.client_balance_status)}
              </div>
            </div>
          </motion.div>

          {/* 4. PERSONAL INFORMATION (Moved to Left Col) */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shaxsiy ma'lumotlar</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">Pasport</span>
                </div>
                <span className="font-medium text-gray-900">{profile.passport_series || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">PINFL</span>
                </div>
                <span className="font-medium text-gray-900 font-mono tracking-tight">{profile.pinfl || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">Viloyat</span>
                </div>
                <span className="font-medium text-gray-900">{profile.region || '-'}</span>
              </div>
              <div className="flex flex-col gap-1 py-1 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">Manzil</span>
                </div>
                <span className="font-medium text-gray-900 pl-7 text-sm">{profile.address || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Tug'ilgan sana</span>
                </div>
                <span className="font-medium text-gray-900">{profile.date_of_birth ? formatTashkentDate(profile.date_of_birth) : '-'}</span>
              </div>
            </div>
          </motion.div>

          {/* Actions (Moved to Left Col) */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 gap-4"
          >
            <motion.button
              onClick={() => profile.client_code && onViewTransactions(profile.client_code)}
              disabled={!profile.client_code}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="relative flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/50 shadow-sm hover:shadow-md transition-all group overflow-hidden w-full text-left"
            >
              <div className="absolute inset-0 bg-blue-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <span className="block font-bold text-gray-900 text-lg">Tranzaksiyalar</span>
                  <span className="text-xs text-blue-600 font-medium">To'lovlar tarixi</span>
                </div>
              </div>
              <div className="w-8 h-8 flex-shrink-0 rounded-full bg-white flex items-center justify-center shadow-sm relative z-10 group-hover:translate-x-1 transition-transform">
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600" />
              </div>
            </motion.button>

            <motion.button
              onClick={() => profile.client_code && onViewUnpaidCargo(profile.client_code)}
              disabled={!profile.client_code}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="relative flex items-center justify-between p-4 rounded-xl border border-red-100 bg-gradient-to-br from-white to-red-50/50 shadow-sm hover:shadow-md transition-all group overflow-hidden w-full text-left"
            >
              <div className="absolute inset-0 bg-red-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <span className="block font-bold text-gray-900 text-lg">To'lanmagan yuklar</span>
                  <span className="text-xs text-red-600 font-medium">Qarzdorliklar</span>
                </div>
              </div>
              <div className="w-8 h-8 flex-shrink-0 rounded-full bg-white flex items-center justify-center shadow-sm relative z-10 group-hover:translate-x-1 transition-transform">
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-red-600" />
              </div>
            </motion.button>

            <motion.button
              onClick={() => onViewPassportImages(profile.id)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="relative flex items-center justify-between p-4 rounded-xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/50 shadow-sm hover:shadow-md transition-all group overflow-hidden w-full text-left"
            >
              <div className="absolute inset-0 bg-purple-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <Image className="h-6 w-6" />
                </div>
                <div>
                  <span className="block font-bold text-gray-900 text-lg">Pasport rasmlari</span>
                  <span className="text-xs text-purple-600 font-medium">Hujjatlar</span>
                </div>
              </div>
              <div className="w-8 h-8 flex-shrink-0 rounded-full bg-white flex items-center justify-center shadow-sm relative z-10 group-hover:translate-x-1 transition-transform">
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600" />
              </div>
            </motion.button>
          </motion.div>
        </div>

        {/* RIGHT COLUMN (Desktop: Stats, Financial, Flights) */}
        <div className="md:col-span-7 lg:col-span-8 space-y-6 w-full">
          {/* Stats badges - Responsive Grid */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 text-center hover:bg-blue-50 transition-colors">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-blue-600">
                <Receipt className="h-4 w-4" />
                <span className="text-xs font-semibold">Tranzaksiya</span>
              </div>
              <p className="text-xl font-bold text-blue-900">{profile.transaction_count}</p>
            </div>
            <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-100 text-center hover:bg-purple-50 transition-colors">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-purple-600">
                <Users className="h-4 w-4" />
                <span className="text-xs font-semibold">Referallar</span>
              </div>
              <p className="text-xl font-bold text-purple-900">{profile.referral_count}</p>
            </div>
            <div className="bg-green-50/50 rounded-xl p-3 border border-green-100 text-center hover:bg-green-50 transition-colors">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-green-600">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-semibold">Pasportlar</span>
              </div>
              <p className="text-xl font-bold text-green-900">{profile.extra_passports_count}</p>
            </div>
            <div className="bg-orange-50/50 rounded-xl p-3 border border-orange-100 text-center flex flex-col justify-center hover:bg-orange-50 transition-colors">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-orange-600">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-semibold">Sana</span>
              </div>
              <p className="text-sm font-bold text-orange-900 whitespace-nowrap overflow-hidden text-ellipsis">
                {formatTashkentDate(profile.created_at).split(' ').slice(0, 2).join(' ')}
              </p>
            </div>
          </motion.div>

          {/* Balance Card */}
          <motion.div variants={itemVariants}>
            <BalanceCard
              balance={profile.client_balance}
              status={profile.client_balance_status}
              className="shadow-sm border-gray-200"
            />
          </motion.div>

          {/* 2. FINANCIAL STATISTICS BLOCK */}
          <motion.div
            variants={itemVariants}
            className="space-y-3"
          >
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 px-1">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              To'lov statistikasi
            </h2>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Tranzaksiyalar</p>
                  <p className="text-lg font-bold text-gray-900">{profile.transaction_count}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Balans</p>
                  <p className={cn("text-lg font-bold", profile.client_balance < 0 ? "text-red-600" : "text-gray-900")}>
                    {formatCurrencySum(Math.abs(profile.client_balance))}
                  </p>
                </div>
              </div>
            </div>

            {/* Latest Transaction */}
            {profile.latest_transaction && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-2">
                  <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-orange-500" />
                    So'nggi to'lov
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
                    profile.latest_transaction.is_taken_away ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  )}>
                    {profile.latest_transaction.is_taken_away ? 'Olib ketilgan' : 'Omborda'}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Reys</span>
                    <span className="font-medium text-gray-900">{profile.latest_transaction.reys}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Summa</span>
                    <span className="font-medium text-gray-900">{formatCurrencySum(profile.latest_transaction.total_amount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">To'langan</span>
                    <span className="font-medium text-green-600">{formatCurrencySum(profile.latest_transaction.paid_amount)}</span>
                  </div>
                  {profile.latest_transaction.remaining_amount > 0 && (
                    <div className="flex justify-between items-center text-sm bg-red-50 p-2 rounded-lg -mx-2">
                      <span className="text-red-700 font-medium">Qarz</span>
                      <span className="font-bold text-red-700">{formatCurrencySum(profile.latest_transaction.remaining_amount)}</span>
                    </div>
                  )}
                  <div className="pt-2 text-xs text-muted-foreground text-right border-t border-gray-50 mt-2">
                    {formatTashkentDateTime(profile.latest_transaction.created_at)}
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* 3. UNPAID CARGO OVERVIEW BLOCK */}
          <motion.div
            variants={itemVariants}
            className="space-y-3"
          >
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 px-1">
              <Package className="h-5 w-5 text-red-500" />
              To'lanmagan yuklar
            </h2>

            {loadingUnpaid ? (
              <div className="bg-white rounded-xl p-6 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
              </div>
            ) : unpaidFlights.length > 0 ? (
              <div className="bg-red-50 rounded-2xl border border-red-100 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-800">Qarzdorlik mavjud</span>
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                    {unpaidFlights.length} ta reys
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {unpaidFlights.map((flight) => (
                    <span key={flight} className="bg-white text-gray-600 border border-gray-200 px-2 py-1 rounded text-xs font-mono">
                      {flight}
                    </span>
                  ))}
                </div>
                <Button
                  onClick={() => profile.client_code && onViewUnpaidCargo(profile.client_code)}
                  className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-10 shadow-sm"
                  variant="ghost"
                >
                  Batafsil ko'rish
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">To'lanmagan yuklar yo'q</p>
              </div>
            )}
          </motion.div>

          {/* 5. FLIGHTS SECTION */}
          {flights.length > 0 && (
            <motion.div
              variants={itemVariants}
              className="space-y-3"
            >
              <h2 className="text-lg font-semibold text-gray-900 px-1">Reyslar</h2>
              <div className="space-y-2">
                {flights.map((flightName) => (
                  <div key={flightName} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <button
                      onClick={() => handleFlightSummaryToggle(flightName)}
                      className="w-full flex items-center justify-between p-4 bg-white active:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center">
                          <Plane className="h-4 w-4 text-orange-600" />
                        </div>
                        <span className="font-medium text-gray-900">{flightName}</span>
                      </div>
                      {expandedFlight === flightName ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </button>

                    <AnimatePresence>
                      {expandedFlight === flightName && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-gray-50"
                        >
                          <div className="p-4 border-t border-gray-100">
                            {loadingSummaries[flightName] ? (
                              <div className="flex justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                              </div>
                            ) : flightSummaries[flightName] ? (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                    <p className="text-xs text-muted-foreground mb-1">Vazn</p>
                                    <p className="font-bold text-gray-900">{flightSummaries[flightName].total_weight.toFixed(2)} kg</p>
                                  </div>
                                  <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                                    <p className="text-xs text-green-600 mb-1">Narx ($)</p>
                                    <p className="font-bold text-green-700">${flightSummaries[flightName].price_per_kg_usd}</p>
                                  </div>
                                </div>
                                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                                  <p className="text-xs text-purple-600 mb-1">Narx (UZS)</p>
                                  <p className="text-lg font-bold text-purple-900">
                                    {formatCurrencySum(flightSummaries[flightName].price_per_kg_uzs)}/kg
                                  </p>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                                  <p className="text-xs text-orange-600 mb-1">Qo'shimcha to'lov</p>
                                  <p className="text-lg font-bold text-orange-900">
                                    {formatCurrencySum(flightSummaries[flightName].extra_charge)}
                                  </p>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-red-100 shadow-sm flex justify-between items-center">
                                  <span className="text-sm font-medium text-gray-700">Jami to'lov</span>
                                  <span className="text-xl font-bold text-red-600">{formatCurrencySum(flightSummaries[flightName].total_payment)}</span>
                                </div>

                                {flightSummaries[flightName].track_codes.length > 0 && (
                                  <div className="pt-2">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Trek kodlar</p>
                                    <div className="flex flex-wrap gap-2">
                                      {flightSummaries[flightName].track_codes.map((code, idx) => (
                                        <span key={idx} className="bg-white border border-gray-200 px-2 py-1 rounded text-xs font-mono text-gray-700">
                                          {code}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-center text-sm text-muted-foreground">Ma'lumot topilmadi</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
