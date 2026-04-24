import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldOff, Plane, Plus } from 'lucide-react';

import { getAdminJwtClaims } from '@/api/services/adminManagement';
import {
  getFlightList,
  getClientSummaryByFlight,
  deleteExpectedCargo,
  renameClientCode,
  exportExpectedCargoExcel,
  createEmptyFlight,
  type ClientSummaryItem,
  type DeleteExpectedCargoResponse,
} from '@/api/services/expectedCargo';
import { useExpectedCargoStore } from '@/store/expectedCargoStore';

import { FlightBottomTabs } from '@/components/expectedCargo/FlightBottomTabs';
import { ExpectedCargoHeader } from '@/components/expectedCargo/ExpectedCargoHeader';
import { VirtualizedClientList } from '@/components/expectedCargo/VirtualizedClientList';
import { FastEntryPanel } from '@/components/expectedCargo/FastEntryPanel';
import { BulkSaveFAB } from '@/components/expectedCargo/BulkSaveFAB';
import { RenameFlightModal } from '@/components/expectedCargo/RenameFlightModal';
import { DeleteConfirmModal } from '@/components/expectedCargo/DeleteConfirmModal';
import { ReplaceTrackCodesModal } from '@/components/expectedCargo/ReplaceTrackCodesModal';
import { NotificationPanel } from '@/components/expectedCargo/NotificationPanel';

interface ExpectedCargoPageProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

interface DeleteTarget {
  type: 'client';
  flightName: string;
  clientCode: string;
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-zinc-500 dark:text-zinc-400 px-6 text-center">
      <ShieldOff className="size-14 opacity-40" />
      <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
        Kirish taqiqlangan
      </h2>
      <p className="text-sm">
        Ushbu sahifani ko'rish uchun{' '}
        <span className="font-mono text-orange-500">expected_cargo:manage</span> huquqi
        talab qilinadi.
      </p>
    </div>
  );
}

export default function ExpectedCargoPage({ onNavigate }: ExpectedCargoPageProps) {
  const jwtClaims = useMemo(() => getAdminJwtClaims(), []);
  const hasAccess =
    jwtClaims.isSuperAdmin || jwtClaims.permissions.has('expected_cargo:manage');

  if (!hasAccess) return <AccessDenied />;

  return <ExpectedCargoPageContent onNavigate={onNavigate} />;
}

