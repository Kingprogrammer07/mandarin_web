import { useTranslation } from "react-i18next";
import { Phone, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeliveryMapPickerLazy } from "@/components/delivery/DeliveryMapPickerLazy";

interface StandardDeliveryFormProps {
  phone: string;
  onPhoneChange: (v: string) => void;
  caption: string;
  onCaptionChange: (v: string) => void;
  location: { latitude: number; longitude: number } | null;
  onLocationChange: (loc: { latitude: number; longitude: number } | null) => void;
}

export default function StandardDeliveryForm({
  phone,
  onPhoneChange,
  caption,
  onCaptionChange,
  location,
  onLocationChange,
}: StandardDeliveryFormProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Phone className="w-4 h-4 text-gray-400" />
          {t("adminDeliveryRequest.standardForm.phoneLabel", "Qabul qiluvchi telefon")}
        </Label>
        <Input
          type="tel"
          placeholder="+998901234567"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          className="h-12 rounded-xl"
        />
        <p className="text-xs text-gray-400">
          {t("adminDeliveryRequest.standardForm.phoneHint", "Bo'sh qoldirilsa, mijoz profilidagi telefon ishlatiladi")}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          {t("adminDeliveryRequest.standardForm.captionLabel", "Kuryer uchun izoh")}
        </Label>
        <textarea
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder={t("adminDeliveryRequest.standardForm.captionPlaceholder", "2-qavat, domofon kod: 1234")}
          rows={3}
          className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("adminDeliveryRequest.standardForm.mapLabel", "Joylashuvni xaritadan tanlash")}
        </Label>
        <DeliveryMapPickerLazy
          confirmedLocation={location}
          onConfirm={onLocationChange}
          onClear={() => onLocationChange(null)}
        />
      </div>
    </div>
  );
}
