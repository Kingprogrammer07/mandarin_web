import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { offlineStorage } from "@/utils/offlineStorage";
import { uploadPhoto } from "@/api/services/cargo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MultiPhotoUpload from "@/components/MultiPhotoUpload";
import type { MultiPhotoUploadHandle } from "@/components/MultiPhotoUpload";
import {
  ArrowLeft,
  Save,
  Camera,
  Check,
  ChevronDown,
  MapPin,
  Search,
  X,
  Lock,
  Send,
} from "lucide-react";
import { regions, DISTRICTS } from "@/lib/validation";
import { normalizeNumber } from "@/utils/numberFormat";
import {
  AVIA_CODES,
  REGION_PREFIXES,
  getRegionAndDistrictFromCode,
} from "@/lib/aviaCodes";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "react-i18next";
import { getAdminJwtClaims } from "@/api/services/adminManagement";

/* ───────────────────────────────────────────
   Types
   ─────────────────────────────────────────── */
interface AddCargoFormProps {
  flightName: string;
  onBack: () => void;
  onSuccess: () => void;
}

interface QueuedUpload {
  id: string;
  flightName: string;
  clientId: string;
  photos: File[];
  weightKg?: number;
  pricePerKg?: number;
  comment?: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  retryCount: number;
}

interface SelectOption {
  value: string;
  label: string;
}

/* ───────────────────────────────────────────
   Lightweight Searchable Select (no radix overhead)
   ─────────────────────────────────────────── */
interface LightSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

