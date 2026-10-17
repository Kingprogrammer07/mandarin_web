import type { ReactNode } from "react";

import {
  astatkaCargoPhotosQueryKey,
  getAstatkaCargoPhotos,
  type AstatkaBagCargo,
  type AstatkaBagRef,
} from "@/api/services/astatkaFlights";
import { formatDateTime, formatKg } from "@/lib/astatkaFormat";

import { PhotoCarousel } from "./PhotoCarousel";

interface Props {
  flightName: string;
  /** The bag the window shows: the server opens only its rows' photos. */
  bag: AstatkaBagRef;
  cargo: AstatkaBagCargo;
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

/**
 * One photo-report row (`flight_cargos`) of the old flight, as that flight
 * holds it. Read-only: the astatka never changes another flight's data — the
 * bag's weight is fixed with «Tahrirlash», its photos under «Astatka
 * rasmlari». On a wide window the photos sit beside the facts.
 */
export function PhotoReportRecord({ flightName, bag, cargo }: Props) {
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

      <div className="mt-3 grid grid-cols-1 items-start gap-3 @xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @xl:gap-x-4">
        <div className="min-w-0">
          <PhotoCarousel
            photoCount={cargo.photo_count}
            queryKey={astatkaCargoPhotosQueryKey(cargo.id)}
            queryFn={() => getAstatkaCargoPhotos(flightName, cargo.id, bag)}
          />
        </div>

        <div className="min-w-0">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <div className="col-span-2 min-w-0">
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
                Og'irlik
              </dt>
              <dd className="text-[16px] font-extrabold tabular-nums text-mc-text">
                {formatKg(cargo.weight_kg)}
              </dd>
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