// Separate inner component so hooks are only called when the user has access.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ExpectedCargoPageContent({ onNavigate: _onNavigate }: { onNavigate: (page: string) => void }) {
  const queryClient = useQueryClient();

  // ── Store state ─────────────────────────────────────────────────────────────
  const {
    activeFlightName,
    expandedClientCode,
    isEditMode,
    isFastEntryOpen,
    isClientListHidden,
    searchQuery,
    flightTabOrder,
    entryQueue,
    setActiveFlight,
    setExpandedClient,
    toggleEditMode,
    setSearchQuery,
    setFastEntryOpen,
    syncFlightTabOrder,
    setFlightTabOrder,
  } = useExpectedCargoStore();

  // ── Modal / dialog state ────────────────────────────────────────────────────
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteFlightTarget, setDeleteFlightTarget] = useState<string | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<{
    flightName: string;
    clientCode: string;
  } | null>(null);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const flightsQuery = useQuery({
    queryKey: ['expectedCargo', 'flights'],
    queryFn: getFlightList,
    staleTime: 60_000,
  });

  const summaryQuery = useQuery({
    queryKey: ['expectedCargo', 'summary', activeFlightName],
    queryFn: () => getClientSummaryByFlight(activeFlightName!, 1, 200),
    enabled: !!activeFlightName,
    staleTime: 30_000,
  });

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Sync tab order whenever the flights list changes
  useEffect(() => {
    if (flightsQuery.data?.items) {
      const names = flightsQuery.data.items.map((f) => f.flight_name);
      syncFlightTabOrder(names);

      // Auto-select the first flight if none is selected yet
      if (!activeFlightName && names.length > 0) {
        setActiveFlight(names[0]);
      }
    }
  }, [flightsQuery.data, syncFlightTabOrder, activeFlightName, setActiveFlight]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const filteredSummaryItems = useMemo(() => {
    const items: ClientSummaryItem[] = summaryQuery.data?.items ?? [];
    if (!searchQuery.trim()) return items;
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => item.client_code.toLowerCase().includes(q));
  }, [summaryQuery.data?.items, searchQuery]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  /** Deletes every record belonging to a specific flight. */
  const deleteFlightMutation = useMutation({
    mutationFn: async (flightName: string): Promise<DeleteExpectedCargoResponse> => {
      try {
        return await deleteExpectedCargo({ flight_name: flightName });
      } catch (err: unknown) {
        // 404 means the flight existed only in local UI state (never saved to DB).
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) return { deleted_count: 0 };
        throw err;
      }
    },
    onSuccess: (_data, flightName) => {
      toast.success(`"${flightName}" reysi o'chirildi`);
      setDeleteFlightTarget(null);
      setFlightTabOrder(flightTabOrder.filter((n) => n !== flightName));
      if (activeFlightName === flightName) setActiveFlight(null);
      queryClient.invalidateQueries({ queryKey: ['expectedCargo', 'flights'] });
      // Remove stale per-flight caches so deleted data never resurfaces on re-select.
      queryClient.removeQueries({ queryKey: ['expectedCargo', 'summary', flightName] });
      queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === 'expectedCargo' &&
          query.queryKey[1] === 'trackCodes' &&
          query.queryKey[2] === flightName,
      });
    },
    onError: () => {
      toast.error("Reysni o'chirishda xatolik yuz berdi");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (target: DeleteTarget) =>
      deleteExpectedCargo({
        flight_name: target.flightName,
        client_code: target.clientCode,
      }),
    onSuccess: (data) => {
      toast.success(`${data.deleted_count} ta trek kodi o'chirildi`);
      setDeleteTarget(null);
      queryClient.invalidateQueries({
        queryKey: ['expectedCargo', 'summary', activeFlightName],
      });
      queryClient.invalidateQueries({ queryKey: ['expectedCargo', 'flights'] });
    },
    onError: () => {
      toast.error("O'chirishda xatolik yuz berdi");
    },
  });

  const renameClientMutation = useMutation({
    mutationFn: (payload: { old_client_code: string; new_client_code: string; flight_name?: string }) =>
      renameClientCode(payload),
    onSuccess: (data) => {
      toast.success(`${data.updated_count} ta yozuv yangilandi`);
      queryClient.invalidateQueries({
        queryKey: ['expectedCargo', 'summary', activeFlightName],
      });
      queryClient.invalidateQueries({ queryKey: ['expectedCargo', 'flights'] });
    },
    onError: () => {
      toast.error("Mijoz kodini o'zgartirishda xatolik yuz berdi");
    },
  });

  const createEmptyFlightMutation = useMutation({
    mutationFn: (flightName: string) =>
      createEmptyFlight({ flight_name: flightName }),
    onSuccess: (data) => {
      setActiveFlight(data.flight_name);
      queryClient.invalidateQueries({ queryKey: ['expectedCargo', 'flights'] });
      if (data.created) {
        toast.success(`"${data.flight_name}" reysi qo'shildi`);
      } else {
        toast.info(`"${data.flight_name}" reysi allaqachon mavjud`);
      }
    },
    onError: () => {
      toast.error("Reys qo'shishda xatolik yuz berdi");
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleExport = () => {
    exportExpectedCargoExcel(activeFlightName ?? undefined).catch((err: Error) =>
      toast.error(err?.message ?? 'Eksport qilishda xatolik yuz berdi'),
    );
  };

  const handleExportAll = () => {
    exportExpectedCargoExcel(undefined).catch((err: Error) =>
      toast.error(err?.message ?? 'Eksport qilishda xatolik yuz berdi'),
    );
  };

  const handleDeleteClient = (clientCode: string) => {
    if (!activeFlightName) return;
    setDeleteTarget({ type: 'client', flightName: activeFlightName, clientCode });
  };

  const handleRenameClient = (clientCode: string) => {
    const newCode = window.prompt(`"${clientCode}" uchun yangi mijoz kodini kiriting:`);
    if (newCode && newCode.trim() !== '' && newCode !== clientCode) {
      renameClientMutation.mutate({
        old_client_code: clientCode,
        new_client_code: newCode.trim(),
        flight_name: activeFlightName || undefined,
      });
    }
  };

  const handleRequestReplace = (clientCode: string) => {
    if (!activeFlightName) return;
    setReplaceTarget({ flightName: activeFlightName, clientCode });
  };

  const handleAddFlight = useCallback(() => {
    const name = prompt("Yangi reys nomini kiriting:");
    if (name && name.trim()) {
      const clean = name.trim().toUpperCase();
      createEmptyFlightMutation.mutate(clean);
    }
  }, [createEmptyFlightMutation]);

  /** Navigate to a specific client from the notification panel. */
  const handleNavigateToClient = useCallback((flightName: string, clientCode: string) => {
    // Switch to the relevant flight if needed.
    if (flightName && flightName !== activeFlightName) {
      setActiveFlight(flightName);
    }
    // Highlight the client in the list.
    setSearchQuery(clientCode);
    setExpandedClient(clientCode);
  }, [activeFlightName, setActiveFlight, setSearchQuery, setExpandedClient]);

  const handleBack = () => window.history.back();

  const hasNoFlights =
    !flightsQuery.isLoading && flightTabOrder.length === 0 &&
    (flightsQuery.data?.items ?? []).length === 0;

  // Header heights: title row + search row = ~116px; + edit banner = ~148px
  const headerHeight = isEditMode ? 148 : 116;
  const bottomTabsHeight = 64;

  return (
    <div className="min-h-screen bg-white dark:bg-[#000] flex flex-col">
      {/* ── Fixed header ────────────────────────────────────────────────────── */}
      <ExpectedCargoHeader
        activeFlightName={activeFlightName}
        searchQuery={searchQuery}
        isEditMode={isEditMode}
        isFastEntryOpen={isFastEntryOpen}
        queueCount={entryQueue.length}
        onSearchChange={setSearchQuery}
        onToggleEditMode={toggleEditMode}
        onToggleFastEntry={() => setFastEntryOpen(!isFastEntryOpen)}
        onExport={handleExport}
        onExportAll={handleExportAll}
        onDeleteFlight={() => activeFlightName && setDeleteFlightTarget(activeFlightName)}
        onBack={handleBack}
        onOpenNotifications={() => setIsNotificationPanelOpen(true)}
      />

      {/* ── Main scrollable content ─────────────────────────────────────────── */}
      <div
        className="flex flex-col bg-white dark:bg-[#070F2B]"
        style={{
          marginTop: headerHeight,
          marginBottom: bottomTabsHeight,
          // Use exact height so flex children can fill it properly
          height: `calc(100dvh - ${headerHeight}px - ${bottomTabsHeight}px)`,
        }}
      >
        {/* Fast entry panel — when client list is hidden it fills the remaining space */}
        {isFastEntryOpen && (
          <FastEntryPanel
            flightName={activeFlightName}
            onClose={() => setFastEntryOpen(false)}
            isQueueExpanded={isClientListHidden}
          />
        )}

        {/* Client summary list — hidden when the user toggled it off */}
        <div
          className="flex-1"
          style={{
            // Height zero when hidden so it takes no space; flex-1 fills otherwise
            height: isClientListHidden
              ? 0
              : `calc(100dvh - ${headerHeight}px - ${bottomTabsHeight}px${isFastEntryOpen ? ' - 240px' : ''})`,
            overflow: 'hidden',
            display: isClientListHidden ? 'none' : undefined,
          }}
        >
          {!activeFlightName ? (
            hasNoFlights ? (
              <div className="flex flex-col items-center justify-center h-full gap-5 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-500/[0.08] border border-orange-100 dark:border-orange-500/15 flex items-center justify-center">
                  <Plane className="w-8 h-8 text-orange-400 dark:text-orange-500" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Hozircha reyslar yo'q
                  </p>
                  <p className="text-[13px] text-zinc-400 dark:text-zinc-500 max-w-xs">
                    Yuk kodlarini kiritishni boshlash uchun birinchi reysni qo'shing
                  </p>
                </div>
                <button
                  onClick={handleAddFlight}
                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-[13px] font-bold rounded-xl transition-all shadow-sm shadow-orange-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Reys qo'shish
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-500 text-sm px-6 text-center">
                Pastdagi tabdan reys tanlang
              </div>
            )
          ) : (
            <VirtualizedClientList
              items={filteredSummaryItems}
              isLoading={summaryQuery.isLoading}
              flightName={activeFlightName}
              expandedClientCode={expandedClientCode}
              isEditMode={isEditMode}
              onToggleExpand={setExpandedClient}
              onDeleteClient={handleDeleteClient}
              onRenameClient={handleRenameClient}
              onRequestReplace={handleRequestReplace}
            />
          )}
        </div>
      </div>

      {/* ── Floating action button (save queue) ─────────────────────────────── */}
      <BulkSaveFAB flightName={activeFlightName} />

      {/* ── Fixed bottom flight tabs ─────────────────────────────────────────── */}
      <FlightBottomTabs
        flights={flightsQuery.data?.items ?? []}
        orderedFlightNames={flightTabOrder}
        activeFlightName={activeFlightName}
        onSelectFlight={setActiveFlight}
        onLongPressTab={setRenameTarget}
        onReorder={setFlightTabOrder}
        onAddFlight={handleAddFlight}
      />

      {/* ── Notification panel (slide-in) ────────────────────────────────────── */}
      <NotificationPanel
        isOpen={isNotificationPanelOpen}
        onClose={() => setIsNotificationPanelOpen(false)}
        onNavigateToClient={handleNavigateToClient}
      />

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <RenameFlightModal
        flightName={renameTarget}
        isOpen={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
      />

      <DeleteConfirmModal
        isOpen={deleteTarget !== null}
        isPending={deleteMutation.isPending}
        description={
          deleteTarget
            ? `"${deleteTarget.clientCode}" mijozining "${deleteTarget.flightName}" reysdagi barcha trek kodlari o'chiriladi.`
            : ''
        }
        warning="Bu amalni qaytarib bo'lmaydi."
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      <DeleteConfirmModal
        isOpen={deleteFlightTarget !== null}
        isPending={deleteFlightMutation.isPending}
        description={
          deleteFlightTarget
            ? `"${deleteFlightTarget}" reysidagi barcha mijozlar va trek kodlari o'chiriladi.`
            : ''
        }
        warning="Bu amalni qaytarib bo'lmaydi. Reys butunlay o'chib ketadi."
        onConfirm={() => deleteFlightTarget && deleteFlightMutation.mutate(deleteFlightTarget)}
        onCancel={() => setDeleteFlightTarget(null)}
      />

      {replaceTarget && (
        <ReplaceTrackCodesModal
          key={`${replaceTarget.flightName}::${replaceTarget.clientCode}`}
          flightName={replaceTarget.flightName}
          clientCode={replaceTarget.clientCode}
          isOpen={replaceTarget !== null}
          onClose={() => {
            const prev = replaceTarget;
            setReplaceTarget(null);
            queryClient.invalidateQueries({
              queryKey: ['expectedCargo', 'trackCodes', prev.flightName, prev.clientCode],
            });
            queryClient.invalidateQueries({
              queryKey: ['expectedCargo', 'summary', prev.flightName],
            });
          }}
        />
      )}
    </div>
  );
}
