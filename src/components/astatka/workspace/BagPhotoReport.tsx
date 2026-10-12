import { useId, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";

import {
  astatkaBagQueryKey,
  astatkaPackagesQueryKey,
  astatkaStatsQueryKey,
  getAstatkaBagDetails,
  type AstatkaBagRef,
} from "@/api/services/astatkaFlights";
import { formatKg } from "@/lib/astatkaFormat";
import { apiErrorMessage } from "@/utils/apiError";

import { PhotoReportRecord } from "./PhotoReportRecord";

interface Props {
  flightName: string;
  /** `null` when the bag has no client yet: nothing to look up. */
  bag: AstatkaBagRef | null;
  isOnline: boolean;
  /** The bag's photo-report weight after a change; `null` when it has none. */
  onWeightChanged?: (weightKg: number | null) => void;
}

function Notice({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-mc-md border border-dashed border-mc-border bg-mc-surface-2 px-4 py-6 text-center text-[13px] font-semibold text-mc-text-2">
      {icon && <span className="mb-2 text-mc-text-3">{icon}</span>}
      {children}
    </div>
  );
}

const heading =
  "text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3";

/**
 * Everything the photo report (`flight_cargos`) holds for one bag, record by
 * record, and — when the bag has none — the client's records on other flights.
 */
export function BagPhotoReport({
  flightName,
  bag,
  isOnline,
  onWeightChanged,
}: Props) {
  const queryClient = useQueryClient();
  const headingId = useId();
  const details = useQuery({
    queryKey: bag
      ? astatkaBagQueryKey(flightName, bag)
      : ["astatka-bag", "none"],
    queryFn: () => getAstatkaBagDetails(flightName, bag as AstatkaBagRef),
    enabled: isOnline && bag !== null,
    staleTime: 15_000,
  });

  const refreshAfterChange = () => {
    if (bag)
      void queryClient.invalidateQueries({
        queryKey: astatkaBagQueryKey(flightName, bag),
      });
    void queryClient.invalidateQueries({
      queryKey: astatkaPackagesQueryKey(flightName),
    });
    void queryClient.invalidateQueries({ queryKey: astatkaStatsQueryKey });
  };

  const data = details.data;
  let body: ReactNode;
  if (!bag) {
    body = (
      <Notice>
        Mijoz kodi hali noma'lum. Avval «Tahrirlash» bilan mijoz kodini
        kiriting.
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
      <div className="flex justify-center py-10" aria-busy="true">
        <Loader2
          className="h-6 w-6 animate-spin text-mc-text-3"
          aria-label="Yuklanmoqda"
        />
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
      <div className="space-y-3">
        <p className="text-[13px] font-semibold text-mc-text-2">
          {data.cargos.length} ta yozuv · jami{" "}
          <span className="font-extrabold tabular-nums text-mc-text">
            {formatKg(data.weight_kg)}
          </span>
        </p>
        {data.cargos.length === 0 && (
          <Notice>
            {data.source_flight_name
              ? `${data.source_flight_name} reysining foto hisobotida bu mijoz yo'q, shuning uchun og'irlik ham yo'q.`
              : "Yuk qaysi reysdan ekani noma'lum, shuning uchun foto hisobot topilmadi."}
            {data.other_cargos.length > 0 &&
              " Mijozning boshqa reyslardagi yozuvlari pastda."}
          </Notice>
        )}
        {data.cargos.map((cargo) => (
          <PhotoReportRecord
            key={cargo.id}
            flightName={flightName}
            cargo={cargo}
            editable
            onWeightSaved={(saved) => {
              const total = data.cargos.reduce<number | null>((sum, row) => {
                const weight =
                  row.id === saved.id ? saved.weight_kg : row.weight_kg;
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
            <h4 className={heading}>
              Mijozning boshqa reyslardagi foto hisoboti
            </h4>
            {data.other_cargos.map((cargo) => (
              <PhotoReportRecord
                key={cargo.id}
                flightName={flightName}
                cargo={cargo}
                editable={false}
              />
            ))}
          </section>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className={heading}>
        Foto hisobot
      </h3>
      {body}
    </section>
  );
}
