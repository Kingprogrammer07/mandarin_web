import { useEffect, useRef, memo } from "react";
import { useTranslation } from 'react-i18next';
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Ban, ChevronRight, AlertTriangle, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// --- Types ---
interface ProhibitedItem {
  id: number;
  title: string;
  examples: string | null;
}

interface ProhibitedDataResponse {
  success: boolean;
  data: {
    images: string[];
    header_title: string;
    header_subtitle: string;
    items: ProhibitedItem[];
    footer_note: string;
  };
}

// --- Mock Fetcher (replace with real API call) ---
const fetchProhibitedItems = async (): Promise<ProhibitedDataResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    success: true,
    data: {
      images: [
        "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=800&auto=format&fit=crop",
      ],
      header_title: "🚫 AVIADA YUBORISH TAQIQLANGAN MAHSULOTLAR ‼️",
      header_subtitle:
        "DIQQAT! Quyidagi tovarlar havo yo'li orqali yuborilishi taqiqlanadi. Qoidabuzarlik uchun javobgarlik yuboruvchiga yuklatiladi.",
      items: [
        {
          id: 1,
          title: "Batareyalar va quvvat manbalari",
          examples: "(masalan: powerbank, lithium batareyalar, akkumulyatorlar)",
        },
        {
          id: 2,
          title: "Portlovchi va yonuvchi moddalar",
          examples: "(masalan: benzin, gaz ballonlar, pirotexnika, o'q-dorilar)",
        },
        {
          id: 3,
          title: "Magnitli buyumlar",
          examples: "(masalan: karnay, magnitli o'yinchoqlar)",
        },
        {
          id: 4,
          title: "O'tkir va kesuvchi buyumlar",
          examples: "(masalan: pichoqlar, qaychilar, arra)",
        },
        {
          id: 5,
          title: "Kukun va changsimon moddalar",
          examples: "(masalan: un, kukun bo'yoqlar, tozalash vositalari)",
        },
        {
          id: 6,
          title: "Oziq-ovqat mahsulotlari",
          examples: "(masalan: go'sht, baliq, sut mahsulotlari, mevalar)",
        },
        {
          id: 7,
          title: "Suyuqliklar",
          examples: "(masalan: atir, spirtli ichimliklar, kimyoviy eritma)",
        },
        {
          id: 8,
          title: "Kosmetika va parfyumeriya",
          examples: "(masalan: лак, atseton, sprey, aerozollar)",
        },
        {
          id: 9,
          title: "Qimmatbaho buyumlar",
          examples: "(masalan: soatlar, quloqchinlar, oltin, kumush buyumlar)",
        },
        {
          id: 10,
          title: "Tibbiy preparatlar va dorilar",
          examples: "(masalan: tabletkalar, siroplar, in'yeksiyalar)",
        },
      ],
      footer_note:
        "📌 Iltimos, yuk jo'natishdan avval ushbu ro'yxat bilan tanishib chiqing. Taqiqlangan yuklar aniqlansa, javobgarlik to'liq yuboruvchiga yuklatiladi.",
    },
  };
};

// --- Skeleton Loader ---
const SkeletonLoader = memo(() => (
  <div className="animate-pulse space-y-5 p-5">
    {/* Image skeleton */}
    <div className="h-44 rounded-2xl bg-gray-200 dark:bg-white/10" />
    {/* Header skeleton */}
    <div className="space-y-2 p-4 rounded-2xl bg-gray-100 dark:bg-white/5">
      <div className="h-5 w-3/4 rounded-lg bg-gray-200 dark:bg-white/10" />
      <div className="h-3 w-full rounded bg-gray-200 dark:bg-white/10" />
      <div className="h-3 w-5/6 rounded bg-gray-200 dark:bg-white/10" />
    </div>
    {/* List skeletons */}
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-white/10 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-white/10" />
          <div className="h-3 w-4/5 rounded bg-gray-200 dark:bg-white/10" />
        </div>
      </div>
    ))}
  </div>
));

