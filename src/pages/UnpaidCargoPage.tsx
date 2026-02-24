import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useUnpaidCargo } from '@/hooks/useUnpaidCargo';
import { useClientProfile } from '@/hooks/useClientProfile';
import { CargoImagesModal } from '@/components/verification/CargoImagesModal';
import { PaymentModal } from '@/components/verification/PaymentModal';
import type { UnpaidCargoItem } from '@/api/verification';
import { formatCurrencySum } from '@/lib/format';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Package,
  Plane,
  Image,
  CreditCard,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UnpaidCargoPageProps {
  clientCode: string;
  clientId: number;
  onBack: () => void;
}

export default function UnpaidCargoPage({ clientCode, clientId, onBack }: UnpaidCargoPageProps) {
  const { cargos, flights, isLoading, error, refetch, flightFilter, setFlightFilter } = useUnpaidCargo(clientCode);
  const { profile, refetch: refetchProfile } = useClientProfile(clientId);

  const [imagesModalOpen, setImagesModalOpen] = useState(false);
  const [selectedCargoId, setSelectedCargoId] = useState<number | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedCargo, setSelectedCargo] = useState<UnpaidCargoItem | null>(null);

  const handleViewImages = useCallback((cargoId: number) => {
    setSelectedCargoId(cargoId);
    setImagesModalOpen(true);
  }, []);

  const handlePayment = useCallback((cargo: UnpaidCargoItem) => {
    setSelectedCargo(cargo);
    setPaymentModalOpen(true);
  }, []);

  const handlePaymentSuccess = useCallback(() => {
    refetch();
    refetchProfile();
  }, [refetch, refetchProfile]);

  // Group cargos by flight - Pydantic JSON uses "flight" field name
  const cargosByFlight = cargos.reduce((acc, cargo) => {
    const flightName = cargo.flight_name || 'Unknown';
    if (!acc[flightName]) {
      acc[flightName] = [];
    }
    acc[flightName].push(cargo);
    return acc;
  }, {} as Record<string, UnpaidCargoItem[]>);

  // Use total_payment from backend (Pydantic field name in JSON)
  const totalRemaining = cargos.reduce((sum, cargo) => sum + (cargo.total_payment || 0), 0);

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

  return (
    <div className="max-w-md md:max-w-4xl lg:max-w-5xl mx-auto px-4 py-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Button variant="ghost" onClick={onBack} className="pl-0 hover:bg-transparent text-muted-foreground hover:text-gray-900 -ml-2 mb-2">
          <ArrowLeft className="h-5 w-5 mr-1" />
          Orqaga
        </Button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">To'lanmagan yuklar</h1>
              {totalRemaining > 0 && <span className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-100">Jami qarz</span>}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono font-medium text-gray-700">{clientCode}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 bg-red-50 px-4 py-2 rounded-xl border border-red-100 self-start md:self-auto">
            <span className="text-sm font-medium text-red-800">Jami:</span>
            <p className="text-lg font-bold text-red-600">{formatCurrencySum(totalRemaining)}</p>
          </div>
        </div>
      </motion.div>

      {/* Flight Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sticky top-0 md:static z-10"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          <label className="text-xs font-medium text-muted-foreground ml-1 md:ml-0 md:min-w-fit">Reys bo'yicha filtrlash:</label>
          <Select
            value={flightFilter || 'all'}
            onValueChange={(v) => setFlightFilter(v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-full md:w-[240px] h-12 md:h-10 bg-gray-50 border-gray-200">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-gray-500" />
                <SelectValue placeholder="Barcha reyslar" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha reyslar</SelectItem>
              {flights.map((flight) => (
                <SelectItem key={flight} value={flight}>
                  {flight}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
          <Button variant="outline" onClick={() => refetch()} className="mt-4 bg-white border-red-200 text-red-700 hover:bg-red-50">
            Qayta urinish
          </Button>
        </div>
      )}

      {!error && cargos.length === 0 && (
        <div className="bg-green-50 rounded-2xl border-2 border-dashed border-green-200 p-12 text-center">
          <Package className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-green-900 mb-1">Qarzdorlik yo'q</p>
          <p className="text-green-700 text-sm">Barcha yuklar uchun to'lov qilingan</p>
        </div>
      )}

      {cargos.length > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6 pb-20"
        >
          {Object.entries(cargosByFlight).map(([flightName, flightCargos]) => (
            <motion.div
              key={flightName}
              variants={itemVariants}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-[var(--header-height)] z-0">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold text-gray-900 text-sm">{flightName}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({flightCargos.length})
                  </span>
                </div>
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                  {formatCurrencySum(flightCargos.reduce((sum, c) => sum + (c.total_payment ?? 0), 0))}
                </span>
              </div>

              <div className="divide-y divide-gray-50 md:divide-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:p-4">
                {flightCargos.map((cargo) => (
                  <div
                    key={cargo.cargo_id}
                    className="p-4 hover:bg-gray-50/50 transition-colors md:border md:border-gray-100 md:rounded-xl md:shadow-sm md:bg-white h-full flex flex-col justify-between"
                  >
                    <div className="flex flex-col gap-3 h-full">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-gray-900">#{cargo.row_number ?? 0}</span>
                            <span className="text-sm text-gray-500">{cargo.weight ?? 0} kg</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatCurrencySum(cargo.price_per_kg ?? 0, 'uz', '$')}/kg</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600 text-base">{formatCurrencySum(cargo.total_payment ?? 0)}</p>
                          <span className="text-[10px] font-medium uppercase tracking-wider text-red-500 bg-red-50 px-1.5 py-0.5 rounded">To'lanmagan</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewImages(cargo.cargo_id)}
                          className="h-9 text-xs"
                        >
                          <Image className="h-3.5 w-3.5 mr-2" />
                          Rasmlar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handlePayment(cargo)}
                          className="h-9 text-xs bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 shadow-sm"
                        >
                          <CreditCard className="h-3.5 w-3.5 mr-2" />
                          To'lov
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Cargo Images Modal */}
      <CargoImagesModal
        isOpen={imagesModalOpen}
        onClose={() => {
          setImagesModalOpen(false);
          setSelectedCargoId(null);
        }}
        transactionId={selectedCargoId}
        title="Yuk rasmlari"
        type="unpaid"
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedCargo(null);
        }}
        paymentData={
          selectedCargo
            ? {
              mode: 'unpaid_cargo',
              cargoId: selectedCargo.cargo_id,
              clientCode: clientCode,
              flightName: selectedCargo.flight_name ?? '',
              rowNumber: selectedCargo.row_number ?? 0,
              weight: selectedCargo.weight ?? 0,
              expectedAmount: selectedCargo.total_payment ?? 0,
            }
            : null
        }
        onSuccess={handlePaymentSuccess}
        walletBalance={profile?.client_balance}
      />
    </div>
  );
}
