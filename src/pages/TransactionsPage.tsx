import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useTransactions } from '@/hooks/useTransactions';
import { useClientProfile } from '@/hooks/useClientProfile';
import { TransactionFilters } from '@/components/verification/TransactionFilters';
import { TransactionRow } from '@/components/verification/TransactionRow';
import { CargoImagesModal } from '@/components/verification/CargoImagesModal';
import { PaymentModal } from '@/components/verification/PaymentModal'; // Added import
import { DeliveryRequestModal } from '@/components/delivery/DeliveryRequestModal';

import type { Transaction } from '@/api/transactions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { formatCurrencySum, formatTashkentDateTime } from '@/lib/format';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface TransactionsPageProps {
  clientCode: string;
  client_id: number;
  onBack: () => void;
}

export default function TransactionsPage({ clientCode, client_id, onBack }: TransactionsPageProps) {
  const {
    transactions,
    isLoading,
    error,
    hasMore,
    flightFilter,
    setFlightFilter,
    filterType,
    sortOrder,
    setFilterType,
    setSortOrder,
    loadMore,
    refetch,
  } = useTransactions(clientCode);

  const { profile, flights: rawFlights } = useClientProfile(client_id);

  // Defensive: exclude WALLET_ADJ and empty/null flight names from filter dropdown
  const flights = useMemo(
    () => rawFlights.filter((f) => f && f.trim() !== '' && !f.startsWith('WALLET_ADJ')),
    [rawFlights],
  );

  // Display count: use actual rendered list length (already filtered in hook)
  const displayCount = transactions.length;

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [imagesModalOpen, setImagesModalOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // New state for payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentTransaction, setSelectedPaymentTransaction] = useState<Transaction | null>(null);

  // New state for delivery modal
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [selectedDeliveryTransaction, setSelectedDeliveryTransaction] = useState<Transaction | null>(null);

  const handleViewDetails = useCallback((transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailsModalOpen(true);
  }, []);

  const handleViewImages = useCallback((transactionId: number) => {
    setSelectedTransactionId(transactionId);
    setImagesModalOpen(true);
  }, []);

  const handlePay = useCallback((transaction: Transaction) => {
    setSelectedPaymentTransaction(transaction);
    setPaymentModalOpen(true);
  }, []);

  const handleDeliveryRequest = useCallback((transaction: Transaction) => {
    setSelectedDeliveryTransaction(transaction);
    setDeliveryModalOpen(true);
  }, []);

  const handleTakenSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  const handlePaymentSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

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
              <h1 className="text-xl font-bold text-gray-900">Tranzaksiyalar</h1>
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{displayCount} ta</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Mijoz: <span className="font-mono font-medium text-gray-700">{clientCode}</span>
              {profile && <span className="text-gray-500"> • {profile.full_name}</span>}
            </p>
          </div>

          {/* Optional: Add export or other header actions here for desktop */}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sticky top-0 md:static z-10"
      >
        <TransactionFilters
          filterType={filterType}
          sortOrder={sortOrder}
          flightCode={flightFilter || undefined}
          flights={flights}
          onFilterTypeChange={setFilterType}
          onSortOrderChange={setSortOrder}
          onFlightCodeChange={(val) => setFlightFilter(val || null)}
        />
      </motion.div>

      {isLoading && transactions.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
          <Button variant="outline" onClick={() => refetch()} className="mt-4 bg-white border-red-200 text-red-700 hover:bg-red-50">
            Qayta urinish
          </Button>
        </div>
      )}

      {!isLoading && !error && transactions.length === 0 && (
        <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-1">Tranzaksiyalar yo'q</p>
          <p className="text-muted-foreground text-sm">Bu mijoz uchun tranzaksiyalar topilmadi</p>
        </div>
      )}

      {transactions.length > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12"
        >
          {transactions.map((transaction) => (
            <motion.div key={transaction.id} variants={itemVariants} className="h-full">
              <TransactionRow
                transaction={transaction}
                onViewDetails={handleViewDetails}
                onViewImages={handleViewImages}
                onPay={handlePay}
                onDeliveryRequest={handleDeliveryRequest}
                onTakenSuccess={handleTakenSuccess}
              />
            </motion.div>
          ))}

          {hasMore && (
            <div className="col-span-full text-center pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoading}
                className="w-full md:w-auto md:px-8 h-12 text-base font-medium"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Ko'proq yuklash
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {/* Transaction Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tranzaksiya tafsilotlari</DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-sm text-muted-foreground">
            Quyida tanlangan tranzaksiya bo'yicha to'liq ma'lumotlar keltirilgan.
          </DialogDescription>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Reys</p>
                  <p className="font-medium">{selectedTransaction.reys}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Qator</p>
                  <p className="font-medium">#{selectedTransaction.qator_raqami}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vazn</p>
                  <p className="font-medium">{selectedTransaction.vazn || '-'} kg</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">To'lov turi</p>
                  <p className="font-medium">
                    {selectedTransaction.payment_type === 'cash' ? 'Naqd' :
                      selectedTransaction.payment_type === 'card' ? 'Kartaga to\'lov' : 'Online'}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kutilgan to'lov</span>
                  <span className="font-medium">{formatCurrencySum(selectedTransaction.total_amount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To'langan</span>
                  <span className="font-medium text-green-600">{formatCurrencySum(selectedTransaction.paid_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Qolgan</span>
                  <span className="font-medium text-red-600">{formatCurrencySum(selectedTransaction.remaining_amount)}</span>
                </div>
              </div>

              {/* Wallet deduction info */}
              {(selectedTransaction.wallet_deducted ?? 0) > 0 && (
                <div className="border-t pt-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800 text-sm">Hamyondan to'landi</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-700">Eski balans:</span>
                      <span className="font-mono text-blue-900">{formatCurrencySum(selectedTransaction.wallet_balance_before ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-blue-200 pt-1">
                      <span className="text-blue-700">Ishlatildi:</span>
                      <span className="font-mono text-blue-900">-{formatCurrencySum(selectedTransaction.wallet_deducted ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-blue-200 pt-1">
                      <span className="text-blue-700">Qolgan balans:</span>
                      <span className="font-mono text-blue-900">{formatCurrencySum(selectedTransaction.wallet_balance_after ?? 0)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 text-sm text-muted-foreground">
                <p>Yaratilgan: {formatTashkentDateTime(selectedTransaction.created_at)}</p>
                {selectedTransaction.taken_away_date && (
                  <p>Olingan: {formatTashkentDateTime(selectedTransaction.taken_away_date)}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cargo Images Modal */}
      <CargoImagesModal
        isOpen={imagesModalOpen}
        onClose={() => {
          setImagesModalOpen(false);
          setSelectedTransactionId(null);
        }}
        transactionId={selectedTransactionId}
        title="Yuk rasmlari"
        type="standard"
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedPaymentTransaction(null);
        }}
        paymentData={
          selectedPaymentTransaction
            ? {
              mode: 'existing_transaction',
              transactionId: selectedPaymentTransaction.id,
              expectedAmount: selectedPaymentTransaction.remaining_amount,
              clientCode: clientCode,
              flightName: selectedPaymentTransaction.reys,
              rowNumber: selectedPaymentTransaction.qator_raqami,
              weight: selectedPaymentTransaction.vazn,
            }
            : null
        }
        onSuccess={handlePaymentSuccess}
        walletBalance={profile?.client_balance}
      />

      {/* Delivery Request Modal */}
      <DeliveryRequestModal
        isOpen={deliveryModalOpen}
        onClose={() => {
          setDeliveryModalOpen(false);
          setSelectedDeliveryTransaction(null);
        }}
        transaction={selectedDeliveryTransaction}
        clientProfile={profile || null}
        onSuccess={() => {
          refetch();
          setDeliveryModalOpen(false);
          setSelectedDeliveryTransaction(null);
        }}
      />
    </div>
  );
}
