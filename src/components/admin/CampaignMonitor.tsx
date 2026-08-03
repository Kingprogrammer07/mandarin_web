import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Loader2 } from 'lucide-react';
import {
  campaignService,
  TERMINAL_CAMPAIGN_STATUSES,
} from '@/api/services/campaignService';

/**
 * Live counters for one send, shared by every screen that starts one.
 *
 * Extracted from the flight sender when manual broadcasts arrived: two copies
 * of a progress view would eventually disagree about what "skipped" means, and
 * the stop button is the kind of control that must behave identically wherever
 * it appears.
 */

const POLL_INTERVAL_MS = 2000;

const STATUS_LABELS: Record<string, string> = {
  queued: 'Navbatda',
  running: 'Yuborilmoqda',
  cancelling: "To'xtatilmoqda",
  cancelled: 'Bekor qilingan',
  completed: 'Yakunlandi',
  failed: 'Xatolik',
};

export function StatCard({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: number | string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  hint?: string;
}) {
  const tones = {
    neutral: 'bg-gray-50 text-gray-900 dark:bg-white/5 dark:text-white',
    good: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
    warn: 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200',
    bad: 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300',
  } as const;

  return (
    <div className={`rounded-xl px-3 py-2 ${tones[tone]}`} title={hint}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
  );
}

export default function CampaignMonitor({ campaignId }: { campaignId: number }) {
  const queryClient = useQueryClient();
  const { data: campaign } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => campaignService.getCampaign(campaignId),
    // Stop hitting the server once the run can no longer change.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_CAMPAIGN_STATUSES.includes(status)
        ? false
        : POLL_INTERVAL_MS;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => campaignService.cancelCampaign(campaignId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['campaign', campaignId], updated);
      toast.success("To'xtatilmoqda — joriy partiyadan keyin to'xtaydi");
    },
    onError: () =>
      toast.error("To'xtatib bo'lmadi — yuborish allaqachon tugagan bo'lishi mumkin"),
  });

  if (!campaign) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
        <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
      </div>
    );
  }

  const isRunning = !TERMINAL_CAMPAIGN_STATUSES.includes(campaign.status);

  return (
    <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-gray-900 dark:text-white">
            {campaign.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-white/45">
            #{campaign.id} · {campaign.channel} ·{' '}
            {STATUS_LABELS[campaign.status] ?? campaign.status}
          </p>
        </div>
        {isRunning && (
          <button
            type="button"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending || campaign.status === 'cancelling'}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-black text-red-600 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400"
          >
            <Ban className="h-3.5 w-3.5" />
            To'xtatish
          </button>
        )}
      </div>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
          style={{ width: `${campaign.percent}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Jami" value={campaign.total} />
        <StatCard label="Yuborildi" value={campaign.sent} tone="good" />
        <StatCard label="O'tkazildi" value={campaign.skipped} tone="warn" />
        <StatCard label="Xato" value={campaign.failed} tone="bad" />
      </div>

      {campaign.error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {campaign.error}
        </p>
      )}
      {campaign.status === 'cancelled' && (
        <p className="mt-3 text-xs font-semibold text-gray-500 dark:text-white/45">
          Yuborilgan {campaign.sent} ta xabarni qaytarib bo'lmaydi.
        </p>
      )}
    </div>
  );
}
