import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Images,
  Loader2,
  Pencil,
  RefreshCw,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  astatkaBagQueryKey,
  astatkaCargoPhotosQueryKey,
  astatkaPackagesQueryKey,
  astatkaStatsQueryKey,
  getAstatkaBagDetails,
  getAstatkaCargoPhotos,
  replaceAstatkaCargoPhotos,
  updateAstatkaCargoWeight,
  type AstatkaBagCargo,
  type AstatkaBagRef,
  type AstatkaCargoPhoto,
} from "@/api/services/astatkaFlights";
import { formatDateTime, formatKg, parseWeightInput } from "@/lib/astatkaFormat";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/utils/apiError";

import { WorkspaceDialog } from "./WorkspaceDialog";

/** Same ceiling the server enforces. */
const MAX_PHOTOS = 10;

interface Props {
  flightName: string;
  /** `null` when the bag has no client yet: nothing to look up. */
  bag: AstatkaBagRef | null;
  title: string;
  isOnline: boolean;
  onClose: () => void;
  /** The bag's photo-report weight after a change; `null` when it has none. */
  onWeightChanged?: (weightKg: number | null) => void;
}

/**
 * Everything the photo report (`flight_cargos`) holds for one bag: the
 * photos, each row's facts, and the two fixes a worker makes at the shelf —
 * the weight, and re-taking a photo or all of them.
 */
export function BagDetailsDialog({
  flightName,
  bag,
  title,
  isOnline,
  onClose,
  onWeightChanged,
}: Props) {
  const queryClient = useQueryClient();
  const details = useQuery({
    queryKey: bag ? astatkaBagQueryKey(flightName, bag) : ["astatka-bag", "none"],
    queryFn: () => getAstatkaBagDetails(flightName, bag as AstatkaBagRef),
    enabled: isOnline && bag !== null,
    staleTime: 15_000,
  });

  const refreshAfterChange = () => {
    if (bag) void queryClient.invalidateQueries({ queryKey: astatkaBagQueryKey(flightName, bag) });
    void queryClient.invalidateQueries({ queryKey: astatkaPackagesQueryKey(flightName) });
    void queryClient.invalidateQueries({ queryKey: astatkaStatsQueryKey });
  };

  const data = details.data;
  const description = data
    ? [data.client_name, data.source_flight_name || "Reys noma'lum"].filter(Boolean).join(" · ")
    : undefined;

  let body: ReactNode;
  if (!bag) {
    body = (
      <Notice>
        Mijoz kodi hali noma'lum. Avval «Tahrirlash» bilan mijoz kodini kiriting.
      </Notice>
    );
  } else if (!isOnline) {
    body = (
      <Notice icon={<WifiOff className="h-5 w-5" />}>
        Rasmlar va foto hisobot ma'lumotlari internet bilan ochiladi.
      </Notice>
    );
  } else if (details.isPending) {
    body = (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-mc-text-3" />
      </div>
    );
  } else if (details.isError || !data) {
    body = (
      <Notice>
        {apiErrorMessage(details.error, "Ma'lumotni olib bo'lmadi.")}
        <button
          type="button"
          onClick={() => void details.refetch()}
          className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.97]"
        >
          <RefreshCw className="h-4 w-4" />
          Qayta urinish
        </button>
      </Notice>
    );
  } else {
    body = (
      <div className="space-y-4">
        <p className="text-[13px] font-semibold text-mc-text-2">
          Foto hisobot: {data.cargos.length} ta yozuv · jami{" "}
          <span className="font-extrabold tabular-nums text-mc-text">{formatKg(data.weight_kg)}</span>
        </p>
        {data.cargos.length === 0 && (
          <Notice>
            {data.source_flight_name
              ? `${data.source_flight_name} reysining foto hisobotida bu mijoz yo'q, shuning uchun og'irlik ham yo'q.`
              : "Yuk qaysi reysdan ekani noma'lum, shuning uchun foto hisobot topilmadi."}
            {data.other_cargos.length > 0 && " Mijozning boshqa reyslardagi yozuvlari pastda."}
          </Notice>
        )}
        {data.cargos.map((cargo) => (
          <CargoCard
            key={cargo.id}
            flightName={flightName}
            cargo={cargo}
            editable
            onWeightSaved={(saved) => {
              const total = data.cargos.reduce<number | null>((sum, row) => {
                const weight = row.id === saved.id ? saved.weight_kg : row.weight_kg;
                return weight === null ? sum : (sum ?? 0) + weight;
              }, null);
              onWeightChanged?.(total);
              refreshAfterChange();
            }}
            onPhotosSaved={refreshAfterChange}
          />
        ))}
        {data.other_cargos.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
              Mijozning boshqa reyslardagi foto hisoboti
            </h3>
            {data.other_cargos.map((cargo) => (
              <CargoCard key={cargo.id} flightName={flightName} cargo={cargo} editable={false} />
            ))}
          </section>
        )}
      </div>
    );
  }

  return (
    <WorkspaceDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={description ?? "Rasmlar va foto hisobot ma'lumotlari"}
      wide
    >
      {body}
    </WorkspaceDialog>
  );
}