// --- Image Carousel ---
const ImageCarousel = memo(({ images }: { images: string[] }) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!images.length) return null;

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {images.map((url, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[90%] sm:w-full snap-center rounded-2xl overflow-hidden"
          >
            <img
              src={url}
              alt={t('prohibitedItems.imageAlt', { index: i + 1 })}
              className="w-full h-44 sm:h-52 object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
          {/* Scroll arrows for desktop */}
          <button
            onClick={() =>
              scrollRef.current?.scrollBy({ left: -300, behavior: "smooth" })
            }
            className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() =>
              scrollRef.current?.scrollBy({ left: 300, behavior: "smooth" })
            }
            className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
});

// --- Props ---
interface ProhibitedItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// --- Modal Component ---
const ProhibitedItemsModal = ({ isOpen, onClose }: ProhibitedItemsModalProps) => {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["prohibitedItems"],
    queryFn: fetchProhibitedItems,
    enabled: isOpen,
    staleTime: 10 * 60 * 1000,
  });

  // Scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const items = data?.data;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="prohibited-wrapper"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Modal Panel */}
          <motion.div
            key="prohibited-modal"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="
              w-full max-h-[90vh] flex flex-col
              bg-white dark:bg-[#151010]
              rounded-t-[32px]
              sm:w-[450px] sm:max-w-[90vw] sm:max-h-[85vh]
              sm:rounded-3xl
              shadow-2xl border border-gray-200/50 dark:border-white/10
              overflow-hidden
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-[#151010]/90 backdrop-blur-xl border-b border-gray-100 dark:border-white/10">
              {/* Drag handle (mobile) */}
              <div className="flex justify-center pt-3 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
              </div>

              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
                    <Ban className="w-5 h-5 text-red-500" />
                  </div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    {t('prohibitedItems.title')}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors active:scale-95"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {isLoading && <SkeletonLoader />}

              {isError && (
                <div className="flex flex-col items-center justify-center p-10 gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-red-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {t('prohibitedItems.error')}
                  </p>
                  <button
                    onClick={() => refetch()}
                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all"
                  >
                    {t('prohibitedItems.retry')}
                  </button>
                </div>
              )}

              {items && (
                <div className="space-y-4 pb-4">
                  {/* Image Carousel */}
                  {items.images.length > 0 && (
                    <div className="px-4 pt-4">
                      <ImageCarousel images={items.images} />
                    </div>
                  )}

                  {/* Warning Header */}
                  <div className="mx-4 p-4 rounded-2xl bg-gradient-to-br from-red-50 to-amber-50 dark:from-red-500/10 dark:to-amber-500/10 border border-red-200/60 dark:border-red-500/20">
                    <h3 className="text-sm font-extrabold text-red-700 dark:text-red-400 leading-snug mb-1.5">
                      {items.header_title}
                    </h3>
                    <p className="text-xs leading-relaxed text-red-600/80 dark:text-red-300/70">
                      {items.header_subtitle}
                    </p>
                  </div>

                  {/* Items List */}
                  <div className="px-4 space-y-2">
                    {items.items.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.25 }}
                        className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5"
                      >
                        <div className="w-9 h-9 rounded-xl bg-red-500/10 dark:bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Ban className="w-4 h-4 text-red-500 dark:text-red-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                            {item.title}
                          </p>
                          {item.examples && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                              {item.examples}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Footer Note */}
                  <div className="mx-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300 leading-relaxed">
                      {items.footer_note}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Footer Button */}
            <div className="sticky bottom-0 z-20 p-4 bg-white/90 dark:bg-[#151010]/90 backdrop-blur-xl border-t border-gray-100 dark:border-white/10">
              <button
                onClick={onClose}
                className="
                  w-full py-3.5 rounded-2xl text-sm font-bold
                  bg-gradient-to-r from-red-500 to-red-600 text-white
                  hover:from-red-600 hover:to-red-700
                  active:scale-[0.98] transition-all duration-200
                  shadow-lg shadow-red-500/20
                "
              >
                {t('prohibitedItems.understood')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default memo(ProhibitedItemsModal);
