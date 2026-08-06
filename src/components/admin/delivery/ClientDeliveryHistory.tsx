/**
 * Prior delivery requests for the client being filed for.
 *
 * The manager's question before filing is "has someone already done this" — and
 * until now the panel could not answer it, so duplicate requests were made by
 * asking the client. The three counts are kept separate on purpose: an unknown
 * is not a zero. The 775 requests that predate provenance tracking genuinely
 * cannot be attributed, and rolling them into "user" would be a guess presented
 * as a fact.
 */

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, History, Loader2, ShieldAlert, User, UserCog } from "lucide-react";

import { getClientDeliveryContext } from "@/api/services/adminDeliveryService";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
  pending: "Kutilmoqda",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
  cancelled: "Bekor qilingan",
};

interface Props {
  clientCode: string | null;
}

export function ClientDeliveryHistory({ clientCode }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-delivery-context", clientCode],
    queryFn: () => getClientDeliveryContext(clientCode as string),
    enabled: Boolean(clientCode),
    staleTime: 30_000,
  });

  if (!clientCode) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-gray-400 px-1 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Oldingi zayavkalar tekshirilmoqda…
      </div>
    );
  }

  // Failing loudly matters here: a silent empty state would read as "no prior
  // requests", which is the opposite of "we could not check".
  if (error) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-amber-600 dark:text-amber-400 px-1 py-2">
        <AlertTriangle className="w-3.5 h-3.5" />
        Oldingi zayavkalarni tekshirib bo'lmadi — davom etsangiz, takror bo'lishi mumkin.
      </div>
    );
  }

  if (!data) return null;

  if (data.total_requests === 0) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-gray-400 px-1 py-2">
        <History className="w-3.5 h-3.5" />
        Bu mijozda oldin zayavka bo'lmagan.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <History className="w-4 h-4 text-gray-400" />
        <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
          Oldingi zayavkalar: {data.total_requests}
        </span>

        {data.filed_by_user > 0 && (
          <Badge
            variant="secondary"
            className="rounded-md text-[11px] bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 flex items-center gap-1"
          >
            <User className="w-3 h-3" />
            Mijoz o'zi: {data.filed_by_user}
          </Badge>
        )}
        {data.filed_by_admin > 0 && (
          <Badge
            variant="secondary"
            className="rounded-md text-[11px] bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 flex items-center gap-1"
          >
            <UserCog className="w-3 h-3" />
            Admin qoldirgan: {data.filed_by_admin}
          </Badge>
        )}
        {data.filed_unknown > 0 && (
          <Badge
            variant="secondary"
            className="rounded-md text-[11px] bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400"
            title="Bu yozuvlar kim qoldirgani belgilanadigan bo'lishidan oldin yaratilgan"
          >
            Noma'lum: {data.filed_unknown}
          </Badge>
        )}
      </div>

      <div className="space-y-1 max-h-40 overflow-y-auto">
        {data.recent.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-400 py-1 border-t border-gray-50 dark:border-white/[0.04] first:border-t-0"
          >
            <span className="font-mono text-gray-400 shrink-0">#{entry.id}</span>
            <span className="shrink-0">
              {new Date(entry.created_at).toLocaleDateString("uz-UZ", {
                day: "2-digit",
                month: "2-digit",
                timeZone: "Asia/Tashkent",
              })}
            </span>
            <span className="font-semibold shrink-0">{entry.delivery_type}</span>
            <span className="truncate flex-1">{entry.flight_names.join(", ")}</span>
            {entry.state_overridden && (
              <ShieldAlert
                className="w-3 h-3 text-amber-500 shrink-0"
                aria-label="Yuk holatiga qaramay qoldirilgan"
              />
            )}
            <span className="shrink-0 text-gray-400">
              {entry.created_via === "admin"
                ? "admin"
                : entry.created_via === "user"
                  ? "mijoz"
                  : "—"}
            </span>
            <span className="shrink-0">{STATUS_LABELS[entry.status] ?? entry.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