function Notice({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-mc-md border border-dashed border-mc-border bg-mc-surface-2 px-4 py-6 text-center text-[13px] font-semibold text-mc-text-2">
      {icon && <span className="mb-2 text-mc-text-3">{icon}</span>}
      {children}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">{label}</dt>
      <dd className="break-words text-[13px] font-bold text-mc-text">{children}</dd>
    </div>
  );
}

function sentLabel(sent: boolean, at: string | null): string {
  if (!sent) return "Yo'q";
  return at ? `Ha · ${formatDateTime(at)}` : "Ha";
}

function CargoCard({
  flightName,
  cargo,
  editable,
  onWeightSaved,
  onPhotosSaved,
}: {
  flightName: string;
  cargo: AstatkaBagCargo;
  editable: boolean;
  onWeightSaved?: (cargo: AstatkaBagCargo) => void;
  onPhotosSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightText, setWeightText] = useState("");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const allPhotosRef = useRef<HTMLInputElement>(null);
  const onePhotoRef = useRef<HTMLInputElement>(null);
  /** Which photo the single-file picker replaces; the count means "add". */
  const replaceIndexRef = useRef(0);

  const photos = useQuery({
    queryKey: astatkaCargoPhotosQueryKey(cargo.id),
    queryFn: () => getAstatkaCargoPhotos(flightName, cargo.id),
    enabled: cargo.photo_count > 0,
    // The links expire after about an hour.
    staleTime: 20 * 60_000,
  });

  const saveWeight = useMutation({
    mutationFn: (weightKg: number) => updateAstatkaCargoWeight(flightName, cargo.id, weightKg),
    onSuccess: (result) => {
      toast.success(
        result.synced_packages > 0
          ? "Og'irlik saqlandi. Astatkadagi yuk ham yangilandi."
          : "Og'irlik saqlandi.",
      );
      setEditingWeight(false);
      onWeightSaved?.(result.cargo);
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Og'irlikni saqlab bo'lmadi.")),
  });

  const savePhotos = useMutation({
    mutationFn: ({ files, replaceIndex }: { files: File[]; replaceIndex?: number }) =>
      replaceAstatkaCargoPhotos(flightName, cargo.id, files, replaceIndex),
    onSuccess: (_result, { replaceIndex }) => {
      toast.success(replaceIndex === undefined ? "Rasmlar yangilandi." : "Rasm yangilandi.");
      void queryClient.invalidateQueries({ queryKey: astatkaCargoPhotosQueryKey(cargo.id) });
      onPhotosSaved?.();
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Rasmni saqlab bo'lmadi.")),
  });

  const submitWeight = () => {
    const value = parseWeightInput(weightText);
    if (value === null) {
      toast.error("Og'irlikni to'g'ri yozing, masalan 12.5");
      return;
    }
    saveWeight.mutate(value);
  };

  const pickAll = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    if (files.length > MAX_PHOTOS) {
      toast.error(`Ko'pi bilan ${MAX_PHOTOS} ta rasm tanlang.`);
      return;
    }
    savePhotos.mutate({ files });
  };

  const pickOne = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) savePhotos.mutate({ files: [file], replaceIndex: replaceIndexRef.current });
  };

  const replaceOne = (index: number) => {
    replaceIndexRef.current = index;
    onePhotoRef.current?.click();
  };

  const resolved = photos.data ?? [];

  return (
    <article className="rounded-mc-lg border border-mc-border bg-mc-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="break-words text-[15px] font-extrabold text-mc-text">{cargo.flight_name}</p>
        <p className="text-[11px] font-semibold text-mc-text-3">Foto hisobot yozuvi №{cargo.id}</p>
      </div>

      {/* ── Photos ─────────────────────────────────────────────────────── */}
      <div className="mt-3">
        {cargo.photo_count === 0 ? (
          <p className="flex items-center gap-2 rounded-mc-sm bg-mc-surface-2 px-3 py-3 text-[13px] font-semibold text-mc-text-3">
            <ImageOff className="h-4 w-4 shrink-0" />
            Rasm yo'q
          </p>
        ) : photos.isPending ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: Math.min(cargo.photo_count, 4) }, (_, index) => (
              <div key={index} className="aspect-square animate-pulse rounded-mc-sm bg-mc-surface-2" />
            ))}
          </div>
        ) : photos.isError ? (
          <p className="rounded-mc-sm bg-mc-danger-soft px-3 py-2 text-[13px] font-semibold text-mc-danger">
            {apiErrorMessage(photos.error, "Rasmlarni ochib bo'lmadi.")}
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {resolved.map((photo) => (
              <li key={photo.index}>
                <button
                  type="button"
                  onClick={() => setViewerIndex(photo.index)}
                  aria-label={`${photo.index + 1}-rasmni kattalashtirish`}
                  className="block aspect-square w-full overflow-hidden rounded-mc-sm border border-mc-border bg-mc-surface-2 active:scale-[0.98]"
                >
                  <PhotoImage photo={photo} className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editable && (
        <div className="mt-2 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          <button
            type="button"
            onClick={() => allPhotosRef.current?.click()}
            disabled={savePhotos.isPending}
            className="flex h-11 items-center justify-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.97] disabled:opacity-60"
          >
            {savePhotos.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Images className="h-4 w-4" />
            )}
            {cargo.photo_count === 0 ? "Rasm olish" : "Rasmlarni qayta olish"}
          </button>
          {cargo.photo_count > 0 && cargo.photo_count < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => replaceOne(cargo.photo_count)}
              disabled={savePhotos.isPending}
              className="flex h-11 items-center justify-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.97] disabled:opacity-60"
            >
              <Camera className="h-4 w-4" />
              Yana rasm qo'shish
            </button>
          )}
          {/* No `capture`: a phone then offers both the camera and the gallery. */}
          <input
            ref={allPhotosRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={pickAll}
          />
          <input ref={onePhotoRef} type="file" accept="image/*" className="hidden" onChange={pickOne} />
        </div>
      )}

      {/* ── Facts ──────────────────────────────────────────────────────── */}
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">Og'irlik</dt>
          {editingWeight ? (
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <input
                value={weightText}
                onChange={(event) => setWeightText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitWeight();
                  }
                }}
                inputMode="decimal"
                enterKeyHint="done"
                autoFocus
                aria-label="Og'irlik, kg"
                placeholder="Masalan: 12.5"
                className="h-11 w-32 min-w-0 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 text-[16px] font-bold tabular-nums text-mc-text outline-none focus:border-mc-brand"
              />
              <button
                type="button"
                onClick={submitWeight}
                disabled={saveWeight.isPending}
                className="flex h-11 items-center gap-1 rounded-mc-sm bg-mc-brand px-3 text-[13px] font-extrabold text-mc-on-brand active:scale-[0.97] disabled:opacity-60"
              >
                {saveWeight.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Saqlash
              </button>
              <button
                type="button"
                onClick={() => setEditingWeight(false)}
                aria-label="Bekor qilish"
                className="flex h-11 w-11 items-center justify-center rounded-mc-sm text-mc-text-2 active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </dd>
          ) : (
            <dd className="flex flex-wrap items-center gap-x-2">
              <span className="text-[16px] font-extrabold tabular-nums text-mc-text">
                {formatKg(cargo.weight_kg)}
              </span>
              {editable && (
                <button
                  type="button"
                  onClick={() => {
                    setWeightText(cargo.weight_kg === null ? "" : String(cargo.weight_kg));
                    setEditingWeight(true);
                  }}
                  className="inline-flex h-11 items-center gap-1 text-[13px] font-bold text-mc-brand active:opacity-70"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {cargo.weight_kg === null ? "Og'irlik kiritish" : "O'zgartirish"}
                </button>
              )}
            </dd>
          )}
        </div>
        <Fact label="Mijoz kodi">{cargo.client_id}</Fact>
        <Fact label="Rasmlar">{cargo.photo_count} ta</Fact>
        <Fact label="1 kg narxi">{cargo.price_per_kg === null ? "—" : `$${cargo.price_per_kg}`}</Fact>
        <Fact label="Botda yuborilgan">{sentLabel(cargo.is_sent, cargo.is_sent_date)}</Fact>
        <Fact label="Saytda yuborilgan">{sentLabel(cargo.is_sent_web, cargo.is_sent_web_date)}</Fact>
        <Fact label="Kiritilgan">{formatDateTime(cargo.created_at)}</Fact>
        <Fact label="O'zgartirilgan">{formatDateTime(cargo.updated_at)}</Fact>
      </dl>
      {cargo.comment && (
        <p className="mt-3 break-words rounded-mc-sm bg-mc-surface-2 px-3 py-2 text-[13px] font-medium text-mc-text-2">
          {cargo.comment}
        </p>
      )}

      {viewerIndex !== null && resolved.length > 0 && (
        <PhotoViewer
          photos={resolved}
          index={Math.min(viewerIndex, resolved.length - 1)}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          onReplace={
            editable
              ? (index) => {
                  setViewerIndex(null);
                  replaceOne(index);
                }
              : undefined
          }
          busy={savePhotos.isPending}
        />
      )}
    </article>
  );
}

