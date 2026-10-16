import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  astatkaExternalPhotosRootKey,
  astatkaPackagesQueryKey,
  astatkaStatsQueryKey,
  downloadAstatkaExcel,
  getAstatkaFlightStats,
  type AstatkaPackageStatus,
} from "@/api/services/astatkaFlights";
import { AstatkaExtractDialog } from "@/components/astatka/AstatkaExtractDialog";
import { PackagesPreview } from "@/components/astatka/workspace/PackagesPreview";
import { WorkPanel } from "@/components/astatka/workspace/WorkPanel";
import {
  WorkspaceHeader,
  type WorkspaceCounts,
} from "@/components/astatka/workspace/WorkspaceHeader";
import { useAstatkaWorkQueue } from "@/hooks/useAstatkaWorkQueue";
import { useStoredFlag } from "@/hooks/useStoredFlag";
import { totalsOf } from "@/lib/astatkaPackages";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/utils/apiError";
import { downloadBlob, fileStamp, safeFileName } from "@/utils/downloadFile";

const DOWNLOAD_SUFFIX: Record<"all" | AstatkaPackageStatus, string> = {
  all: "hammasi",
  confirmed: "tasdiqlangan",
  expected: "kutilmoqda",
};

interface Props {
  flightName: string;
  onBack: () => void;
  /** Opens the client notification screen for this flight. */
  onSend: () => void;
}

/**
 * One astatka flight's window, laid out like the expected-cargo screen: a work
 * mode for scanning bags on the shelf and confirming them, and the saved list
 * beside it. Desktop first — two columns that scroll on their own — and on a
 * phone the same two parts stacked in one scroll.
 */
export function AstatkaWorkspacePage({ flightName, onBack, onSend }: Props) {
  const queryClient = useQueryClient();
  const [workMode, setWorkMode] = useStoredFlag("astatka-ws:work-mode", true);
  const [previewVisible, setPreviewVisible] = useStoredFlag("astatka-ws:preview", true);
  const [autoConfirm, setAutoConfirm] = useStoredFlag("astatka-ws:auto-confirm", false);
  const [editMode, setEditMode] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const refreshSaved = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: astatkaPackagesQueryKey(flightName) });
    void queryClient.invalidateQueries({ queryKey: astatkaStatsQueryKey });
    // A re-confirmed partner bag may get a new set of photo copies.
    void queryClient.invalidateQueries({ queryKey: astatkaExternalPhotosRootKey });
  }, [queryClient, flightName]);

  const queue = useAstatkaWorkQueue({
    flightName,
    autoConfirm,
    onPackagesChanged: refreshSaved,
  });

  const statsQuery = useQuery({
    queryKey: astatkaStatsQueryKey,
    queryFn: getAstatkaFlightStats,
    staleTime: 30_000,
    enabled: queue.isOnline,
  });

  const counts = useMemo<WorkspaceCounts | null>(() => {
    const key = flightName.trim().toUpperCase();
    const stats = statsQuery.data?.find(
      (item) => item.astatka_flight_name.trim().toUpperCase() === key,
    );
    if (stats) {
      return {
        expected: stats.expected,
        confirmed: stats.confirmed,
        expectedKg: stats.expected_weight_kg,
        confirmedKg: stats.confirmed_weight_kg,
      };
    }
    if (statsQuery.isSuccess) {
      return { expected: 0, confirmed: 0, expectedKg: 0, confirmedKg: 0 };
    }
    // Offline: the device copy is the best count there is.
    if (queue.index) {
      const totals = totalsOf(queue.index.packages);
      return {
        expected: totals.counts.expected,
        confirmed: totals.counts.confirmed,
        expectedKg: totals.weights.expected,
        confirmedKg: totals.weights.confirmed,
      };
    }
    return null;
  }, [flightName, statsQuery.data, statsQuery.isSuccess, queue.index]);

  const pendingCount = useMemo(
    () =>
      queue.rows.filter(
        (row) => row.state === "queued" || row.state === "saving" || row.state === "waiting_net",
      ).length,
    [queue.rows],
  );

  const download = async (status?: AstatkaPackageStatus) => {
    setIsDownloading(true);
    try {
      const blob = await downloadAstatkaExcel(flightName, status);
      downloadBlob(
        `astatka_${safeFileName(flightName)}_${DOWNLOAD_SUFFIX[status ?? "all"]}_${fileStamp()}.xlsx`,
        blob,
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, "Excel faylini olib bo'lmadi."));
    } finally {
      setIsDownloading(false);
    }
  };

  const showPreview = !workMode || previewVisible;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-mc-bg">
      <WorkspaceHeader
        flightName={flightName}
        counts={counts}
        workMode={workMode}
        onToggleWorkMode={() => setWorkMode((current) => !current)}
        pendingCount={pendingCount}
        editMode={editMode}
        onToggleEditMode={() => setEditMode((current) => !current)}
        onExtract={() => setExtractOpen(true)}
        onSend={onSend}
        onDownload={(status) => void download(status)}
        isDownloading={isDownloading}
        isOnline={queue.isOnline}
        onBack={onBack}
      />

      {/* One scroll on a phone; on a desktop each column scrolls on its own so
          the scan field never leaves the screen while the list is browsed. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:flex lg:overflow-hidden">
        {workMode && (
          <section
            aria-label="Ish rejimi"
            className={cn(
              "px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain",
              showPreview ? "lg:w-[58%] lg:shrink-0 lg:border-r lg:border-mc-border" : "lg:flex-1",
            )}
          >
            <div className={cn(!showPreview && "mx-auto max-w-[1400px]")}>
              <WorkPanel
                flightName={flightName}
                queue={queue}
                autoConfirm={autoConfirm}
                onAutoConfirmChange={setAutoConfirm}
                previewVisible={previewVisible}
                onTogglePreview={() => setPreviewVisible((current) => !current)}
              />
            </div>
          </section>
        )}

        {showPreview && (
          <section
            aria-labelledby="astatka-saved-title"
            className={cn(
              "px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain",
              workMode && "border-t border-mc-border lg:border-t-0",
            )}
          >
            <div className={cn(!workMode && "mx-auto max-w-[1400px]")}>
              <h2
                id="astatka-saved-title"
                className="mb-2 text-[15px] font-extrabold text-mc-text"
              >
                Saqlangan yuklar
              </h2>
              <PackagesPreview
                flightName={flightName}
                editMode={editMode}
                isOnline={queue.isOnline}
                offlineIndex={queue.index}
              />
            </div>
          </section>
        )}
      </div>

      <AstatkaExtractDialog
        flightName={flightName}
        open={extractOpen}
        onOpenChange={setExtractOpen}
        onSaved={() => {
          refreshSaved();
          // The new bags have to be in the device copy too, or a scan made
          // offline right after would not recognise them.
          void queue.syncIndex(true);
        }}
      />
    </div>
  );
}

export default AstatkaWorkspacePage;
