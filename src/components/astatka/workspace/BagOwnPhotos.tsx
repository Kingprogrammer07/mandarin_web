import { useId, useRef, type ChangeEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Images, Loader2, RefreshCw, WifiOff } from "lucide-react";
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
import { apiErrorMessage } from "@/utils/apiError";

import { PhotoCarousel } from "./PhotoCarousel";

/** Same ceiling the server enforces. */
const MAX_PHOTOS = 10;

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
  const allPhotosRef = useRef<HTMLInputElement>(null);
  const onePhotoRef = useRef<HTMLInputElement>(null);
  /** Which photo the single-file picker replaces; the count means "add". */
  const replaceIndexRef = useRef(0);

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

  const pickAll = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    if (files.length > MAX_PHOTOS) {
      toast.error(`Ko'pi bilan ${MAX_PHOTOS} ta rasm tanlang.`);
      return;
    }
    save.mutate({ files });
  };

  const pickOne = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) save.mutate({ files: [file], replaceIndex: replaceIndexRef.current });
  };

  const replaceOne = (index: number) => {
    replaceIndexRef.current = index;
    onePhotoRef.current?.click();
  };

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
            onClick={() => allPhotosRef.current?.click()}
            disabled={save.isPending}
            className={outlineButton}
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Images className="h-4 w-4" />
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
              <Camera className="h-4 w-4" />
              Yana rasm qo'shish
            </button>
          )}
        </div>
        {/* No `capture`: a phone then offers both the camera and the gallery. */}
        <input
          ref={allPhotosRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={pickAll}
        />
        <input
          ref={onePhotoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={pickOne}
        />
      </div>
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
    </section>
  );
}
