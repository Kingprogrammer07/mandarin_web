import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileSpreadsheet, Database, RefreshCw, Plane, RotateCcw, Save, CheckCircle2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import StatusAnimation from '@/components/StatusAnimation';
import { importExcel } from '@/api/services/import';
import {
  clearFlightTrackingStep,
  deleteFlightCargoItems,
  getFlightTrackingStatuses,
  updateFlightTrackingSteps,
  type FlightTrackingStatus,
  type StepAutoStatus,
  type TrackingStepStatus,
  type UpdateTrackingRequest,
} from '@/api/services/tracking';
import { useConfirm } from '@/hooks/useConfirm';
import { NATIVE_OPTION_CLASS } from '@/components/ui/select-styles';
import CampaignSender from '@/components/admin/CampaignSender';

type DatabaseType = 'uz' | 'china';
type MainTab = 'import' | 'tracking';
type StepSelectValue = TrackingStepStatus | 'auto';

const STEP_OPTIONS: Array<{ value: StepSelectValue; label: string }> = [
  { value: 'auto', label: 'Avtomatik' },
  { value: 'pending', label: 'Kutilmoqda' },
  { value: 'available', label: 'Mavjud' },
  { value: 'nodata', label: "Ma'lumot yo'q" },
];

/** The three overridable steps, with the response fields that describe each. */
const TRACKING_STEPS = [
  {
    number: 2,
    title: "2-step (Yo'lda)",
    statusKey: 'step_2_status',
    autoKey: 'step_2_auto',
    manualKey: 'step_2_is_manual',
  },
  {
    number: 3,
    title: '3-step (Bojxonada)',
    statusKey: 'step_3_status',
    autoKey: 'step_3_auto',
    manualKey: 'step_3_is_manual',
  },
  {
    number: 4,
    title: '4-step (Toshkent ombori)',
    statusKey: 'step_4_status',
    autoKey: 'step_4_auto',
    manualKey: 'step_4_is_manual',
  },
] as const;

type StepStatusKey = (typeof TRACKING_STEPS)[number]['statusKey'];
type TrackingStep = (typeof TRACKING_STEPS)[number];
type PendingTrackingChanges = Partial<Record<StepStatusKey, StepSelectValue>>;

const AUTO_STATUS_LABELS: Record<StepAutoStatus['status'], string> = {
  available: "to'liq",
  partial: 'qisman',
  pending: 'jarayonda',
  nodata: "ma'lumot yo'q",
};

/**
 * What the warehouse data says, next to what the operator forced.
 *
 * Without this the two were indistinguishable: an override set during a delay
 * looked identical to a status the system worked out itself, so nobody knew
 * when it was safe to let go of it.
 */
function AutoSignalHint({ auto, isManual }: { auto: StepAutoStatus | null; isManual: boolean }) {
  if (!auto) return null;

  const isClientUnit = auto.unit === 'client';
  const unit = isClientUnit ? 'mijoz' : 'yuk';
  // The override is actively hiding a finished signal — the case worth flagging.
  const hidesCompletion = isManual && auto.status === 'available';
  // Steps 2-4 count parcels, step 5 counts clients — one flight therefore shows
  // two different denominators, which reads like an error until you know the
  // photo report is produced once per customer rather than once per box.
  const missing = Math.max(auto.total - auto.matched, 0);

  return (
    <div className="mt-1 space-y-0.5 text-[11px] font-semibold leading-tight">
      <p className="text-gray-500 dark:text-white/45">
        avtomatik: {auto.matched}/{auto.total} {unit} · {AUTO_STATUS_LABELS[auto.status]}
      </p>
      {isClientUnit && auto.total > 0 && (
        <p className="text-gray-400 dark:text-white/35">
          hisobot mijoz boshiga sanaladi, yuk boshiga emas
          {missing > 0 ? ` — ${missing} ta mijozga hali yuborilmagan` : ''}
        </p>
      )}
      {hidesCompletion && (
        <p className="text-amber-600 dark:text-amber-300">avtomatika tayyor deydi — qo'lda qiymat ustun turibdi</p>
      )}
    </div>
  );
}

