import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Phone, Upload, X, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UzpostBranchPicker } from "@/components/delivery/UzpostBranchPicker";
import { useUzpostBranches } from "@/hooks/useUzpostBranches";
import type { UzpostBranch } from "@/types/uzpostBranch";

interface UzpostDeliveryFormProps {
  phone: string;
  onPhoneChange: (v: string) => void;
  selectedBranch: UzpostBranch | null;
  onBranchChange: (branch: UzpostBranch | null) => void;
  receiptFile: File | null;
  onReceiptChange: (file: File | null) => void;
  walletUsed: number;
  onWalletChange: (v: number) => void;
  clientWalletBalance: number;
}

export default function UzpostDeliveryForm({
  phone,
  onPhoneChange,
  selectedBranch,
  onBranchChange,
  receiptFile,
  onReceiptChange,
  walletUsed,
  onWalletChange,
  clientWalletBalance,
}: UzpostDeliveryFormProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: branches, isLoading, isError, refetch } = useUzpostBranches();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    onReceiptChange(file);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Phone className="w-4 h-4 text-gray-400" />
          {t("adminDeliveryRequest.uzpostForm.phoneLabel", "Qabul qiluvchi telefon")}
        </Label>
        <Input
          type="tel"
          placeholder="+998901234567"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          className="h-12 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("adminDeliveryRequest.uzpostForm.branchLabel", "UzPost filialini tanlash")}
        </Label>
        <UzpostBranchPicker
          branches={branches ?? []}
          selectedBranch={selectedBranch}
          isLoading={isLoading}
          isError={isError}
          onSelect={onBranchChange}
          onRetry={() => refetch()}
          theme={{
            shellClassName:
              "rounded-2xl border border-orange-200 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/5 p-3",
            mapClassName:
              "h-[220px] w-full overflow-hidden rounded-xl border border-orange-200 dark:border-orange-500/20",
            searchClassName:
              "h-12 w-full rounded-xl border border-orange-200 dark:border-orange-500/20 bg-white dark:bg-white/[0.04] px-4 text-sm",
            selectedPanelClassName:
              "rounded-xl border border-orange-200 dark:border-orange-500/20 bg-white dark:bg-white/[0.04] p-4",
            resultButtonClassName:
              "w-full rounded-xl border border-transparent bg-white/80 dark:bg-white/[0.04] p-3 text-left text-sm hover:border-orange-200 dark:hover:border-orange-500/20 transition-colors",
            selectedResultButtonClassName:
              "border-orange-400 bg-orange-100 dark:bg-orange-500/10",
            primaryTextClassName: "text-gray-900 dark:text-white",
            mutedTextClassName: "text-gray-500 dark:text-gray-400",
            markerColor: "#f97316",
            selectedMarkerColor: "#16a34a",
          }}
        />
      </div>

      {clientWalletBalance > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-gray-400" />
            {t("adminDeliveryRequest.uzpostForm.walletLabel", "Hamyon balansidan foydalanish")}
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={0}
              max={clientWalletBalance}
              value={walletUsed || ""}
              onChange={(e) => onWalletChange(Number(e.target.value))}
              className="h-12 rounded-xl"
              placeholder="0"
            />
            <span className="text-sm text-gray-500 shrink-0">
              / {clientWalletBalance.toLocaleString()} so&apos;m
            </span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Upload className="w-4 h-4 text-gray-400" />
          {t("adminDeliveryRequest.uzpostForm.receiptLabel", "To'lov cheki (ixtiyoriy)")}
        </Label>

        {receiptFile ? (
          <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-4 py-3">
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {receiptFile.name}
            </span>
            <button
              onClick={() => {
                onReceiptChange(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="h-12 w-full rounded-xl border-dashed border-gray-300 dark:border-white/10 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/5 text-gray-600 dark:text-gray-300"
          >
            <Upload className="w-4 h-4 mr-2" />
            {t("adminDeliveryRequest.uzpostForm.uploadReceipt", "Chekni yuklash")}
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
