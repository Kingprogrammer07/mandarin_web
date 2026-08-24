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
    <div className="h-44 rounded-mc-lg bg-mc-surface-2" />
    {/* Header skeleton */}
    <div className="space-y-2 p-4 rounded-mc-lg bg-mc-surface-2">
      <div className="h-5 w-3/4 rounded-mc-sm bg-mc-surface-2" />
      <div className="h-3 w-full rounded bg-mc-surface-2" />
      <div className="h-3 w-5/6 rounded bg-mc-surface-2" />
    </div>
    {/* List skeletons */}
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-mc-sm bg-mc-surface-2 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-mc-surface-2" />
          <div className="h-3 w-4/5 rounded bg-mc-surface-2" />
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
            className="flex-shrink-0 w-[90%] sm:w-full snap-center rounded-mc-lg overflow-hidden"
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
            className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-transform active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() =>
              scrollRef.current?.scrollBy({ left: 300, behavior: "smooth" })
            }
            className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-transform active:scale-95"
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
          className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
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
              w-full max-h-[90dvh] flex flex-col
              bg-mc-surface
              rounded-t-mc-xl
              sm:w-[450px] sm:max-w-[90vw] sm:max-h-[85dvh]
              sm:rounded-mc-xl
              shadow-2xl border border-mc-border
              overflow-hidden
            "
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="prohibited-title"
          >
            {/* Sticky Header */}
            <div className="shrink-0 bg-mc-surface border-b border-mc-border">
              {/* Drag handle (mobile) */}
              <div className="flex justify-center pt-3 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-mc-border" />
              </div>

              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="w-9 h-9 shrink-0 rounded-mc-sm bg-mc-danger-soft flex items-center justify-center">
                    <Ban className="w-[18px] h-[18px] text-mc-danger" strokeWidth={2} />
                  </div>
                  <h2 id="prohibited-title" className="truncate text-[16px] font-extrabold text-mc-text">
                    {t('prohibitedItems.title')}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-9 h-9 shrink-0 rounded-mc-md flex items-center justify-center bg-mc-surface-2 text-mc-text-2 transition-transform active:scale-95"
                  aria-label={t('prohibitedItems.close', 'Yopish')}
                >
                  <X className="w-[18px] h-[18px]" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {isLoading && <SkeletonLoader />}

              {isError && (
                <div className="flex flex-col items-center justify-center p-10 gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-mc-danger-soft flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-mc-danger" strokeWidth={2} />
                  </div>
                  <p className="text-[12px] font-medium text-mc-text-2">
                    {t('prohibitedItems.error')}
                  </p>
                  <button
                    onClick={() => refetch()}
                    className="px-5 h-10 rounded-mc-md text-[13px] font-extrabold bg-mc-danger-fill text-mc-on-danger active:scale-95 transition-transform"
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
                  <div className="mx-4 p-3.5 rounded-mc-lg bg-mc-danger-soft border border-mc-danger/25">
                    <h3 className="text-[13px] font-extrabold text-mc-danger leading-snug mb-1">
                      {items.header_title}
                    </h3>
                    <p className="text-[12px] leading-snug text-mc-danger">
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
                        className="flex items-start gap-2.5 p-2.5 rounded-mc-md bg-mc-surface-2 border border-mc-border"
                      >
                        <div className="w-8 h-8 rounded-mc-sm bg-mc-danger-soft flex items-center justify-center shrink-0">
                          <Ban className="w-4 h-4 text-mc-danger" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-extrabold text-mc-text leading-snug">
                            {item.title}
                          </p>
                          {item.examples && (
                            <p className="text-[11px] font-medium text-mc-text-2 mt-0.5 leading-snug">
                              {item.examples}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Footer Note */}
                  <div className="mx-4 p-3.5 rounded-mc-lg bg-mc-warn-soft border border-mc-warn/25">
                    <p className="text-[12px] font-medium text-mc-warn leading-snug">
                      {items.footer_note}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Footer Button */}
            <div className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-mc-surface border-t border-mc-border">
              <button
                onClick={onClose}
                className="
                  w-full h-12 rounded-mc-md text-[14px] font-extrabold
                  bg-mc-danger-fill text-mc-on-danger
                  active:scale-[0.98] transition-transform duration-200
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
