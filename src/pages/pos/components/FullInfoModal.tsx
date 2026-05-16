import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface FullInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    client_code: string;
    full_name: string;
    phone?: string | null;
    passport_series?: string | null;
    pinfl?: string | null;
    date_of_birth?: string | null;
    region?: string | null;
    district?: string | null;
    address?: string | null;
    transaction_count: number;
    referral_count: number;
    extra_passports_count: number;
  } | null;
}

export const FullInfoModal = memo(function FullInfoModal({
  isOpen,
  onClose,
  profile,
}: FullInfoModalProps) {
  if (!profile) return null;

  const fields = [
    { label: "Ism Familiya", value: profile.full_name },
    { label: "Telefon", value: profile.phone ?? "—" },
    { label: "Pasport seriyasi", value: profile.passport_series ?? "—" },
    { label: "JSHSHIR (PINFL)", value: profile.pinfl ?? "—" },
    { label: "Tug'ilgan sana", value: profile.date_of_birth ?? "—" },
    { label: "Viloyat", value: profile.region ?? "—" },
    { label: "Tuman", value: profile.district ?? "—" },
    { label: "Manzil", value: profile.address ?? "—" },
    { label: "Tranzaksiyalar", value: String(profile.transaction_count) },
    { label: "Referallar", value: String(profile.referral_count) },
    { label: "Qo'shimcha pasportlar", value: String(profile.extra_passports_count) },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-2xl overflow-hidden"
          >
            <div className="h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-400" />
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-black text-gray-900 dark:text-white">
                    To&apos;liq ma&apos;lumot
                  </h3>
                  <p className="text-[11px] font-mono text-gray-400">
                    {profile.client_code}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-gray-50 dark:bg-white/[0.04] rounded-2xl divide-y divide-gray-100 dark:divide-white/[0.05] overflow-hidden text-[13px]">
                {fields.map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between px-4 py-2.5 gap-3">
                    <span className="text-gray-400 dark:text-gray-500 shrink-0">{label}</span>
                    <span className="font-semibold text-gray-800 dark:text-white text-right break-all">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