function PhotoImage({ photo, className }: { photo: AstatkaCargoPhoto; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!photo.url || broken) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-[11px] font-semibold text-mc-text-3">
        <ImageOff className="h-5 w-5" />
        {photo.error ?? "Rasm ochilmadi"}
      </span>
    );
  }
  return (
    <img
      src={photo.url}
      alt={`${photo.index + 1}-rasm`}
      loading="lazy"
      onError={() => setBroken(true)}
      className={className}
    />
  );
}

/** Full-size photos, one at a time, over the details window. */
function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
  onReplace,
  busy,
}: {
  photos: AstatkaCargoPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onReplace?: (index: number) => void;
  busy: boolean;
}) {
  const photo = photos[index];
  const many = photos.length > 1;
  const step = (delta: number) => onIndexChange((index + delta + photos.length) % photos.length);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/90" />
        <DialogPrimitive.Content
          onKeyDown={(event) => {
            if (!many) return;
            if (event.key === "ArrowLeft") step(-1);
            if (event.key === "ArrowRight") step(1);
          }}
          className="fixed inset-0 z-[60] flex flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] outline-none"
        >
          <div className="flex shrink-0 items-center gap-2 px-2 py-2">
            <DialogPrimitive.Title className="min-w-0 flex-1 px-2 text-[14px] font-bold text-white">
              {index + 1}-rasm, {photos.length} tadan
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Rasmni kattalashtirib ko'rish
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              aria-label="Yopish"
              className="flex h-11 w-11 items-center justify-center rounded-mc-sm text-white active:scale-95"
            >
              <X className="h-6 w-6" />
            </DialogPrimitive.Close>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            <PhotoImage
              key={photo.index}
              photo={photo}
              className="max-h-full max-w-full rounded-mc-sm object-contain"
            />
            {many && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Oldingi rasm"
                  className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white active:scale-95"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Keyingi rasm"
                  className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white active:scale-95"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
          {onReplace && (
            <div className="flex shrink-0 justify-center px-4 py-3">
              <button
                type="button"
                onClick={() => onReplace(photo.index)}
                disabled={busy}
                className={cn(
                  "flex h-12 items-center gap-2 rounded-mc-md bg-mc-brand px-5 text-[14px] font-extrabold text-mc-on-brand active:scale-[0.97] disabled:opacity-60",
                )}
              >
                <Camera className="h-5 w-5" />
                Shu rasmni qayta olish
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
