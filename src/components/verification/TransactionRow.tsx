import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { markAsTaken, type Transaction } from '@/api/transactions';
import { formatCurrencySum, formatTashkentDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Eye,
  Image,
  CheckCircle,
  Loader2,
  Package,
  PackageOpen,
  AlertCircle,
  CreditCard,
} from 'lucide-react';

interface TransactionRowProps {
  transaction: Transaction;
  onViewDetails: (transaction: Transaction) => void;
  onViewImages: (transactionId: number) => void;
  onPay: (transaction: Transaction) => void;
  onDeliveryRequest?: (transaction: Transaction) => void;
  onTakenSuccess: () => void;
}

export function TransactionRow({
  transaction,
  onViewDetails,
  onViewImages,
  onPay,
  onDeliveryRequest,
  onTakenSuccess,
}: TransactionRowProps) {
  const [isMarkingTaken, setIsMarkingTaken] = useState(false);

  const getStatusBadge = () => {
    switch (transaction.payment_status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3" />
            To'langan
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <AlertCircle className="h-3 w-3" />
            Qisman
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertCircle className="h-3 w-3" />
            To'lanmagan
          </span>
        );
    }
  };

  const getTakenBadge = () => {
    if (transaction.is_taken_away) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <Package className="h-3 w-3" />
          Olingan
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        <Package className="h-3 w-3" />
        Olinmagan
      </span>
    );
  };

  const handleMarkAsTaken = async () => {
    setIsMarkingTaken(true);
    try {
      await markAsTaken(transaction.id);
      onTakenSuccess();
    } catch {
      // Error handling is done in the parent component
    } finally {
      setIsMarkingTaken(false);
    }
  };
  return (
    <div className="bg-background border rounded-lg p-3 sm:p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-md sm:text-base font-medium">{transaction.reys}</span>
            <span className="text-muted-foreground text-sm sm:text-md">#{transaction.qator_raqami ?? 0}</span>
            {transaction.vazn && (
              <span className="text-muted-foreground text-sm sm:text-md">{transaction.vazn} kg</span>
            )}
          </div>
          <p className="text-xs sm:text-md text-muted-foreground">
            {formatTashkentDateTime(transaction.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          {getStatusBadge()}
          {getTakenBadge()}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-sm sm:text-md">
        <div>
          <p className="text-muted-foreground">Kutilgan</p>
          <p className="font-medium">{formatCurrencySum(transaction.total_amount ?? 0)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">To'langan</p>
          <p className="font-medium text-green-600">{formatCurrencySum(transaction.paid_amount ?? 0)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Qolgan</p>
          <p className={cn('font-medium', (transaction.remaining_amount ?? 0) > 0 ? 'text-red-600' : 'text-gray-600')}>
            {formatCurrencySum(transaction.remaining_amount ?? 0)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t mt-2">
        {/* Left: Secondary Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => onViewDetails(transaction)} className="text-gray-500 hover:text-gray-700 h-8 px-2">
            <Eye className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Tafsilot</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onViewImages(transaction.id)} className="text-gray-500 hover:text-gray-700 h-8 px-2">
            <Image className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Rasm</span>
          </Button>
        </div>

        {/* Right: Primary Actions */}
        <div className="flex gap-2 flex-wrap items-center justify-end">
          {(transaction.remaining_amount ?? 0) > 0 && (
            <Button
              size="sm"
              onClick={() => onPay(transaction)}
              className="h-8 bg-green-600 hover:bg-green-700 text-white"
            >
              <CreditCard className="h-4 w-4 mr-1" />
              <span>To'lov</span>
            </Button>
          )}

          {/* Delivery Button */}
          {onDeliveryRequest && !transaction.is_taken_away && (transaction.payment_status === 'paid' || transaction.payment_status === 'partial') && (
            <Button
              size="sm"
              onClick={() => onDeliveryRequest(transaction)}
              className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-3 rounded-lg shadow-sm"
            >
              <PackageOpen className="h-4 w-4 mr-1.5" />
              <span>Yetkazish</span>
            </Button>
          )}

          {/* Mark as Taken */}
          {!transaction.is_taken_away && (transaction.payment_status === 'paid' || transaction.payment_status === 'partial') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAsTaken}
              disabled={isMarkingTaken}
              className="h-8"
            >
              {isMarkingTaken ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
              )}
              <span>Olingan</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
