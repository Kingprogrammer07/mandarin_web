/**
 * Online state of admin accounts, for the «Admin hisoblar» window.
 *
 * Styled like the page it sits on (gray / orange), not the dashboard tokens,
 * so the new column does not read as a foreign block.
 */

import { memo } from 'react';
import type { AdminPresenceItem, AdminPresenceResponse } from '@/api/services/presence';
import { exactTime, formatSeen } from '@/lib/presence';

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        online ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    />
  );
}

/** Two lines: online / last activity, then last login. Exact time on hover. */
export const AdminPresenceCell = memo(({ presence }: { presence?: AdminPresenceItem }) => {
  if (!presence) {
    return <span className="text-[12px] text-gray-400 dark:text-gray-600">—</span>;
  }
  const { online, last_seen_at, last_login_at, last_login_ip } = presence;
  return (
    <div className="min-w-0 space-y-0.5">
      <p
        className="flex items-center gap-1.5 text-[12px] font-medium"
        title={last_seen_at ? `Oxirgi faollik: ${exactTime(last_seen_at)}` : undefined}
      >
        <OnlineDot online={online} />
        {online ? (
          <span className="text-emerald-700 dark:text-emerald-400">Online</span>
        ) : (
          <span className="text-gray-600 dark:text-gray-400">
            {last_seen_at ? formatSeen(last_seen_at) : 'Faollik qayd etilmagan'}
          </span>
        )}
      </p>
      <p
        className="text-[11px] text-gray-400 dark:text-gray-500"
        title={
          last_login_at
            ? `Oxirgi kirish: ${exactTime(last_login_at)}${last_login_ip ? ` · IP ${last_login_ip}` : ''}`
            : undefined
        }
      >
        {last_login_at ? `Kirish: ${formatSeen(last_login_at)}` : 'So‘nggi 90 kunda kirmagan'}
      </p>
    </div>
  );
});
AdminPresenceCell.displayName = 'AdminPresenceCell';

/** Who is online right now, by name. */
export function OnlineAdminsStrip({ data }: { data?: AdminPresenceResponse }) {
  if (!data) return null;
  const online = data.items.filter((i) => i.online);
  const minutes = Math.round(data.online_seconds / 60);
  return (
    <div className="bg-white dark:bg-[#111] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-gray-900 dark:text-white">
          <OnlineDot online={online.length > 0} />
          Hozir online: {online.length}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Online — so‘nggi {minutes} daqiqada panelda ishlagan
        </p>
      </div>
      {online.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {online.map((a) => (
            <span
              key={a.admin_id}
              title={a.last_seen_at ? `Oxirgi faollik: ${exactTime(a.last_seen_at)}` : undefined}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
            >
              <span className="truncate">{a.full_name || a.system_username}</span>
              <span className="text-emerald-600/70 dark:text-emerald-400/60">@{a.system_username}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-[12px] text-gray-500 dark:text-gray-400">Hozir hech kim online emas</p>
      )}
    </div>
  );
}
