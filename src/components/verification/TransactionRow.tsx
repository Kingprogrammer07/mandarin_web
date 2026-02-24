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
  AlertCircle,
  CreditCard,
} from 'lucide-react';

interface TransactionRowProps {
  transaction: Transaction;
  onViewDetails: (transaction: Transaction) => void;
  onViewImages: (transactionId: number) => void;
  onPay: (transaction: Transaction) => void;
  onTakenSuccess: () => void;
}

export function TransactionRow({
  transaction,
  onViewDetails,
  onViewImages,
  onPay,
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

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={() => onViewDetails(transaction)} className="w-full sm:w-auto h-11 sm:h-9">
          <Eye className="h-4 w-4 sm:mr-1" />
          <span className="ml-2 sm:ml-0">Batafsil</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => onViewImages(transaction.id)} className="w-full sm:w-auto h-11 sm:h-9">
          <Image className="h-4 w-4 sm:mr-1" />
          <span className="ml-2 sm:ml-0">Rasmlar</span>
        </Button>
        {(transaction.remaining_amount ?? 0) > 0 && (
          <Button
            size="sm"
            onClick={() => onPay(transaction)}
            className="w-full sm:w-auto h-11 sm:h-9 bg-green-600 hover:bg-green-700 text-white"
          >
            <CreditCard className="h-4 w-4 sm:mr-1" />
            <span className="ml-2 sm:ml-0">To'lov</span>
          </Button>
        )}
        {!transaction.is_taken_away && (transaction.payment_status === 'paid' || transaction.payment_status === 'partial') && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAsTaken}
            disabled={isMarkingTaken}
            className="w-full sm:w-auto h-11 sm:h-9"
          >
            {isMarkingTaken ? (
              <Loader2 className="h-4 w-4 sm:mr-1 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 sm:mr-1" />
            )}
            <span className="ml-2 sm:ml-0">Olingan</span>
          </Button>
        )}
      </div>
    </div>
  );
}