export default function ImportPage() {
  const { t } = useTranslation();
  const [mainTab, setMainTab] = useState<MainTab>('import');

  // Import tab state
  const [activeDbTab, setActiveDbTab] = useState<DatabaseType>('china');
  const [flightName, setFlightName] = useState('');
  // Set once an import succeeds — reveals the notification sender for that flight.
  const [importedFlight, setImportedFlight] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string>('');

  // Tracking tab state
  const [flights, setFlights] = useState<FlightTrackingStatus[]>([]);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [savingFlight, setSavingFlight] = useState<string | null>(null);
  const [deletingFlight, setDeletingFlight] = useState<string | null>(null);
  // Keyed "<flight>:<step>" — only the one button being cleared should spin.
  const [clearingStep, setClearingStep] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingTrackingChanges>>({});
  const { confirm, ConfirmDialog } = useConfirm();

  const fetchFlights = useCallback(async () => {
    setLoadingFlights(true);
    try {
      const data = await getFlightTrackingStatuses();
      setFlights(data);
      setPendingChanges({});
    } catch (err) {
      console.error('Failed to fetch flights:', err);
    } finally {
      setLoadingFlights(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === 'tracking') {
      fetchFlights();
    }
  }, [mainTab, fetchFlights]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.xlsx')) {
      setSelectedFile(file);
    } else {
      setSubmitStatus('error');
      setSubmitMessage(t('import.messages.invalidFile'));
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.xlsx')) {
      setSelectedFile(file);
    } else {
      setSubmitStatus('error');
      setSubmitMessage(t('import.messages.invalidFile'));
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      setSubmitStatus('error');
      setSubmitMessage(t('import.messages.invalidFile'));
      return;
    }
    if (!flightName.trim()) {
      setSubmitStatus('error');
      setSubmitMessage(t('import.messages.flightRequired'));
      return;
    }
    setSubmitStatus('loading');
    setSubmitMessage(t('import.messages.loading'));
    try {
      const response = await importExcel(selectedFile, activeDbTab, flightName.trim());
      setSubmitStatus('success');
      setSubmitMessage(response.message || t('import.messages.success'));
      setSelectedFile(null);
      // Hand the operator straight to the notification step instead of closing
      // the app: telling clients their cargo moved is the point of the import,
      // and a 2-second auto-close made that impossible without reopening.
      setImportedFlight(flightName.trim());
    } catch (error: unknown) {
      console.error('Import error:', error);
      const errorMessage =
        (typeof error === 'object' && error !== null && 'message' in (error as object) && (error as { message?: string }).message) ||
        t('import.messages.error');
      setSubmitStatus('error');
      setSubmitMessage(errorMessage);
    }
  };

  const handleAnimationComplete = () => {
    setSubmitStatus('idle');
    setSubmitMessage('');
  };

  const handleDbTabChange = (tab: DatabaseType) => {
    setActiveDbTab(tab);
    setSelectedFile(null);
  };

  const updatePendingChange = (
    flightName: string,
    step: StepStatusKey,
    value: StepSelectValue,
  ) => {
    setPendingChanges((prev) => ({
      ...prev,
      [flightName]: {
        ...prev[flightName],
        [step]: value,
      },
    }));
  };

  const getBaseSelectValue = (
    flight: FlightTrackingStatus,
    step: TrackingStep,
  ): StepSelectValue => {
    return flight[step.manualKey] ? flight[step.statusKey] : 'auto';
  };

  const getDisplayStatus = (
    flight: FlightTrackingStatus,
    step: TrackingStep,
  ): StepSelectValue => {
    return (
      pendingChanges[flight.flight_name]?.[step.statusKey] ??
      getBaseSelectValue(flight, step)
    );
  };

  const hasChanges = (flight: FlightTrackingStatus) => {
    const changes = pendingChanges[flight.flight_name];
    if (!changes) return false;
    return TRACKING_STEPS.some(
      (step) =>
        changes[step.statusKey] !== undefined &&
        changes[step.statusKey] !== getBaseSelectValue(flight, step),
    );
  };

  const handleSaveFlight = async (flight: FlightTrackingStatus) => {
    const changes = pendingChanges[flight.flight_name];
    if (!changes || !hasChanges(flight)) return;

    setSavingFlight(flight.flight_name);
    try {
      const payload: UpdateTrackingRequest = {};
      const clearSteps: number[] = [];

      for (const step of TRACKING_STEPS) {
        const selected = changes[step.statusKey];
        if (selected === undefined || selected === getBaseSelectValue(flight, step)) {
          continue;
        }

        if (selected === 'auto') {
          if (flight[step.manualKey]) {
            clearSteps.push(step.number);
          }
          continue;
        }

        payload[step.statusKey] = selected;
      }

      for (const stepNumber of clearSteps) {
        await clearFlightTrackingStep(flight.flight_name, stepNumber);
      }

      if (Object.keys(payload).length > 0) {
        await updateFlightTrackingSteps(flight.flight_name, payload);
      }

      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[flight.flight_name];
        return next;
      });
      toast.success('Tracking statuslari saqlandi');
      await fetchFlights();
    } catch (err) {
      console.error('Failed to save flight tracking:', err);
      toast.error('Tracking statuslarini saqlab bo\'lmadi');
    } finally {
      setSavingFlight(null);
    }
  };

  /** Drop one override so the step follows the warehouse data again. */
  const handleClearOverride = async (flight: FlightTrackingStatus, stepNumber: number) => {
    const key = `${flight.flight_name}:${stepNumber}`;
    setClearingStep(key);
    try {
      const result = await clearFlightTrackingStep(flight.flight_name, stepNumber);
      toast.success(result.message);
      // Refetch rather than patch locally: dropping the override changes what
      // clients see, and that value is only known to the server.
      await fetchFlights();
    } catch (err) {
      console.error('Failed to clear tracking override:', err);
      toast.error("Avtomatikaga qaytarib bo'lmadi");
    } finally {
      setClearingStep(null);
    }
  };

  const handleDeleteFlight = async (flight: FlightTrackingStatus) => {
    const confirmed = await confirm({
      message: `"${flight.flight_name}" reysi cargo_items bazasidan o'chirilsinmi?`,
      description: "Bu reys bo'yicha import qilingan barcha track kodlar o'chiriladi. Amalni ortga qaytarib bo'lmaydi.",
      confirmLabel: "O'chirish",
      variant: 'danger',
    });
    if (!confirmed) return;

    setDeletingFlight(flight.flight_name);
    try {
      const result = await deleteFlightCargoItems(flight.flight_name);
      setFlights((prev) => prev.filter((item) => item.flight_name !== flight.flight_name));
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[flight.flight_name];
        return next;
      });
      toast.success(`${result.deleted_count} ta cargo_items qatori o'chirildi`);
    } catch (err) {
      console.error('Failed to delete flight cargo items:', err);
      toast.error("Reysni o'chirishda xatolik yuz berdi");
    } finally {
      setDeletingFlight(null);
    }
  };

  return (
    <>
      <ConfirmDialog />
      {submitStatus !== 'idle' && (
        <StatusAnimation status={submitStatus} message={submitMessage} onComplete={handleAnimationComplete} />
      )}

      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="relative overflow-hidden rounded-2xl border border-orange-100 bg-white/95 p-6 shadow-2xl backdrop-blur-md sm:p-8 lg:p-10 dark:border-white/10 dark:bg-[#0f172a]/95 dark:shadow-black/40">
          {/* Decorative blur effects */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-orange-300/20 rounded-full blur-3xl -z-10 animate-pulse" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-amber-300/20 rounded-full blur-3xl -z-10 animate-pulse animation-delay-2000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-orange-200/10 rounded-full blur-3xl -z-10 animate-pulse animation-delay-4000" />

          {/* Header */}
          <div className="text-center mb-8 relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full mb-4 shadow-lg">
              <Database className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent mb-2">
              {t('import.title')}
            </h1>
          </div>

          {/* Main Tabs */}
          <div className="flex gap-3 mb-8 relative z-10">
            <button
              type="button"
              onClick={() => setMainTab('import')}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
                mainTab === 'import'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg transform scale-[1.02]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15'
              }`}
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => setMainTab('tracking')}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                mainTab === 'tracking'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg transform scale-[1.02]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15'
              }`}
            >
              <Plane className="w-4 h-4" />
              Reyslarni boshqarish
            </button>
          </div>

          {/* Import Tab Content */}
          {mainTab === 'import' && (
            <>
              <div className="flex gap-4 mb-8 relative z-10">
                <button
                  type="button"
                  onClick={() => handleDbTabChange('uz')}
                  className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                    activeDbTab === 'uz'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg transform scale-[1.02]'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15'
                  }`}
                >
                  {t('import.uzDatabase')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDbTabChange('china')}
                  className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                    activeDbTab === 'china'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg transform scale-[1.02]'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15'
                  }`}
                >
                  {t('import.chinaDatabase')}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                {/* Flight name — stamped on every imported row (sheet names ignored). */}
                <div className="space-y-2">
                  <label htmlFor="import-flight-name" className="block text-sm font-semibold text-gray-700 dark:text-white/80">
                    {t('import.flightNameLabel')}
                    <span className="text-orange-500"> *</span>
                  </label>
                  <input
                    id="import-flight-name"
                    type="text"
                    value={flightName}
                    onChange={(e) => setFlightName(e.target.value)}
                    placeholder={t('import.flightNamePlaceholder')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-400 dark:border-white/10 dark:bg-[#111827] dark:text-white dark:placeholder:text-white/30"
                    autoComplete="off"
                  />
                </div>

                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`group relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 backdrop-blur-sm ${
                    isDragging
                      ? 'border-orange-500 bg-orange-50/50 scale-[1.02] shadow-lg dark:bg-orange-500/10'
                      : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50/30 dark:border-white/15 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center text-center pointer-events-none relative z-0">
                    <div className={`mb-4 transition-transform duration-300 ${isDragging ? 'scale-110' : 'group-hover:scale-110'}`}>
                      {selectedFile ? (
                        <div className="relative">
                          <FileSpreadsheet className="w-16 h-16 text-green-500" />
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <Upload className="w-16 h-16 text-orange-500" />
                      )}
                    </div>
                    {selectedFile ? (
                      <>
                        <p className="mb-1 text-lg font-semibold text-gray-800 dark:text-white">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500 dark:text-white/45">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                      </>
                    ) : (
                      <>
                        <p className="mb-2 text-lg font-semibold text-gray-800 dark:text-white">{t('import.dragDropFile')}</p>
                        <p className="text-sm text-gray-500 dark:text-white/45">{t('import.selectFilePlaceholder')}</p>
                      </>
                    )}
                  </div>
                  <div className="absolute top-2 left-2 w-24 h-24 bg-orange-400/10 rounded-full blur-2xl -z-10" />
                  <div className="absolute bottom-2 right-2 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl -z-10" />
                </div>

                <Button
                  type="submit"
                  disabled={!selectedFile || !flightName.trim() || submitStatus === 'loading'}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {t('import.submit')}
                </Button>
              </form>

              {/* Always available, not only straight after an import: an
                  operator routinely uploads a manifest, checks it, and sends
                  the notification later — or re-sends for an older flight.
                  Gating this on `importedFlight` meant re-importing a file just
                  to reach the button. A fresh import still pre-fills the name. */}
              <div className="relative z-10 mt-6">
                <CampaignSender defaultFlight={importedFlight ?? ''} key={importedFlight ?? 'manual'} />
              </div>
            </>
          )}

          {/* Tracking Tab Content */}
          {mainTab === 'tracking' && (
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Oxirgi 20 ta reys</h2>
                <button
                  type="button"
                  onClick={fetchFlights}
                  disabled={loadingFlights}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingFlights ? 'animate-spin' : ''}`} />
                  Yangilash
                </button>
              </div>

              {loadingFlights && flights.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-white/45">Yuklanmoqda...</div>
              ) : flights.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-white/45">Reyslar topilmadi</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700 font-semibold dark:bg-white/5 dark:text-white/70">
                      <tr>
                        <th className="px-4 py-3 text-left">Reys nomi</th>
                        {TRACKING_STEPS.map((step) => (
                          <th key={step.number} className="px-4 py-3 text-center">
                            {step.title}
                          </th>
                        ))}
                        {/* Read-only: step 5 follows the report rows and has no
                            override, but it is what operations chase once a
                            flight has landed. */}
                        <th className="px-4 py-3 text-center">5-step (Hisobot)</th>
                        <th className="px-4 py-3 text-center">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                      {flights.map((flight) => {
                        const changed = hasChanges(flight);
                        return (
                          <tr key={flight.flight_name} className="transition-colors hover:bg-orange-50/30 dark:hover:bg-white/[0.04]">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                              <div className="flex items-center gap-2">
                                <Plane className="w-4 h-4 text-orange-500" />
                                {flight.flight_name}
                              </div>
                              <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-white/45">
                                {flight.total_parcels} yuk · {flight.total_clients} mijoz
                              </p>
                            </td>
                            {TRACKING_STEPS.map((step) => {
                              const displayed = getDisplayStatus(flight, step);
                              const isManual = flight[step.manualKey] && displayed !== 'auto';
                              const clearKey = `${flight.flight_name}:${step.number}`;
                              return (
                                <td key={step.number} className="px-4 py-3 text-center align-top">
                                  <select
                                    value={displayed}
                                    onChange={(e) =>
                                      updatePendingChange(
                                        flight.flight_name,
                                        step.statusKey,
                                        e.target.value as StepSelectValue,
                                      )
                                    }
                                    className={`px-2 py-1 rounded-md border text-xs font-medium outline-none focus:ring-2 focus:ring-orange-500/20 dark:[color-scheme:dark] ${
                                      displayed === 'auto'
                                        ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/15 dark:border-sky-400/30 dark:text-sky-200'
                                        : displayed === 'available'
                                        ? 'bg-green-50 border-green-200 text-green-700 dark:bg-emerald-500/15 dark:border-emerald-400/30 dark:text-emerald-200'
                                        : displayed === 'pending'
                                        ? 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-amber-400/15 dark:border-amber-300/30 dark:text-amber-200'
                                        : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-white/10 dark:border-white/15 dark:text-white/70'
                                    }`}
                                  >
                                    {STEP_OPTIONS.map((opt) => (
                                      <option key={opt.value} className={NATIVE_OPTION_CLASS} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>

                                  {isManual && (
                                    <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                      qo'lda
                                    </span>
                                  )}

                                  <AutoSignalHint auto={flight[step.autoKey]} isManual={isManual} />

                                  {isManual && (
                                    <button
                                      type="button"
                                      onClick={() => handleClearOverride(flight, step.number)}
                                      disabled={clearingStep === clearKey || savingFlight === flight.flight_name}
                                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 underline-offset-2 hover:underline disabled:opacity-50"
                                      title="Qo'lda qo'yilgan qiymatni olib tashlash"
                                    >
                                      <RotateCcw className={`w-3 h-3 ${clearingStep === clearKey ? 'animate-spin' : ''}`} />
                                      Avtomatikaga
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-center align-top">
                              {flight.step_5_auto ? (
                                <AutoSignalHint auto={flight.step_5_auto} isManual={false} />
                              ) : (
                                <span className="text-[11px] font-semibold text-gray-400 dark:text-white/35">
                                  ma'lumot yo'q
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveFlight(flight)}
                                disabled={!changed || savingFlight === flight.flight_name}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                  changed
                                    ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-white/10 dark:text-white/30'
                                }`}
                              >
                                {savingFlight === flight.flight_name ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : changed ? (
                                  <Save className="w-3 h-3" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                {savingFlight === flight.flight_name ? 'Saqlanmoqda...' : changed ? 'Saqlash' : 'Saqlangan'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteFlight(flight)}
                                disabled={deletingFlight === flight.flight_name || savingFlight === flight.flight_name}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                title="cargo_items dan o'chirish"
                              >
                                {deletingFlight === flight.flight_name ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                                {deletingFlight === flight.flight_name ? "O'chirilmoqda..." : "O'chirish"}
                              </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
