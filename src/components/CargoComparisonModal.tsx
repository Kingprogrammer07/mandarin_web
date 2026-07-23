import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  compareCargoManifests,
  exportCargoComparisonExcel,
  getCargoCompareOptions,
  type CargoCompareClientMismatchRow,
  type CargoCompareItemRow,
  type CargoCompareOptionsResponse,
  type CargoCompareRequest,
  type CargoCompareResponse,
} from '@/api/services/expectedCargo';

const PAGE_SIZE = 50;

type ActiveTab = 'tracks' | 'clients';

interface CargoComparisonModalProps {
  open: boolean;
  currentFlightName: string;
  onClose: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as { message?: string; data?: { detail?: unknown } } | null;
  const detail = candidate?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (candidate?.message) return candidate.message;
  return fallback;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function display(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function buildPayload(
  expectedFlightName: string,
  selectedCargoFlights: string[],
  currentFlightName: string,
): CargoCompareRequest {
  return {
    expected_flight_name: expectedFlightName,
    cargo_item_flight_names: selectedCargoFlights,
    flight_cargo_flight_name: currentFlightName,
  };
}

function SummaryTile({
  label,
  value,
  tone = 'gray',
}: {
  label: string;
  value: number;
  tone?: 'gray' | 'orange' | 'blue' | 'red';
}) {
  const cls = {
    gray: 'border-gray-200 bg-white text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200',
    orange: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300',
    red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <p className="text-[11px] font-semibold opacity-70">{label}</p>
      <p className="mt-0.5 text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}

function Pagination({
  page,
  total,
  onPageChange,
}: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 dark:border-white/10">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="h-9 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-600 disabled:opacity-40 dark:border-white/10 dark:text-gray-300"
      >
        Oldingi
      </button>
      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="h-9 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-600 disabled:opacity-40 dark:border-white/10 dark:text-gray-300"
      >
        Keyingi
      </button>
    </div>
  );
}

function CargoItemCells({ row }: { row: CargoCompareItemRow }) {
  return (
    <>
      <td className="px-3 py-2 font-mono text-xs">{display(row.client_code)}</td>
      <td className="px-3 py-2 font-semibold">{display(row.flight_name)}</td>
      <td className="px-3 py-2 font-mono text-xs">{display(row.track_code)}</td>
      <td className="px-3 py-2 font-mono text-xs">{display(row.track_code_2)}</td>
      <td className="px-3 py-2">{display(row.item_name_ru || row.item_name_cn)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{display(row.quantity)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{display(row.weight_kg)}</td>
      <td className="px-3 py-2 font-semibold">{display(row.box_number)}</td>
      <td className="px-3 py-2">{formatDate(row.created_at)}</td>
    </>
  );
}

function TrackTable({ rows, page }: { rows: CargoCompareItemRow[]; page: number }) {
  const visibleRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (rows.length === 0) {
    return (
      <div className="flex min-h-52 items-center justify-center text-sm font-semibold text-gray-400">
        Track kod farqi topilmadi.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1100px] w-full text-left text-sm">
        <thead className="bg-gray-100 text-xs uppercase text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Mijoz</th>
            <th className="px-3 py-2">Cargo reysi</th>
            <th className="px-3 py-2">Track</th>
            <th className="px-3 py-2">Track 2</th>
            <th className="px-3 py-2">Mahsulot</th>
            <th className="px-3 py-2 text-right">Soni</th>
            <th className="px-3 py-2 text-right">Kg</th>
            <th className="px-3 py-2">Box</th>
            <th className="px-3 py-2">Vaqt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {visibleRows.map((row, index) => (
            <tr key={`${row.cargo_item_id ?? 'missing'}-${index}`} className="bg-white dark:bg-transparent">
              <td className="px-3 py-2 text-xs font-bold text-gray-400">
                {(page - 1) * PAGE_SIZE + index + 1}
              </td>
              <CargoItemCells row={row} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientTable({
  rows,
  page,
}: {
  rows: CargoCompareClientMismatchRow[];
  page: number;
}) {
  const visibleRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (rows.length === 0) {
    return (
      <div className="flex min-h-52 items-center justify-center text-sm font-semibold text-gray-400">
        Mijoz kodi farqi topilmadi.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1180px] w-full text-left text-sm">
        <thead className="bg-gray-100 text-xs uppercase text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Mos emas mijoz</th>
            <th className="px-3 py-2">Photo reys</th>
            <th className="px-3 py-2">Cargo reysi</th>
            <th className="px-3 py-2">Track</th>
            <th className="px-3 py-2">Track 2</th>
            <th className="px-3 py-2">Mahsulot</th>
            <th className="px-3 py-2 text-right">Soni</th>
            <th className="px-3 py-2 text-right">Kg</th>
            <th className="px-3 py-2">Box</th>
            <th className="px-3 py-2">Vaqt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {visibleRows.map((row, index) => (
            <tr key={`${row.missing_client_code}-${row.cargo_item_id ?? index}`} className="bg-white dark:bg-transparent">
              <td className="px-3 py-2 text-xs font-bold text-gray-400">
                {(page - 1) * PAGE_SIZE + index + 1}
              </td>
              <td className="px-3 py-2 font-mono text-xs font-black text-red-600 dark:text-red-400">
                {row.missing_client_code}
              </td>
              <td className="px-3 py-2 font-semibold">{row.flight_cargo_flight_name}</td>
              <td className="px-3 py-2 font-semibold">{display(row.flight_name)}</td>
              <td className="px-3 py-2 font-mono text-xs">{display(row.track_code)}</td>
              <td className="px-3 py-2 font-mono text-xs">{display(row.track_code_2)}</td>
              <td className="px-3 py-2">{display(row.item_name_ru || row.item_name_cn)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{display(row.quantity)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{display(row.weight_kg)}</td>
              <td className="px-3 py-2 font-semibold">{display(row.box_number)}</td>
              <td className="px-3 py-2">{formatDate(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CargoComparisonModal({
  open,
  currentFlightName,
  onClose,
  onError,
  onSuccess,
}: CargoComparisonModalProps) {
  const [options, setOptions] = useState<CargoCompareOptionsResponse | null>(null);
  const [expectedFlightName, setExpectedFlightName] = useState('');
  const [selectedCargoFlights, setSelectedCargoFlights] = useState<string[]>([]);
  const [result, setResult] = useState<CargoCompareResponse | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('tracks');
  const [trackPage, setTrackPage] = useState(1);
  const [clientPage, setClientPage] = useState(1);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setResult(null);
    setErrorMessage(null);
    setLoadingOptions(true);
    setSelectedCargoFlights([]);
    setTrackPage(1);
    setClientPage(1);

    getCargoCompareOptions(currentFlightName)
      .then((data) => {
        if (cancelled) return;
        setOptions(data);
        const suggested =
          data.suggested_expected_flight_name
          || data.expected_flights.find(
            (item) => item.flight_name.toUpperCase() === currentFlightName.toUpperCase(),
          )?.flight_name
          || data.expected_flights[0]?.flight_name
          || currentFlightName;
        setExpectedFlightName(suggested);

        const matchingCargo = data.cargo_item_flights.find(
          (item) => item.flight_name.toUpperCase() === currentFlightName.toUpperCase(),
        );
        setSelectedCargoFlights(matchingCargo ? [matchingCargo.flight_name] : []);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = getErrorMessage(error, 'Solishtirish reyslarini yuklab bo\'lmadi.');
        setErrorMessage(message);
        onError(message);
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentFlightName, onError, open]);

  const selectedCargoSet = useMemo(
    () => new Set(selectedCargoFlights.map((item) => item.toUpperCase())),
    [selectedCargoFlights],
  );

  const toggleCargoFlight = useCallback((flightName: string) => {
    setSelectedCargoFlights((prev) => {
      const key = flightName.toUpperCase();
      if (prev.some((item) => item.toUpperCase() === key)) {
        return prev.filter((item) => item.toUpperCase() !== key);
      }
      return [...prev, flightName];
    });
  }, []);

  const payload = useMemo(
    () => buildPayload(expectedFlightName, selectedCargoFlights, currentFlightName),
    [currentFlightName, expectedFlightName, selectedCargoFlights],
  );

  const canCompare = expectedFlightName.trim().length > 0 && selectedCargoFlights.length > 0;

  const handleCompare = useCallback(async () => {
    if (!canCompare || comparing) return;
    setComparing(true);
    setErrorMessage(null);
    try {
      const data = await compareCargoManifests(payload);
      setResult(data);
      setActiveTab('tracks');
      setTrackPage(1);
      setClientPage(1);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Solishtirishda xatolik yuz berdi.');
      setErrorMessage(message);
      onError(message);
    } finally {
      setComparing(false);
    }
  }, [canCompare, comparing, onError, payload]);

  const handleExport = useCallback(async () => {
    if (!result || exporting) return;
    setExporting(true);
    try {
      await exportCargoComparisonExcel(result.filters);
      onSuccess('Solishtirish Excel fayli yuklab olindi.');
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Excel yuklab olishda xatolik yuz berdi.');
      onError(message);
    } finally {
      setExporting(false);
    }
  }, [exporting, onError, onSuccess, result]);

  if (!open) return null;

  const activeTotal =
    activeTab === 'tracks'
      ? result?.track_mismatches.length ?? 0
      : result?.client_mismatches.length ?? 0;
  const activePage = activeTab === 'tracks' ? trackPage : clientPage;
  const setActivePage = activeTab === 'tracks' ? setTrackPage : setClientPage;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-gray-50 text-gray-900 dark:bg-[#080604] dark:text-white">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#0d0a04]">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
            Solishtirish
          </p>
          <h2 className="truncate text-lg font-black">
            {result ? 'Solishtirish natijalari' : 'Reyslarni tanlang'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {!result ? (
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#0d0a04]">
            {loadingOptions ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                <p className="text-sm font-semibold">Reyslar yuklanmoqda...</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase text-gray-500 dark:text-gray-400">
                    Expected cargo reysi
                  </label>
                  <select
                    value={expectedFlightName}
                    onChange={(event) => setExpectedFlightName(event.target.value)}
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-white/10 dark:bg-white/5"
                  >
                    {options?.expected_flights.map((flight) => (
                      <option key={flight.flight_name} value={flight.flight_name}>
                        {flight.flight_name} - {flight.track_code_count} track
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400">
                      Cargo items reyslari
                    </label>
                    <span className="text-xs font-bold text-gray-400">
                      {selectedCargoFlights.length} tanlandi
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10">
                    {options?.cargo_item_flights.length ? (
                      options.cargo_item_flights.map((flight) => {
                        const checked = selectedCargoSet.has(flight.flight_name.toUpperCase());
                        return (
                          <button
                            key={flight.flight_name}
                            type="button"
                            onClick={() => toggleCargoFlight(flight.flight_name)}
                            className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-orange-50 dark:border-white/5 dark:hover:bg-orange-500/10"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black">{flight.flight_name}</p>
                              <p className="text-xs font-semibold text-gray-400">
                                {flight.cargo_item_count} cargo_items
                              </p>
                            </div>
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-lg border ${
                                checked
                                  ? 'border-orange-500 bg-orange-500 text-white'
                                  : 'border-gray-300 text-transparent dark:border-white/20'
                              }`}
                            >
                              <Check className="h-4 w-4" />
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="flex min-h-32 items-center justify-center text-sm font-semibold text-gray-400">
                        Cargo items reysi topilmadi.
                      </div>
                    )}
                  </div>
                </div>

                {errorMessage && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {errorMessage}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-600 dark:border-white/10 dark:text-gray-300"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="button"
                    disabled={!canCompare || comparing}
                    onClick={handleCompare}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-black text-white shadow-lg shadow-orange-500/20 disabled:opacity-50"
                  >
                    {comparing && <Loader2 className="h-4 w-4 animate-spin" />}
                    Tanladim
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#0d0a04]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 text-sm font-semibold text-gray-500 dark:text-gray-400">
                <span className="font-black text-gray-900 dark:text-white">
                  {result.filters.expected_flight_name}
                </span>
                <span className="mx-2">vs</span>
                <span>{result.filters.cargo_item_flight_names.join(', ')}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-bold text-gray-600 dark:border-white/10 dark:text-gray-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Qayta tanlash
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-50"
                >
                  {exporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Excel yuklash
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <SummaryTile label="Expected track" value={result.summary.expected_track_count} />
              <SummaryTile label="Cargo track" value={result.summary.cargo_item_track_count} />
              <SummaryTile label="Track farqi" value={result.summary.track_mismatch_count} tone="red" />
              <SummaryTile label="Mijoz farqi" value={result.summary.client_mismatch_count} tone="orange" />
            </div>
          </div>

          <div className="flex border-b border-gray-200 bg-white px-4 dark:border-white/10 dark:bg-[#0d0a04]">
            <button
              type="button"
              onClick={() => setActiveTab('tracks')}
              className={`h-12 border-b-2 px-4 text-sm font-black ${
                activeTab === 'tracks'
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-gray-400'
              }`}
            >
              Track kodlar ({result.track_mismatches.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('clients')}
              className={`h-12 border-b-2 px-4 text-sm font-black ${
                activeTab === 'clients'
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-gray-400'
              }`}
            >
              Mijoz kodlar ({result.client_mismatches.length})
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-white dark:bg-[#0d0a04]">
            {activeTab === 'tracks' ? (
              <TrackTable rows={result.track_mismatches} page={trackPage} />
            ) : (
              <ClientTable rows={result.client_mismatches} page={clientPage} />
            )}
          </div>
          <Pagination page={activePage} total={activeTotal} onPageChange={setActivePage} />
        </div>
      )}
    </div>
  );
}
