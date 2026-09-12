import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { DeliveryMapPickerLazy } from "@/components/delivery/DeliveryMapPickerLazy";

interface StandardDeliveryFormProps {
  caption: string;
  onCaptionChange: (v: string) => void;
  location: { latitude: number; longitude: number } | null;
  onLocationChange: (loc: { latitude: number; longitude: number } | null) => void;
}

/** Courier details for self_pickup, yandex, mandarin and bts. The recipient's
 *  name and phone sit above it in RecipientFields, shared with UzPost. */
export default function StandardDeliveryForm({
  caption,
  onCaptionChange,
  location,
  onLocationChange,
}: StandardDeliveryFormProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label
          htmlFor="standard-caption"
          className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2"
        >
          <FileText className="w-4 h-4 text-gray-400" aria-hidden="true" />
          {t("adminDeliveryRequest.standardForm.captionLabel", "Kuryer uchun izoh")}
        </Label>
        <textarea
          id="standard-caption"
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder={t("adminDeliveryRequest.standardForm.captionPlaceholder", "2-qavat, domofon kod: 1234")}
          rows={3}
          className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
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
