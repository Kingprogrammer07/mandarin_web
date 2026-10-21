import { useId, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { toast } from "sonner";

import {
  astatkaBagQueryKey,
  astatkaPackagePhotosQueryKey,
  astatkaPackagesQueryKey,
  astatkaStatsQueryKey,
  getAstatkaPackagePhotos,
  replaceAstatkaPackagePhotos,
  type AstatkaPackage,
} from "@/api/services/astatkaFlights";
import { MAX_OWN_PHOTOS as MAX_PHOTOS } from "@/lib/astatkaPendingPhotos";
import { apiErrorMessage } from "@/utils/apiError";

import { CameraCapture } from "./CameraCapture";
import { PhotoCarousel } from "./PhotoCarousel";

/** What the open camera is for: every photo anew, or one at `replaceIndex`. */
type CameraJob = { kind: "all" } | { kind: "one"; replaceIndex: number };

interface Props {
  flightName: string;
  packageId: number;
  isOnline: boolean;
  /** The bag as the server holds it after a retake (its photo count changed). */
  onPackageChanged?: (pkg: AstatkaPackage) => void;
}

const heading =
  "text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3";

const outlineButton =
  "flex min-h-11 items-center justify-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-3 py-1.5 text-center text-[13px] font-bold leading-tight text-mc-text active:scale-[0.97] disabled:opacity-60";

function Notice({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-mc-sm bg-mc-surface-2 px-3 py-3 text-[13px] font-semibold text-mc-text-2">
      {icon && <span className="mt-0.5 shrink-0 text-mc-text-3">{icon}</span>}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * Photos a worker retakes for a saved bag of ours at the shelf. They are kept
 * on the astatka's own record — the old flight's photo report stays as it
 * was — and the astatka's «Yuborish» sends them instead of the old flight's.
 */
export function BagOwnPhotos({
  flightName,
  packageId,
  isOnline,
  onPackageChanged,
}: Props) {
  const queryClient = useQueryClient();
  const headingId = useId();
  const [camera, setCamera] = useState<CameraJob | null>(null);

  const queryKey = astatkaPackagePhotosQueryKey(packageId);
  const queryFn = () => getAstatkaPackagePhotos(flightName, packageId);
  const photos = useQuery({
    queryKey,
    queryFn,
    enabled: isOnline,
    // The links expire after about an hour.
    staleTime: 20 * 60_000,
  });
  const count = photos.data?.length ?? 0;

  const save = useMutation({
    mutationFn: ({
      files,
      replaceIndex,
    }: {
      files: File[];
      replaceIndex?: number;
    }) => replaceAstatkaPackagePhotos(flightName, packageId, files, replaceIndex),
    onSuccess: (result, { replaceIndex }) => {
      toast.success(
        replaceIndex === undefined ? "Rasmlar saqlandi." : "Rasm saqlandi.",
      );
      queryClient.setQueryData(queryKey, result.photos);
      void queryClient.invalidateQueries({
        queryKey: astatkaBagQueryKey(flightName, { packageId }),
      });
      void queryClient.invalidateQueries({
        queryKey: astatkaPackagesQueryKey(flightName),
      });
      void queryClient.invalidateQueries({ queryKey: astatkaStatsQueryKey });
      onPackageChanged?.(result.package);
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Rasmni saqlab bo'lmadi.")),
  });

  const taken = (job: CameraJob, files: File[]) => {
    setCamera(null);
    if (files.length === 0) return;
    if (job.kind === "all") save.mutate({ files: files.slice(0, MAX_PHOTOS) });
    else save.mutate({ files: files.slice(0, 1), replaceIndex: job.replaceIndex });
  };

  /** `index` equal to the photo count adds a photo at the end. */
  const replaceOne = (index: number) => setCamera({ kind: "one", replaceIndex: index });

  let body: ReactNode;
  if (!isOnline) {
    body = (
      <Notice icon={<WifiOff className="h-4 w-4" />}>
        Rasmlar internet bilan ochiladi.
      </Notice>
    );
  } else if (photos.isPending) {
    body = (
      <div
        aria-busy="true"
        aria-label="Rasmlar yuklanmoqda"
        className="h-11 animate-pulse rounded-mc-sm bg-mc-surface-2"
      />
    );
  } else if (photos.isError) {
    body = (
      <div className="rounded-mc-md border border-mc-danger/30 bg-mc-danger-soft p-3">
        <p className="text-[13px] font-semibold text-mc-danger">
          {apiErrorMessage(photos.error, "Rasmlarni ochib bo'lmadi.")}
        </p>
        <button
          type="button"
          onClick={() => void photos.refetch()}
          disabled={photos.isFetching}
          className="mt-2 inline-flex h-11 items-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.97] disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" />
          Qayta urinish
        </button>
      </div>
    );
  } else {
    body = (
      <div className="space-y-2">
        {count === 0 ? (
          <Notice>
            Hali rasm olinmagan. Mijozga eski reysning rasmlari yuboriladi.
          </Notice>
        ) : (
          <PhotoCarousel
            photoCount={count}
            queryKey={queryKey}
            queryFn={queryFn}
            onReplace={replaceOne}
            busy={save.isPending}
          />
        )}
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
          <button
            type="button"
            onClick={() => setCamera({ kind: "all" })}
            disabled={save.isPending}
            className={outlineButton}
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {count === 0 ? "Rasm olish" : "Rasmlarni qayta olish"}
          </button>
          {count > 0 && count < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => replaceOne(count)}
              disabled={save.isPending}
              className={outlineButton}
            >
              <ImagePlus className="h-4 w-4" />
              Yana rasm qo'shish
            </button>
          )}
        </div>
      </div>
    );
  }

  let cameraWindow: ReactNode = null;
  if (camera?.kind === "all") {
    cameraWindow = (
      <CameraCapture
        mode="many"
        max={MAX_PHOTOS}
        title={count === 0 ? "Rasm olish" : "Rasmlarni qayta olish"}
        note={
          count > 0
            ? `«Tayyor» bosilganda eski ${count} ta rasm o'rniga shular saqlanadi.`
            : undefined
        }
        onDone={(files) => taken(camera, files)}
        onClose={() => setCamera(null)}
      />
    );
  } else if (camera?.kind === "one") {
    cameraWindow = (
      <CameraCapture
        mode="one"
        max={1}
        title={
          camera.replaceIndex >= count
            ? "Yana rasm qo'shish"
            : `${camera.replaceIndex + 1}-rasmni qayta olish`
        }
        onDone={(files) => taken(camera, files)}
        onClose={() => setCamera(null)}
      />
    );
  }

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div>
        <h3 id={headingId} className={heading}>
          Astatka rasmlari
        </h3>
        <p className="mt-0.5 text-[12px] font-medium text-mc-text-3">
          Faqat shu astatkada saqlanadi. Bor bo'lsa, mijozga eski reys rasmlari
          o'rniga shular yuboriladi.
        </p>
      </div>
      {body}
      {cameraWindow}
    </section>
  );
}
