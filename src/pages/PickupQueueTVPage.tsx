import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Monitor, AlertCircle, Sun, Moon, Volume2, VolumeX, Clock } from "lucide-react";
import {
  useActivatePickupQueueTV,
  usePickupQueueTV,
} from "../api/hooks/usePickupQueue";
import { PICKUP_METHOD_LABELS } from "../api/pickupQueue";
import type { PickupQueueTVItem } from "../api/pickupQueue";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TV_TOKEN_KEY = "pickup_queue_tv";
const TV_THEME_KEY = "pickup_queue_tv_theme";
const TV_SOUND_KEY = "pickup_queue_tv_sound";

interface TVTokenPayload {
  token: string;
  expires_at: string;
}

function loadTVToken(): TVTokenPayload | null {
  try {
    const raw = localStorage.getItem(TV_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TVTokenPayload;
    if (new Date(parsed.expires_at) <= new Date()) {
      localStorage.removeItem(TV_TOKEN_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function loadThemePreference(): "light" | "dark" {
  try {
    const stored = localStorage.getItem(TV_THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* noop */ }
  // Default to dark for TV displays
  return "dark";
}

function loadSoundPreference(): boolean {
  try {
    const stored = localStorage.getItem(TV_SOUND_KEY);
    // Default to true for TV displays — the user already interacted during activation.
    if (stored === null) return true;
    return stored === "true";
  } catch { /* noop */ }
  return true;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ─── Audio Alert ──────────────────────────────────────────────────────────────

import { playNotificationSound } from "../utils/notificationSounds";

function playTVAlertSound(urgent: boolean) {
  // TV speakers are often quiet / far away — use much louder volume
  playNotificationSound(urgent, { volume: urgent ? 0.85 : 0.7 });
}

// ─── Activation Screen ────────────────────────────────────────────────────────

function ActivationScreen({ onActivated, theme, onToggleTheme }: { onActivated: (token: string) => void; theme: "light" | "dark"; onToggleTheme: () => void }) {
  const [passcode, setPasscode] = useState("");
  const activateMut = useActivatePickupQueueTV();
  const isDark = theme === "dark";

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!passcode.trim()) return;
      activateMut.mutate(
        { passcode: passcode.trim() },
        {
          onSuccess: (res) => {
            onActivated(res.token);
          },
        },
      );
    },
    [passcode, activateMut, onActivated],
  );

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-500 ${isDark ? "bg-[#0a0a0a]" : "bg-[#f8f7f4]"}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className={`w-20 h-20 mx-auto mb-5 rounded-3xl flex items-center justify-center shadow-lg ${isDark ? "bg-orange-500/10" : "bg-orange-100"}`}>
            <Monitor className={`w-10 h-10 ${isDark ? "text-orange-400" : "text-orange-600"}`} />
          </div>
          <h1 className={`text-3xl font-black mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            TV Ekran
          </h1>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Navbat Sahifasi uchun TV ekranni faollashtiring
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Kod
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="Passcode kiriting"
              className={`w-full px-5 py-4 border rounded-2xl text-xl font-bold text-center tracking-[0.3em] outline-none transition-all placeholder:tracking-normal ${
                isDark
                  ? "bg-white/5 border-white/10 text-white focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-600"
                  : "bg-white border-gray-200 text-gray-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 placeholder:text-gray-400 shadow-sm"
              }`}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={activateMut.isPending || passcode.length < 4}
            className={`w-full py-4 font-bold text-lg rounded-2xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
              isDark
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/20"
                : "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/25 hover:shadow-orange-500/40"
            }`}
          >
            {activateMut.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
            Faollashtirish
          </button>
        </form>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className={`mt-6 mx-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            isDark
              ? "text-gray-400 hover:text-white hover:bg-white/5"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? "Yorug' rejimga o'tish" : "Qorong'u rejimga o'tish"}
        </button>
      </motion.div>
    </div>
  );
}

// ─── TV Board Item ────────────────────────────────────────────────────────────

function TVBoardItem({
  item,
  isNew,
  isReady,
  theme,
}: {
  item: PickupQueueTVItem;
  isNew: boolean;
  isReady: boolean;
  theme: "light" | "dark";
}) {
  const isDark = theme === "dark";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`relative rounded-2xl border p-5 sm:p-6 transition-all duration-300 ${
        isNew
          ? isReady
            ? isDark
              ? "bg-emerald-500/10 border-emerald-400/40 shadow-lg shadow-emerald-500/10"
              : "bg-emerald-50 border-emerald-300 shadow-lg shadow-emerald-500/10"
            : isDark
              ? "bg-amber-500/10 border-amber-400/40 shadow-lg shadow-amber-500/10"
              : "bg-amber-50 border-amber-300 shadow-lg shadow-amber-500/10"
          : isReady
            ? isDark
              ? "bg-white/[0.03] border-white/10 hover:border-emerald-500/30"
              : "bg-white border-gray-200 hover:border-emerald-300 shadow-sm"
            : isDark
              ? "bg-white/[0.03] border-white/10 hover:border-amber-500/30"
              : "bg-white border-gray-200 hover:border-amber-300 shadow-sm"
      }`}
    >
      {/* New item flash indicator */}
      {isNew && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.5 }}
          className={`absolute inset-0 rounded-2xl ${
            isReady
              ? isDark ? "bg-emerald-400/5" : "bg-emerald-400/10"
              : isDark ? "bg-amber-400/5" : "bg-amber-400/10"
          }`}
        />
      )}

      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`text-4xl sm:text-5xl font-black tracking-tight ${
                isReady
                  ? isDark ? "text-emerald-400" : "text-emerald-600"
                  : isDark ? "text-amber-400" : "text-amber-600"
              }`}
            >
              #{item.display_number}
            </span>
            <span
              className={`shrink-0 text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full ${
                isReady
                  ? isDark
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-emerald-100 text-emerald-700"
                  : isDark
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {isReady ? "Tayyor" : "Tayyorlanmoqda"}
            </span>
          </div>
          <p className={`text-xl sm:text-2xl font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
            {item.client_code}
          </p>
          <p className={`text-sm sm:text-base mt-1 truncate ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {item.flight_names.join(", ")}
          </p>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end">
          <div className={`text-sm font-medium mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Yuklar
          </div>
          <div className={`text-3xl sm:text-4xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
            <span className={item.remaining_cargo_count === 0 ? (isDark ? "text-emerald-400" : "text-emerald-600") : ""}>
              {item.remaining_cargo_count}
            </span>
            <span className={`text-lg sm:text-xl ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              /{item.cargo_count}
            </span>
          </div>
          <div className={`text-xs sm:text-sm mt-2 font-medium ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {PICKUP_METHOD_LABELS[item.pickup_method]}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── TV Board ─────────────────────────────────────────────────────────────────

function TVBoard({
  token,
  theme,
  onToggleTheme,
}: {
  token: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const isDark = theme === "dark";
  const [soundEnabled, setSoundEnabled] = useState(() => loadSoundPreference());
  // Audio is automatically unlocked on TV because the user already clicked
  // through the activation screen (passcode submit counts as user interaction).
  const [audioUnlocked, setAudioUnlocked] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Track new items for highlight animation
  const [newItemKeys, setNewItemKeys] = useState<Set<string>>(new Set());
  const prevPreparingRef = useRef<Set<number>>(new Set());
  const prevReadyRef = useRef<Set<number>>(new Set());

  const preparingQuery = usePickupQueueTV({ status: "preparing", limit: 50 }, token);
  const readyQuery = usePickupQueueTV({ status: "ready", limit: 50 }, token);

  const preparingItems = useMemo(() => preparingQuery.data?.items ?? [], [preparingQuery.data?.items]);
  const readyItems = useMemo(() => readyQuery.data?.items ?? [], [readyQuery.data?.items]);
  const isLoading = preparingQuery.isLoading || readyQuery.isLoading;
  const hasError = preparingQuery.error || readyQuery.error;

  // Current time ticker
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Detect new items and play sounds
  useEffect(() => {
    if (preparingQuery.isLoading || readyQuery.isLoading) return;
    if (!preparingQuery.data && !readyQuery.data) return;

    const currentPreparing = new Set<number>(preparingItems.map((i: PickupQueueTVItem) => i.display_number));
    const currentReady = new Set<number>(readyItems.map((i: PickupQueueTVItem) => i.display_number));

    // Find newly added items
    const newPreparing = preparingItems.filter(
      (i: PickupQueueTVItem) => !prevPreparingRef.current.has(i.display_number)
    );
    const newReady = readyItems.filter(
      (i: PickupQueueTVItem) => !prevReadyRef.current.has(i.display_number)
    );

    // Items that moved from preparing to ready
    const movedToReady = readyItems.filter(
      (i: PickupQueueTVItem) => prevPreparingRef.current.has(i.display_number) && !prevReadyRef.current.has(i.display_number)
    );

    const hasNewNormal = newPreparing.length > 0;
    const hasNewReady = newReady.length > 0 || movedToReady.length > 0;

    // Build set of new item keys for highlight animation
    const nextNewKeys = new Set<string>([
      ...newPreparing.map((i: PickupQueueTVItem) => `prep-${i.display_number}`),
      ...newReady.map((i: PickupQueueTVItem) => `ready-${i.display_number}`),
      ...movedToReady.map((i: PickupQueueTVItem) => `ready-${i.display_number}`),
    ]);

    // Play sound if enabled, audio is unlocked, and there are new items
    // Skip on first load (prev sets are empty)
    const isFirstLoad = prevPreparingRef.current.size === 0 && prevReadyRef.current.size === 0;
    if (soundEnabled && audioUnlocked && !isFirstLoad) {
      if (hasNewReady) {
        playTVAlertSound(true);
      } else if (hasNewNormal) {
        playTVAlertSound(false);
      }
    }

    prevPreparingRef.current = currentPreparing;
    prevReadyRef.current = currentReady;

    if (nextNewKeys.size === 0) return;

    setNewItemKeys(nextNewKeys);
    const timeout = setTimeout(() => setNewItemKeys(new Set()), 3000);
    return () => clearTimeout(timeout);
  }, [preparingItems, readyItems, preparingQuery.isLoading, readyQuery.isLoading, preparingQuery.data, readyQuery.data, soundEnabled, audioUnlocked]);

  // Handle TV token expiry / invalidation by returning to activation
  useEffect(() => {
    const err = preparingQuery.error || readyQuery.error;
    if (err && (err as { status?: number }).status === 401) {
      localStorage.removeItem(TV_TOKEN_KEY);
      window.location.reload();
    }
  }, [preparingQuery.error, readyQuery.error]);

  const unlockAudio = useCallback(() => {
    if (!audioUnlocked) {
      setAudioUnlocked(true);
    }
  }, [audioUnlocked]);

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(TV_SOUND_KEY, String(next));
    if (next) setAudioUnlocked(true);
  }, [soundEnabled]);

  if (hasError && (hasError as { status?: number }).status !== 401) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-500 ${isDark ? "bg-[#0a0a0a]" : "bg-[#f8f7f4]"}`}>
        <div className="text-center">
          <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${isDark ? "text-red-400" : "text-red-500"}`} />
          <p className={`text-lg font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            Xatolik yuz berdi
          </p>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {(hasError as { message?: string }).message ?? "Ma'lumotlarni yuklab bo'lmadi"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={unlockAudio}
      className={`min-h-screen transition-colors duration-500 ${isDark ? "bg-[#0a0a0a] text-white" : "bg-[#f8f7f4] text-gray-900"}`}
    >
      {/* Header */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
        isDark
          ? "bg-[#0a0a0a]/80 border-white/5"
          : "bg-[#f8f7f4]/80 border-gray-200/60"
      }`}>
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md ${
              isDark ? "bg-orange-500/10" : "bg-orange-100"
            }`}>
              <Monitor className={`w-5 h-5 sm:w-6 sm:h-6 ${isDark ? "text-orange-400" : "text-orange-600"}`} />
            </div>
            <div>
              <h1 className={`text-base sm:text-lg font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                Mandarin Cargo
              </h1>
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>Navbat Sahifasi</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold text-emerald-500">LIVE</span>
            </div>

            {/* Last update */}
            {preparingQuery.dataUpdatedAt > 0 && (
              <div className={`hidden md:flex items-center gap-1.5 text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                <Clock className="w-3 h-3" />
                {formatTime(new Date(preparingQuery.dataUpdatedAt))}
              </div>
            )}

            {/* Sound toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleSound(); }}
              className={`p-2 rounded-xl transition-colors ${
                soundEnabled
                  ? isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                  : isDark ? "bg-white/5 text-gray-500 hover:text-gray-300" : "bg-gray-100 text-gray-400 hover:text-gray-600"
              }`}
              title={soundEnabled ? "Ovozni o'chirish" : "Ovozni yoqish"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Theme toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleTheme(); }}
              className={`p-2 rounded-xl transition-colors ${
                isDark ? "bg-white/5 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900"
              }`}
              title={isDark ? "Yorug' rejim" : "Qorong'u rejim"}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Current time */}
            <div className={`hidden lg:block text-lg font-mono font-bold tabular-nums ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              {formatTime(currentTime)}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 py-4 sm:py-6">
        {/* Two-column layout on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
          {/* ── Preparing Column ── */}
          <section>
            {/* Large yellow header */}
            <div className={`flex items-center justify-between mb-4 sm:mb-5 px-4 sm:px-5 py-3 sm:py-4 rounded-2xl border ${
              isDark
                ? "bg-amber-500/10 border-amber-500/20"
                : "bg-amber-50 border-amber-200"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full animate-pulse ${isDark ? "bg-amber-400" : "bg-amber-500"}`} />
                <h2 className={`text-xl sm:text-2xl xl:text-3xl font-black ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                  Tayyorlanmoqda
                </h2>
              </div>
              <span className={`text-2xl sm:text-3xl xl:text-4xl font-black tabular-nums ${isDark ? "text-amber-300" : "text-amber-700"}`}>
                {preparingItems.length}
              </span>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <AnimatePresence mode="popLayout">
                {preparingItems.map((item: PickupQueueTVItem) => (
                  <TVBoardItem
                    key={`prep-${item.display_number}`}
                    item={item}
                    isNew={newItemKeys.has(`prep-${item.display_number}`)}
                    isReady={false}
                    theme={theme}
                  />
                ))}
              </AnimatePresence>
              {preparingItems.length === 0 && !isLoading && (
                <div className={`text-center py-12 sm:py-16 rounded-2xl border border-dashed ${
                  isDark ? "border-white/10 text-gray-600" : "border-gray-200 text-gray-400"
                }`}>
                  <p className="text-base sm:text-lg font-medium">Navbatlar yo'q</p>
                  <p className={`text-sm mt-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                    Yangi buyurtmalar kelishini kuting
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ── Ready Column ── */}
          <section>
            {/* Large green header */}
            <div className={`flex items-center justify-between mb-4 sm:mb-5 px-4 sm:px-5 py-3 sm:py-4 rounded-2xl border ${
              isDark
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-emerald-50 border-emerald-200"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${isDark ? "bg-emerald-400" : "bg-emerald-500"}`} />
                <h2 className={`text-xl sm:text-2xl xl:text-3xl font-black ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                  Tayyor
                </h2>
              </div>
              <span className={`text-2xl sm:text-3xl xl:text-4xl font-black tabular-nums ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                {readyItems.length}
              </span>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <AnimatePresence mode="popLayout">
                {readyItems.map((item: PickupQueueTVItem) => (
                  <TVBoardItem
                    key={`ready-${item.display_number}`}
                    item={item}
                    isNew={newItemKeys.has(`ready-${item.display_number}`)}
                    isReady
                    theme={theme}
                  />
                ))}
              </AnimatePresence>
              {readyItems.length === 0 && !isLoading && (
                <div className={`text-center py-12 sm:py-16 rounded-2xl border border-dashed ${
                  isDark ? "border-white/10 text-gray-600" : "border-gray-200 text-gray-400"
                }`}>
                  <p className="text-base sm:text-lg font-medium">Navbatlar yo'q</p>
                  <p className={`text-sm mt-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                    Tayyor buyurtmalar shu yerda ko'rinadi
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Mobile live indicator bar */}
      <div className={`sm:hidden fixed bottom-0 left-0 right-0 z-40 px-4 py-2 flex items-center justify-between border-t backdrop-blur-xl ${
        isDark
          ? "bg-[#0a0a0a]/90 border-white/5"
          : "bg-[#f8f7f4]/90 border-gray-200/60"
      }`}>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-bold text-emerald-500">LIVE</span>
        </div>
        <div className={`text-sm font-mono font-bold ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          {formatTime(currentTime)}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PickupQueueTVPage() {
  const [token, setToken] = useState<string | null>(() => loadTVToken()?.token ?? null);
  const [theme, setTheme] = useState<"light" | "dark">(() => loadThemePreference());

  useEffect(() => {
    const handler = () => {
      const t = loadTVToken();
      setToken(t?.token ?? null);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(TV_THEME_KEY, next);
      return next;
    });
  }, []);

  // Apply dark class to document for Tailwind dark mode
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  if (!token) {
    return (
      <ActivationScreen
        onActivated={(t) => setToken(t)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  return (
    <TVBoard
      token={token}
      theme={theme}
      onToggleTheme={handleToggleTheme}
    />
  );
}
