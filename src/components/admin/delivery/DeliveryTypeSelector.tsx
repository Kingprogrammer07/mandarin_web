import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Mail, Zap, Package, Truck, Store } from "lucide-react";

type DeliveryType = "self_pickup" | "yandex" | "mandarin" | "bts" | "uzpost";

interface DeliveryOption {
  id: DeliveryType;
  /** i18n key for the label; `label` is the literal fallback. */
  labelKey: string;
  label: string;
  descKey: string;
  icon: React.ReactNode;
  iconBg: string;
  borderColor: string;
  ringColor: string;
}

interface DeliveryTypeSelectorProps {
  value: DeliveryType | null;
  onChange: (type: DeliveryType) => void;
}

const OPTIONS: DeliveryOption[] = [
  {
    id: "self_pickup",
    labelKey: "adminDeliveryRequest.deliveryType.labels.self_pickup",
    label: "O'zi olib ketish",
    descKey: "deliveryRequest.options.self_pickup",
    icon: <Store className="w-7 h-7" />,
    iconBg: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
    borderColor: "border-violet-200 dark:border-violet-500/30",
    ringColor: "ring-violet-400",
  },
  {
    id: "yandex",
    labelKey: "adminDeliveryRequest.deliveryType.labels.yandex",
    label: "Yandex",
    descKey: "deliveryRequest.options.yandex",
    icon: <Zap className="w-7 h-7" />,
    iconBg: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-500/30",
    ringColor: "ring-red-400",
  },
  {
    id: "mandarin",
    labelKey: "adminDeliveryRequest.deliveryType.labels.mandarin",
    label: "Mandarin Dostavka",
    descKey: "deliveryRequest.options.mandarin",
    icon: <Package className="w-7 h-7" />,
    iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-500/30",
    ringColor: "ring-emerald-400",
  },
  {
    id: "bts",
    labelKey: "adminDeliveryRequest.deliveryType.labels.bts",
    label: "BTS",
    descKey: "deliveryRequest.options.bts",
    icon: <Truck className="w-7 h-7" />,
    iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-500/30",
    ringColor: "ring-blue-400",
  },
  {
    id: "uzpost",
    labelKey: "adminDeliveryRequest.deliveryType.labels.uzpost",
    label: "UzPost",
    descKey: "deliveryRequest.options.uzpost",
    icon: <Mail className="w-7 h-7" />,
    iconBg: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400",
    borderColor: "border-orange-200 dark:border-orange-500/30",
    ringColor: "ring-orange-400",
  },
];

export default function DeliveryTypeSelector({
  value,
  onChange,
}: DeliveryTypeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        {t("adminDeliveryRequest.deliveryType.title", "Yetkazish turini tanlang")}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {OPTIONS.map((option, index) => {
          const isSelected = value === option.id;

          return (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onChange(option.id)}
              className={`relative text-left rounded-2xl border p-4 transition-all duration-200 ${
                isSelected
                  ? `${option.borderColor} bg-white dark:bg-white/[0.04] ring-2 ${option.ringColor}`
                  : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] hover:border-gray-300 dark:hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${option.iconBg}`}
                >
                  {option.icon}
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">
                    {t(option.labelKey, option.label)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t(option.descKey)}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
