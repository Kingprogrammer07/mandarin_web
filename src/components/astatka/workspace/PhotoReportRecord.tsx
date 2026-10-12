import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Images, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import {
  astatkaCargoPhotosQueryKey,
  replaceAstatkaCargoPhotos,
  updateAstatkaCargoWeight,
  type AstatkaBagCargo,
} from "@/api/services/astatkaFlights";
import {
  formatDateTime,
  formatKg,
  parseWeightInput,
} from "@/lib/astatkaFormat";
import { apiErrorMessage } from "@/utils/apiError";

import { PhotoCarousel } from "./PhotoCarousel";

/** Same ceiling the server enforces. */
const MAX_PHOTOS = 10;

interface Props {
  flightName: string;
  cargo: AstatkaBagCargo;
  /** Another flight's row is shown for reference, not changed from here. */
  editable: boolean;
  onWeightSaved?: (cargo: AstatkaBagCargo) => void;
  onPhotosSaved?: () => void;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
        {label}
      </dt>
      <dd className="break-words text-[13px] font-bold text-mc-text">
        {children}
      </dd>
    </div>
  );
}

function sentLabel(sent: boolean, at: string | null): string {
  if (!sent) return "Yo'q";
  return at ? `Ha · ${formatDateTime(at)}` : "Ha";
}

const outlineButton =
  "flex min-h-11 items-center justify-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-3 py-1.5 text-center text-[13px] font-bold leading-tight text-mc-text active:scale-[0.97] disabled:opacity-60";

/**
 * One photo-report row (`flight_cargos`) of the bag: its photos, its facts,
 * and the two fixes a worker makes at the shelf — the weight, and re-taking a
 * photo or all of them. On a wide window the photos sit beside the facts.
 */
export function PhotoReportRecord({
  flightName,
  cargo,
  editable,
  onWeightSaved,
  onPhotosSaved,
}: Props) {
  const queryClient = useQueryClient();
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightText, setWeightText] = useState("");
  const allPhotosRef = useRef<HTMLInputElement>(null);
  const onePhotoRef = useRef<HTMLInputElement>(null);
  /** Which photo the single-file picker replaces; the count means "add". */
  const replaceIndexRef = useRef(0);

  const saveWeight = useMutation({
    mutationFn: (weightKg: number) =>
      updateAstatkaCargoWeight(flightName, cargo.id, weightKg),
    onSuccess: (result) => {
      toast.success(
        result.synced_packages > 0
          ? "Og'irlik saqlandi. Astatkadagi yuk ham yangilandi."
          : "Og'irlik saqlandi.",
      );
      setEditingWeight(false);
      onWeightSaved?.(result.cargo);
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Og'irlikni saqlab bo'lmadi.")),
  });

  const savePhotos = useMutation({
    mutationFn: ({
      files,
      replaceIndex,
    }: {
      files: File[];
      replaceIndex?: number;
    }) => replaceAstatkaCargoPhotos(flightName, cargo.id, files, replaceIndex),
    onSuccess: (_result, { replaceIndex }) => {
      toast.success(
        replaceIndex === undefined ? "Rasmlar yangilandi." : "Rasm yangilandi.",
      );
      void queryClient.invalidateQueries({
        queryKey: astatkaCargoPhotosQueryKey(cargo.id),
      });
      onPhotosSaved?.();
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Rasmni saqlab bo'lmadi.")),
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
    if (file)
      savePhotos.mutate({
        files: [file],
        replaceIndex: replaceIndexRef.current,
      });
  };

  const replaceOne = (index: number) => {
    replaceIndexRef.current = index;
    onePhotoRef.current?.click();
  };

  return (
    <article className="@container rounded-mc-lg border border-mc-border bg-mc-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="break-words text-[15px] font-extrabold text-mc-text">
          {cargo.flight_name}
        </p>
        <p className="text-[11px] font-semibold text-mc-text-3">
          Foto hisobot yozuvi №{cargo.id}
        </p>
      </div>

      {/* A phone stacks photos, photo buttons, facts. A wide window puts the
          photos on the left and the facts, then the buttons, beside them. */}
      <div className="mt-3 grid grid-cols-1 items-start gap-3 @xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @xl:grid-rows-[auto_1fr] @xl:gap-x-4">
        {/* ── Photos ─────────────────────────────────────────────────────── */}
        <div className="min-w-0 @xl:row-span-2">
          <PhotoCarousel
            flightName={flightName}
            cargo={cargo}
            onReplace={editable ? replaceOne : undefined}
            busy={savePhotos.isPending}
          />
        </div>
        {editable && (
          <div className="grid grid-cols-1 gap-2 @md:grid-cols-2 @xl:col-start-2 @xl:row-start-2 @xl:grid-cols-1 @4xl:grid-cols-2">
            <button
              type="button"
              onClick={() => allPhotosRef.current?.click()}
              disabled={savePhotos.isPending}
              className={outlineButton}
            >
              {savePhotos.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Images className="h-4 w-4" />
              )}
              {cargo.photo_count === 0
                ? "Rasm olish"
                : "Rasmlarni qayta olish"}
            </button>
            {cargo.photo_count > 0 && cargo.photo_count < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => replaceOne(cargo.photo_count)}
                disabled={savePhotos.isPending}
                className={outlineButton}
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
            <input
              ref={onePhotoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={pickOne}
            />
          </div>
        )}

        {/* ── Facts ──────────────────────────────────────────────────────── */}
        <div className="min-w-0 @xl:col-start-2 @xl:row-start-1">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <div className="col-span-2 min-w-0">
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
                Og'irlik
              </dt>
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
                    {saveWeight.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
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
                        setWeightText(
                          cargo.weight_kg === null
                            ? ""
                            : String(cargo.weight_kg),
                        );
                        setEditingWeight(true);
                      }}
                      className="inline-flex h-11 items-center gap-1 text-[13px] font-bold text-mc-brand active:opacity-70"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {cargo.weight_kg === null
                        ? "Og'irlik kiritish"
                        : "O'zgartirish"}
                    </button>
                  )}
                </dd>
              )}
            </div>
            <Fact label="Mijoz kodi">
              <span className="break-all">{cargo.client_id}</span>
            </Fact>
            <Fact label="Rasmlar">{cargo.photo_count} ta</Fact>
            <Fact label="1 kg narxi">
              {cargo.price_per_kg === null ? "—" : `$${cargo.price_per_kg}`}
            </Fact>
            <Fact label="Botda yuborilgan">
              {sentLabel(cargo.is_sent, cargo.is_sent_date)}
            </Fact>
            <Fact label="Saytda yuborilgan">
              {sentLabel(cargo.is_sent_web, cargo.is_sent_web_date)}
            </Fact>
            <Fact label="Kiritilgan">{formatDateTime(cargo.created_at)}</Fact>
            <Fact label="O'zgartirilgan">
              {formatDateTime(cargo.updated_at)}
            </Fact>
          </dl>
          {cargo.comment && (
            <p className="mt-3 break-words rounded-mc-sm bg-mc-surface-2 px-3 py-2 text-[13px] font-medium text-mc-text-2">
              {cargo.comment}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
