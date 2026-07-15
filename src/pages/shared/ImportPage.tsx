import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileSpreadsheet, Database, RefreshCw, Plane, Save, CheckCircle2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import StatusAnimation from '@/components/StatusAnimation';
import { importExcel } from '@/api/services/import';
import {
  deleteFlightCargoItems,
  getFlightTrackingStatuses,
  updateFlightTrackingSteps,
  type FlightTrackingStatus,
  type UpdateTrackingRequest,
} from '@/api/services/tracking';
import { useConfirm } from '@/hooks/useConfirm';

type DatabaseType = 'uz' | 'china';
type MainTab = 'import' | 'tracking';

const STEP_OPTIONS = [
  { value: 'pending', label: 'Kutilmoqda' },
  { value: 'available', label: 'Mavjud' },
  { value: 'nodata', label: "Ma'lumot yo'q" },
];

export default function ImportPage() {
  const { t } = useTranslation();
  const [mainTab, setMainTab] = useState<MainTab>('import');

  // Import tab state
  const [activeDbTab, setActiveDbTab] = useState<DatabaseType>('china');
  const [flightName, setFlightName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string>('');

  // Tracking tab state
  const [flights, setFlights] = useState<FlightTrackingStatus[]>([]);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [savingFlight, setSavingFlight] = useState<string | null>(null);
  const [deletingFlight, setDeletingFlight] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<FlightTrackingStatus>>>({});
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
      setTimeout(() => {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.close();
        }
      }, 2000);
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

  const updatePendingChange = (flightName: string, step: 'step_2_status' | 'step_3_status' | 'step_4_status', value: string) => {
    setPendingChanges((prev) => ({
      ...prev,
      [flightName]: {
        ...prev[flightName],
        [step]: value,
      },
    }));
  };

  const getDisplayStatus = (flight: FlightTrackingStatus, step: 'step_2_status' | 'step_3_status' | 'step_4_status') => {
    return pendingChanges[flight.flight_name]?.[step] ?? flight[step];
  };

  const hasChanges = (flight: FlightTrackingStatus) => {
    const changes = pendingChanges[flight.flight_name];
    if (!changes) return false;
    return (
      (changes.step_2_status !== undefined && changes.step_2_status !== flight.step_2_status) ||
      (changes.step_3_status !== undefined && changes.step_3_status !== flight.step_3_status) ||
      (changes.step_4_status !== undefined && changes.step_4_status !== flight.step_4_status)
    );
  };

  const handleSaveFlight = async (flight: FlightTrackingStatus) => {
    const changes = pendingChanges[flight.flight_name];
    if (!changes || !hasChanges(flight)) return;

    setSavingFlight(flight.flight_name);
    try {
      const payload: UpdateTrackingRequest = {};
      if (changes.step_2_status !== undefined) payload.step_2_status = changes.step_2_status;
      if (changes.step_3_status !== undefined) payload.step_3_status = changes.step_3_status;
      if (changes.step_4_status !== undefined) payload.step_4_status = changes.step_4_status;

      await updateFlightTrackingSteps(flight.flight_name, payload);
      setFlights((prev) =>
        prev.map((f) =>
          f.flight_name === flight.flight_name
            ? { ...f, ...changes }
            : f
        )
      );
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[flight.flight_name];
        return next;
      });
    } catch (err) {
      console.error('Failed to save flight tracking:', err);
    } finally {
      setSavingFlight(null);
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
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-10 border border-orange-100 relative overflow-hidden">
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
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t('import.chinaDatabase')}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                {/* Flight name — stamped on every imported row (sheet names ignored). */}
                <div className="space-y-2">
                  <label htmlFor="import-flight-name" className="block text-sm font-semibold text-gray-700">
                    {t('import.flightNameLabel')}
                    <span className="text-orange-500"> *</span>
                  </label>
                  <input
                    id="import-flight-name"
                    type="text"
                    value={flightName}
                    onChange={(e) => setFlightName(e.target.value)}
                    placeholder={t('import.flightNamePlaceholder')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-400"
                    autoComplete="off"
                  />
                </div>

                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`group relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 backdrop-blur-sm ${
                    isDragging
                      ? 'border-orange-500 bg-orange-50/50 scale-[1.02] shadow-lg'
                      : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50/30'
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
                        <p className="text-lg font-semibold text-gray-800 mb-1">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold text-gray-800 mb-2">{t('import.dragDropFile')}</p>
                        <p className="text-sm text-gray-500">{t('import.selectFilePlaceholder')}</p>
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
            </>
          )}

          {/* Tracking Tab Content */}
          {mainTab === 'tracking' && (
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Oxirgi 20 ta reys</h2>
                <button
                  type="button"
                  onClick={fetchFlights}
                  disabled={loadingFlights}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingFlights ? 'animate-spin' : ''}`} />
                  Yangilash
                </button>
              </div>

              {loadingFlights && flights.length === 0 ? (
                <div className="text-center py-12 text-gray-500">Yuklanmoqda...</div>
              ) : flights.length === 0 ? (
                <div className="text-center py-12 text-gray-500">Reyslar topilmadi</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700 font-semibold">
                      <tr>
                        <th className="px-4 py-3 text-left">Reys nomi</th>
                        <th className="px-4 py-3 text-center">2-step (Yo'lda)</th>
                        <th className="px-4 py-3 text-center">3-step (Bojxona)</th>
                        <th className="px-4 py-3 text-center">4-step (Saralash)</th>
                        <th className="px-4 py-3 text-center">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {flights.map((flight) => {
                        const changed = hasChanges(flight);
                        return (
                          <tr key={flight.flight_name} className="hover:bg-orange-50/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              <div className="flex items-center gap-2">
                                <Plane className="w-4 h-4 text-orange-500" />
                                {flight.flight_name}
                              </div>
                            </td>
                            {(['step_2_status', 'step_3_status', 'step_4_status'] as const).map((step) => (
                              <td key={step} className="px-4 py-3 text-center">
                                <select
                                  value={getDisplayStatus(flight, step)}
                                  onChange={(e) => updatePendingChange(flight.flight_name, step, e.target.value)}
                                  className={`px-2 py-1 rounded-md border text-xs font-medium outline-none focus:ring-2 focus:ring-orange-500/20 ${
                                    getDisplayStatus(flight, step) === 'available'
                                      ? 'bg-green-50 border-green-200 text-green-700'
                                      : getDisplayStatus(flight, step) === 'pending'
                                      ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                      : 'bg-gray-50 border-gray-200 text-gray-600'
                                  }`}
                                >
                                  {STEP_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            ))}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveFlight(flight)}
                                disabled={!changed || savingFlight === flight.flight_name}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                  changed
                                    ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