const LightSelect = memo(function LightSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled = false,
  icon,
}: LightSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? "",
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler, { passive: true });
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // focus search when opened — only on non-touch devices
  useEffect(() => {
    if (open && searchRef.current) {
      const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      if (!isMobile) {
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    }
  }, [open]);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      setSearch("");
    },
    [onChange],
  );

  const toggle = useCallback(() => {
    if (disabled) return;
    setOpen((p) => {
      if (p) setSearch("");
      return !p;
    });
  }, [disabled]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={[
          "flex items-center w-full h-12 px-3 rounded-xl text-left",
          "border border-gray-200 dark:border-white/10",
          "bg-gray-50 dark:bg-white/5",
          "text-gray-900 dark:text-white",
          "transition-colors duration-100",
          "active:bg-orange-50 dark:active:bg-orange-500/10",
          disabled ? "opacity-40 pointer-events-none" : "cursor-pointer",
          open ? "border-orange-500 ring-2 ring-orange-500/20" : "",
        ].join(" ")}
      >
        {icon && <span className="mr-2 shrink-0">{icon}</span>}
        <span
          className={`flex-1 truncate text-sm ${value ? "font-medium" : "text-gray-400 dark:text-gray-500"}`}
        >
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={[
            "absolute z-50 mt-1 w-full",
            "bg-white dark:bg-[#1a1209]",
            "border border-gray-200 dark:border-orange-500/20",
            "rounded-xl shadow-lg shadow-black/10 dark:shadow-black/40",
            "overflow-hidden",
            "animate-in fade-in zoom-in-95 duration-100",
          ].join(" ")}
        >
          {/* Search — only show if > 6 options */}
          {options.length > 6 && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-white/5">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="p-0.5"
                >
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>
          )}

          {/* List */}
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto overscroll-contain py-1"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-400 text-center">
                {emptyText}
              </p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={[
                    "flex items-center w-full px-3 py-2.5 text-sm text-left",
                    "transition-colors duration-75",
                    "active:bg-orange-100 dark:active:bg-orange-500/20",
                    opt.value === value
                      ? "text-orange-600 dark:text-orange-400 bg-orange-50/70 dark:bg-orange-500/10 font-medium"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5",
                  ].join(" ")}
                >
                  <Check
                    className={`w-4 h-4 mr-2 shrink-0 ${opt.value === value ? "opacity-100 text-orange-500" : "opacity-0"}`}
                  />
                  <span className="truncate">{opt.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

/* ───────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────── */

const INPUT_CLS = [
  "h-12 rounded-xl",
  "border border-gray-200 dark:border-white/10",
  "bg-gray-50 dark:bg-white/5",
  "text-gray-900 dark:text-white",
  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
  "transition-colors duration-100",
  "focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:ring-offset-0 focus:outline-none",
].join(" ");

const ERR_CLS = "border-red-500 focus:border-red-500 focus:ring-red-500/20";

/** Max items allowed in upload queue to prevent memory overflow in fast mode */
const MAX_QUEUE_SIZE = 20;
/** Max retry attempts for transient (network) errors before giving up */
const MAX_RETRIES = 2;
/** Delay between retries in ms (doubles each attempt) */
const RETRY_BASE_DELAY = 2000;

/* ───────────────────────────────────────────
   Queue Status (memoised to avoid repainting form)
   ─────────────────────────────────────────── */
const QueueStatus = memo(function QueueStatus({
  queue,
  t,
}: {
  queue: QueuedUpload[];
  t: (k: string) => string;
}) {
  if (queue.length === 0) return null;

  const active = queue.filter(
    (i) => i.status === "pending" || i.status === "uploading",
  ).length;

  return (
    <div className="space-y-1.5 pt-2">
      {queue.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-200 border"
          style={{
            background:
              item.status === "uploading"
                ? "rgb(239 246 255 / 0.8)"
                : item.status === "success"
                  ? "rgb(240 253 244 / 0.8)"
                  : item.status === "error"
                    ? "rgb(254 242 242 / 0.8)"
                    : "rgb(249 250 251 / 0.8)",
            borderColor:
              item.status === "uploading"
                ? "rgb(191 219 254)"
                : item.status === "success"
                  ? "rgb(187 247 208)"
                  : item.status === "error"
                    ? "rgb(254 202 202)"
                    : "rgb(229 231 235)",
          }}
        >
          {/* Status icon */}
          {item.status === "pending" && (
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full shrink-0" />
          )}
          {item.status === "uploading" && (
            <span className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          {item.status === "success" && (
            <span className="w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 8 8" className="w-2 h-2 text-white fill-none stroke-current stroke-[1.5]">
                <polyline points="1,4 3,6 7,2" />
              </svg>
            </span>
          )}
          {item.status === "error" && (
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0 mt-0.5" />
          )}

          {/* Label */}
          <span
            className={
              item.status === "uploading" ? "text-blue-700" :
              item.status === "success"   ? "text-green-700" :
              item.status === "error"     ? "text-red-700" :
              "text-gray-500"
            }
          >
            {item.status === "pending"   && t("cargo.queuePending")}
            {item.status === "uploading" && t("cargo.queueUploading")}
            {item.status === "success"   && "Yuklandi"}
            {item.status === "error"     && t("cargo.queueError")}
          </span>

          <span className="font-black text-gray-800 font-mono truncate">{item.clientId}</span>

          {item.status === "error" && item.error && (
            <span className="ml-auto text-red-500 truncate max-w-[120px]" title={item.error}>
              {item.error}
            </span>
          )}
        </div>
      ))}
      {active > 0 && (
        <p className="text-[11px] text-gray-400 px-1">
          {t("cargo.queueSummary")}: {active} {t("cargo.queueInQueue")}
        </p>
      )}
    </div>
  );
});

/* ───────────────────────────────────────────
   Main Form
   ─────────────────────────────────────────── */
export default function AddCargoForm({
  flightName,
  onBack,
  onSuccess,
}: AddCargoFormProps) {
  const { t } = useTranslation();

  // ── Form state ──
  const [clientId, setClientId] = useState("");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Mode toggles ──
  const [fastMode, setFastMode] = useState(false);
  const [autoCamera, setAutoCamera] = useState(true);

  // ── Keep client/region toggle (default: ON → saqlanadi) ──
  const [keepClientRegion, setKeepClientRegion] = useState(true);

  // ── Upload queue ──
  const [uploadQueue, setUploadQueue] = useState<QueuedUpload[]>([]);

  // ── Refs ──
  const clientIdRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<MultiPhotoUploadHandle>(null);
  const prevFastRef = useRef(false);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  /** Safe setTimeout that auto-cleans on unmount */
  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id);
      if (mountedRef.current) fn();
    }, ms);
    timeoutsRef.current.add(id);
    return id;
  }, []);

  /** Track mount/unmount lifecycle */
  useEffect(() => {
    mountedRef.current = true;
    const timeouts = timeoutsRef.current;
    return () => {
      mountedRef.current = false;
      timeouts.forEach(clearTimeout);
      timeouts.clear();
      processingRef.current = false;
    };
  }, []);

  const { toast, ToastRenderer } = useToast();

  /** Focus client ID input and place cursor at the END of the value */
  const focusClientIdEnd = useCallback(() => {
    const el = clientIdRef.current;
    if (!el) return;
    el.focus();
    requestAnimationFrame(() => {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  }, []);

  /* ── Memoised option lists ── */
  const regionOptions = useMemo<SelectOption[]>(
    () => regions.map((r) => ({ value: r.value, label: t(r.label) })),
    [t],
  );

  const districtOptions = useMemo<SelectOption[]>(
    () =>
      region && DISTRICTS[region]
        ? DISTRICTS[region].map((d) => ({ value: d.value, label: t(d.label) }))
        : [],
    [region, t],
  );

  /* ── Handlers (stable refs) ── */
  const clearError = useCallback((key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleClientIdChange = useCallback(
    (value: string) => {
      const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
      setClientId(cleaned);
      clearError("client_id");

      if (cleaned.length >= 2) {
        const { region: r, district: d } =
          getRegionAndDistrictFromCode(cleaned);
        if (r) setRegion(r);
        if (d) setDistrict(d);
        else setDistrict("");
      } else {
        setRegion("");
        setDistrict("");
      }
    },
    [clearError],
  );

  const updatePrefix = useCallback((newRegion: string, newDistrict: string) => {
    let prefix = "";
    if (newDistrict && AVIA_CODES[newDistrict]) {
      prefix = AVIA_CODES[newDistrict];
    } else if (newRegion && REGION_PREFIXES[newRegion]) {
      prefix = REGION_PREFIXES[newRegion];
    }

    if (prefix) {
      setClientId((prev) => {
        const { region: oldR, district: oldD } =
          getRegionAndDistrictFromCode(prev);
        if (oldD && AVIA_CODES[oldD] && prev.startsWith(AVIA_CODES[oldD])) {
          return prefix + prev.slice(AVIA_CODES[oldD].length);
        }
        if (
          oldR &&
          REGION_PREFIXES[oldR] &&
          prev.startsWith(REGION_PREFIXES[oldR])
        ) {
          return prefix + prev.slice(REGION_PREFIXES[oldR].length);
        }
        return prefix + prev;
      });
    } else {
      setClientId("");
    }
  }, []);

  const handleRegionSelect = useCallback(
    (r: string) => {
      setRegion(r);
      setDistrict("");
      updatePrefix(r, "");
    },
    [updatePrefix],
  );

  const handleDistrictSelect = useCallback(
    (d: string) => {
      setDistrict(d);
      updatePrefix(region, d);
      requestAnimationFrame(() => focusClientIdEnd());
    },
    [focusClientIdEnd, region, updatePrefix],
  );

  const handleWeightChange = useCallback(
    (value: string) => {
      const cleaned = normalizeNumber(value);
      if (cleaned === null) return;
      if (cleaned === "") {
        setWeightKg("");
        clearError("weight_kg");
        return;
      }
      const num = Number(cleaned);
      if (isNaN(num) || num < 0) return;
      setWeightKg(num >= 100 ? "99" : cleaned);
      clearError("weight_kg");
    },
    [clearError],
  );

  const handlePriceChange = useCallback(
    (value: string) => {
      const cleaned = normalizeNumber(value);
      if (cleaned === null) return;
      setPricePerKg(cleaned);
      clearError("price_per_kg");
    },
    [clearError],
  );

  /* ── Keep toggle handler ── */
  const handleKeepToggle = useCallback((checked: boolean) => {
    setKeepClientRegion(checked);
    // Toggle o'chirilganda darhol tozala
    if (!checked) {
      setClientId("");
      setRegion("");
      setDistrict("");
    }
  }, []);

  /* ── Validation ── */
  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!clientId.trim())
      e.client_id = t("cargo.validation.clientCodeRequired");
    else if (!/^[A-Z][A-Z0-9-]*$/.test(clientId))
      e.client_id = t("cargo.validation.clientCodeInvalid");
    if (photos.length === 0) e.photos = t("cargo.validation.photoRequired");
    if (!weightKg.trim()) e.weight_kg = t("cargo.validation.weightRequired");
    else if (isNaN(Number(weightKg)))
      e.weight_kg = t("cargo.validation.weightInvalid");
    if (pricePerKg && isNaN(Number(pricePerKg)))
      e.price_per_kg = t("cargo.validation.weightInvalid");
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [clientId, photos, weightKg, pricePerKg, t]);

  /* ── Fast-mode camera warm-up ── */
  useEffect(() => {
    if (fastMode && !prevFastRef.current) {
      cameraRef.current?.prepareStream();
    }
    prevFastRef.current = fastMode;
  }, [fastMode]);

  /* ── Submit ── */
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate() || photos.length === 0) return;

      // Prevent queue overflow in fast mode
      const activeCount = uploadQueue.filter(
        (i) => i.status === "pending" || i.status === "uploading",
      ).length;
      if (activeCount >= MAX_QUEUE_SIZE) {
        toast({
          title: "⚠️ Navbat to'ldi",
          description: `Iltimos, ${MAX_QUEUE_SIZE} ta yuklash tugashini kuting.`,
          variant: "warning",
          duration: 3000,
        });
        return;
      }

      const item: QueuedUpload = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        flightName,
        clientId,
        photos,
        weightKg: weightKg ? Number(weightKg) : undefined,
        pricePerKg: pricePerKg ? Number(pricePerKg) : undefined,
        comment: comment.trim() || undefined,
        status: "pending",
        retryCount: 0,
      };

      setUploadQueue((prev) => [...prev, item]);

      if (fastMode) {
        if (keepClientRegion) {
          // Faqat prefixni saqlаb, raqamli qismini tozala
          setClientId((prev) => {
            const { district: d, region: r } = getRegionAndDistrictFromCode(prev);
            if (d && AVIA_CODES[d] && prev.startsWith(AVIA_CODES[d])) {
              return AVIA_CODES[d];
            }
            if (r && REGION_PREFIXES[r] && prev.startsWith(REGION_PREFIXES[r])) {
              return REGION_PREFIXES[r];
            }
            return "";
          });
          // region va district o'zgarishsiz qoladi
        } else {
          // Hammasi tozalanadi
          setClientId("");
          setRegion("");
          setDistrict("");
        }

        setWeightKg("");
        setPricePerKg("");
        setComment("");
        setPhotos([]);
        setErrors({});

        safeTimeout(() => {
          if (autoCamera) cameraRef.current?.openCamera();
          else focusClientIdEnd();
        }, 80);
      }
    },
    [
      validate,
      photos,
      flightName,
      clientId,
      weightKg,
      pricePerKg,
      comment,
      fastMode,
      autoCamera,
      keepClientRegion,
      focusClientIdEnd,
      safeTimeout,
      toast,
      uploadQueue,
    ],
  );

  /* ── Background queue processor ── */
  useEffect(() => {
    if (processingRef.current) return;

    const pending = uploadQueue.find((i) => i.status === "pending");

    if (!pending) {
      if (
        !fastMode &&
        uploadQueue.length > 0 &&
        uploadQueue.every((i) => i.status === "success" || i.status === "error")
      ) {
        const id = safeTimeout(onSuccess, 1000);
        return () => clearTimeout(id);
      }
      return;
    }

    processingRef.current = true;

    const run = async () => {
      await new Promise((r) => setTimeout(r, 600));
      if (!mountedRef.current) {
        processingRef.current = false;
        return;
      }

      setUploadQueue((prev) =>
        prev.map((i) =>
          i.id === pending.id ? { ...i, status: "uploading" } : i,
        ),
      );

      try {
        await uploadPhoto(
          pending.flightName,
          pending.clientId,
          pending.photos,
          pending.weightKg,
          pending.pricePerKg,
          pending.comment,
        );
        if (!mountedRef.current) {
          processingRef.current = false;
          return;
        }

        setUploadQueue((prev) =>
          prev.map((i) =>
            i.id === pending.id ? { ...i, status: "success" } : i,
          ),
        );
        toast({
          title: `✅ ${t("cargo.messages.uploadSuccess")}`,
          description: `${t("cargo.photoCard.client")} ${pending.clientId} — ${pending.photos.length} ${t("cargo.photos")}`,
          variant: "success",
          duration: 2000,
        });

        safeTimeout(() => {
          setUploadQueue((prev) => prev.filter((i) => i.id !== pending.id));
        }, 3000);
      } catch (error: unknown) {
        if (!mountedRef.current) {
          processingRef.current = false;
          return;
        }

        const msg =
          (error as { data?: { detail?: string } })?.data?.detail ??
          (error as { message?: string })?.message ??
          t("cargo.messages.uploadError");

        const isNetwork =
          (error as { message?: string })?.message === "Network Error" ||
          !navigator.onLine;
        const hasResp =
          typeof error === "object" && error !== null && "response" in error;

        if (!hasResp || isNetwork) {
          if (pending.retryCount < MAX_RETRIES) {
            const delay = RETRY_BASE_DELAY * Math.pow(2, pending.retryCount);
            toast({
              title: "🔄 Qayta urinish...",
              description: `${pending.clientId} — ${pending.retryCount + 1}/${MAX_RETRIES}`,
              variant: "warning",
              duration: delay,
            });
            setUploadQueue((prev) =>
              prev.map((i) =>
                i.id === pending.id
                  ? { ...i, status: "pending", retryCount: i.retryCount + 1 }
                  : i,
              ),
            );
            await new Promise((r) => setTimeout(r, delay));
          } else {
            try {
              await offlineStorage.saveItem({
                id: pending.id,
                flightName: pending.flightName,
                clientId: pending.clientId,
                photos: pending.photos,
                weightKg: pending.weightKg,
                pricePerKg: pending.pricePerKg,
                comment: pending.comment,
                error: msg,
                timestamp: Date.now(),
              });
              if (!mountedRef.current) {
                processingRef.current = false;
                return;
              }
              toast({
                title: "⚠️ Internet yo'q",
                description: `${pending.clientId} — oflayn xotiraga saqlandi.`,
                variant: "warning",
                duration: 3000,
              });
              setUploadQueue((prev) => prev.filter((i) => i.id !== pending.id));
            } catch {
              if (!mountedRef.current) {
                processingRef.current = false;
                return;
              }
              setUploadQueue((prev) =>
                prev.map((i) =>
                  i.id === pending.id
                    ? {
                        ...i,
                        status: "error",
                        error: "Offline save failed: " + msg,
                      }
                    : i,
                ),
              );
            }
          }
        } else {
          setUploadQueue((prev) =>
            prev.map((i) =>
              i.id === pending.id ? { ...i, status: "error", error: msg } : i,
            ),
          );
        }
      } finally {
        processingRef.current = false;
      }
    };
    run();
  }, [uploadQueue, fastMode, onSuccess, toast, t, safeTimeout]);

  /* ── Auto-focus clientId after photos ── */
  useEffect(() => {
    if (photos.length > 0 && !clientId) {
      focusClientIdEnd();
    }
  }, [photos.length, clientId, focusClientIdEnd]);

  /* ── Permission guard — must be after all hooks ── */
  const jwtClaims = getAdminJwtClaims();
  const canCreate = jwtClaims.isSuperAdmin || jwtClaims.permissions.has('flights:create');
  if (!canCreate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
          <Lock className="w-8 h-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[16px] font-bold text-gray-700 dark:text-gray-300">Ruxsat yo'q</p>
          <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
            Sizda ushbu sahifani ko'rish yoki tahrirlash uchun huquq yo'q.
          </p>
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <>
      <ToastRenderer />

      <div className="w-full max-w-xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="relative bg-white dark:bg-[#0d0a04] rounded-3xl border border-orange-100/80 dark:border-orange-500/15 overflow-hidden shadow-xl">
          {/* accent bar */}
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

          {/* dot grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.022] dark:opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgb(249,115,22) 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />

          <div className="relative p-6 sm:p-8 lg:p-10">
            {/* Header */}
            <div className="mb-8">
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-500 transition-colors mb-6 active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">{t("cargo.flight")}</span>
              </button>

              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/40">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 bg-clip-text text-transparent">
                    {t("cargo.addTitle")}
                  </h1>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t("cargo.flight")}:{" "}
                    <span className="text-gray-800 dark:text-gray-300 font-semibold">
                      {flightName}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* ── Fast Mode ── */}
            <div className="mb-8 bg-orange-50/50 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/20 rounded-2xl p-5">
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-4 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={fastMode}
                      onChange={(e) => setFastMode(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-7 bg-gray-200 dark:bg-gray-800 rounded-full peer-checked:bg-orange-500 dark:peer-checked:bg-orange-600 transition-all border border-gray-300 dark:border-gray-700 peer-checked:border-orange-500/50" />
                    <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      <Camera className="w-4 h-4 text-orange-500" />
                      {t("cargo.fastMode")}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {t("cargo.fastModeDescription")}
                    </p>
                  </div>
                </label>

                {fastMode && (
                  <div className="pl-16 animate-in slide-in-from-top-2 fade-in duration-150">
                    <label className="flex items-center gap-3 cursor-pointer select-none group/auto">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={autoCamera}
                          onChange={(e) => setAutoCamera(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 dark:bg-gray-800 rounded-full peer-checked:bg-green-500 dark:peer-checked:bg-green-600 border border-gray-300 dark:border-gray-700 peer-checked:border-green-500 transition-all" />
                        <div className="absolute left-[3px] top-[3px] w-3.5 h-3.5 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform" />
                      </div>
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 group-hover/auto:text-gray-800 dark:group-hover/auto:text-gray-200 transition-colors">
                        {t("cargo.autoOpen")}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* ── Form ── */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Photos */}
              <MultiPhotoUpload
                ref={cameraRef}
                label={t("cargo.photoRequired")}
                value={photos}
                onChange={setPhotos}
                error={errors.photos}
                maxPhotos={10}
                fastMode={fastMode}
                onCameraClose={() => {
                  if (!clientId) focusClientIdEnd();
                }}
              />

              {/* ── Keep Client/Region toggle ── */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 leading-none">
                      Viloyat va kodni saqlash
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {keepClientRegion
                        ? "Keyingi yuklashda saqlanadi"
                        : "Har yuklashda tozalanadi"}
                    </p>
                  </div>
                </div>

                <label className="relative cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={keepClientRegion}
                    onChange={(e) => handleKeepToggle(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-800 rounded-full peer-checked:bg-orange-500 dark:peer-checked:bg-orange-600 border border-gray-300 dark:border-gray-700 peer-checked:border-orange-500/50 transition-all" />
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform" />
                </label>
              </div>

              {/* Region */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Viloyat <span className="text-red-500">*</span>
                </label>
                <LightSelect
                  options={regionOptions}
                  value={region}
                  onChange={handleRegionSelect}
                  placeholder="Viloyatni tanlang"
                  searchPlaceholder="Qidirish..."
                  emptyText="Viloyat topilmadi."
                  icon={<MapPin className="w-5 h-5 text-orange-500" />}
                />
              </div>

              {/* District */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Tuman <span className="text-red-500">*</span>
                </label>
                <LightSelect
                  options={districtOptions}
                  value={district}
                  onChange={handleDistrictSelect}
                  placeholder="Tumanni tanlang"
                  searchPlaceholder="Qidirish..."
                  emptyText="Tuman topilmadi."
                  disabled={!region || districtOptions.length === 0}
                  icon={
                    <MapPin className="w-5 h-5 text-orange-500 opacity-60" />
                  }
                />
              </div>

              {/* Client ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  {t("cargo.clientCode")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <Input
                  ref={clientIdRef}
                  type="text"
                  // When the region/district prefix is locked in, the admin only
                  // types the numeric suffix → show a numpad for speed.
                  // When the toggle is off they need to type letters too → normal keyboard.
                  inputMode={keepClientRegion ? "numeric" : "text"}
                  value={clientId}
                  onChange={(e) => handleClientIdChange(e.target.value)}
                  placeholder={t("cargo.clientCodePlaceholder")}
                  className={`${INPUT_CLS} text-lg uppercase font-mono tracking-widest placeholder:tracking-normal placeholder:font-normal caret-orange-500 ${errors.client_id ? ERR_CLS : ""}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      weightRef.current?.focus();
                    }
                  }}
                />
                {errors.client_id && (
                  <p className="text-sm font-medium text-red-500 dark:text-red-400 mt-1.5">
                    {errors.client_id}
                  </p>
                )}
              </div>

              {/* Weight + Price row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    {t("cargo.weight")} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      ref={weightRef}
                      type="text"
                      inputMode="decimal"
                      value={weightKg}
                      onChange={(e) => handleWeightChange(e.target.value)}
                      placeholder={t("cargo.weightPlaceholder")}
                      className={`${INPUT_CLS} pr-12 caret-orange-500 ${errors.weight_kg ? ERR_CLS : ""}`}
                    />
                    <button
                      type="submit"
                      className="absolute right-1 top-1 bottom-1 w-10 flex items-center justify-center bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-[10px] transition-all shadow-sm"
                      title={fastMode ? t("cargo.saveAndNext") : t("cargo.submit")}
                    >
                      <Send className="w-4 h-4 ml-0.5" />
                    </button>
                  </div>
                  {errors.weight_kg && (
                    <p className="text-sm font-medium text-red-500 dark:text-red-400 mt-1.5">
                      {errors.weight_kg}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    {t("cargo.pricePerKg")}
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={pricePerKg}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder={t("cargo.pricePerKgPlaceholder")}
                    className={`${INPUT_CLS} caret-orange-500 ${errors.price_per_kg ? ERR_CLS : ""}`}
                  />
                  {errors.price_per_kg && (
                    <p className="text-sm font-medium text-red-500 dark:text-red-400 mt-1.5">
                      {errors.price_per_kg}
                    </p>
                  )}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  {t("cargo.comment")}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("cargo.commentPlaceholder")}
                  rows={2}
                  className={`${INPUT_CLS} w-full px-3 py-2.5 resize-none h-auto`}
                />
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-4">
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    className="flex-1 h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 active:brightness-95 active:scale-[0.98] text-white font-bold text-base tracking-wide rounded-xl shadow-md shadow-orange-500/30 transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed border-0"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Save className="w-5 h-5" />
                      <span>
                        {fastMode ? t("cargo.saveAndNext") : t("cargo.submit")}
                      </span>
                    </div>
                  </Button>

                  <Button
                    type="button"
                    onClick={onBack}
                    variant="outline"
                    className="h-14 px-6 rounded-xl border-2 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 font-semibold transition-colors"
                  >
                    {t("cargo.cancel")}
                  </Button>
                </div>

                <QueueStatus queue={uploadQueue} t={t} />
              </div>

              {fastMode && (
                <div className="bg-blue-50/80 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4 text-sm whitespace-pre-line">
                  <p className="text-blue-800 dark:text-blue-300/90 leading-relaxed font-medium">
                    {t("cargo.fastModeInstructions")}
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
