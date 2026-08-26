/**
 * The three runtime switches, first on the page.
 *
 * A super-admin's first question in the morning is "is anything switched off" —
 * maintenance left on, NBU payments disabled, the bot stuck in WebApp-only mode.
 * Each chip carries an icon and a word, never colour alone.
 */

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CreditCard,
  HelpCircle,
  RotateCw,
  Smartphone,
  Wrench,
} from 'lucide-react';

import type { DashboardFlags } from '@/api/services/adminDashboard';
import { formatTashkentDateTime } from '@/lib/format';
import { triggerSoftHaptic } from '@/utils/haptics';

import { StatusChip, type Tone } from './DashboardPrimitives';

/** `null` means the flag could not be read — say so instead of guessing "off". */
function chipFor(
  value: boolean | null,
  { label, whenTrue, whenFalse, trueIsNormal, HealthyIcon }: {
    label: string;
    whenTrue: string;
    whenFalse: string;
    /** Which state is the healthy one, so the abnormal one gets the danger tone. */
    trueIsNormal: boolean;
    HealthyIcon: LucideIcon;
  },
): { label: string; state: string; tone: Tone; Icon: LucideIcon } {
  if (value === null) {
    return { label, state: 'Noma’lum', tone: 'quiet', Icon: HelpCircle };
  }
  const healthy = value === trueIsNormal;
  return {
    label,
    state: value ? whenTrue : whenFalse,
    tone: healthy ? 'quiet' : 'danger',
    Icon: healthy ? HealthyIcon : AlertTriangle,
  };
}

export function SystemStatusStrip({
  flags,
  updatedAt,
  isFetching,
  onRefresh,
  language,
}: {
  flags: DashboardFlags | undefined;
  updatedAt: number | undefined;
  isFetching: boolean;
  onRefresh: () => void;
  language?: string;
}) {
  const maintenance = chipFor(flags?.maintenance ?? null, {
    label: 'Texnik ishlar',
    whenTrue: 'YOQILGAN',
    whenFalse: 'O‘chiq',
    trueIsNormal: false,
    HealthyIcon: Wrench,
  });
  const nbu = chipFor(flags?.nbu_enabled ?? null, {
    label: 'NBU to‘lov',
    whenTrue: 'Yoqilgan',
    whenFalse: 'O‘CHIQ',
    trueIsNormal: true,
    HealthyIcon: CreditCard,
  });

  // Bot mode is a deliberate operating choice, not a fault, so it never turns
  // red — it is shown because a stale WebApp-only flag is easy to forget.
  const webappOnly = flags?.webapp_only;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusChip {...maintenance} />
      <StatusChip {...nbu} />
      <StatusChip
        label="Bot rejimi"
        state={webappOnly === null || webappOnly === undefined ? 'Noma’lum' : webappOnly ? 'Faqat ilova' : 'To‘liq'}
        tone={webappOnly ? 'brand' : 'quiet'}
        Icon={Smartphone}
      />

      <div className="ml-auto flex items-center gap-2">
        {updatedAt !== undefined && (
          <span className="text-[11px] font-semibold text-mc-text-3">
            {formatTashkentDateTime(new Date(updatedAt), language)}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            triggerSoftHaptic();
            onRefresh();
          }}
          aria-label="Yangilash"
          className="flex h-11 w-11 items-center justify-center rounded-mc-sm border border-mc-border bg-mc-surface text-mc-text-2 transition-transform active:scale-95"
        >
          <RotateCw
            className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
            strokeWidth={2.2}
          />
        </button>
      </div>
    </div>
  );
}
