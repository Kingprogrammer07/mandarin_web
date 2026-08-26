/**
 * Four large entry cards, not a strip of icon buttons.
 *
 * A row of small square icons is a second navigation bar competing with the
 * sidebar, and it says nothing the sidebar does not already say. Cards with a
 * title and a line of explanation earn their space: they are the four things a
 * super-admin actually starts a day by doing, described well enough that a new
 * manager can pick the right one.
 *
 * The four are the mockup's, not a guess: add a flight, import, add a client,
 * read the audit log. It shares a row with "So‘nggi faoliyat", so the grid is
 * sized by container query — a viewport breakpoint stays true inside the half
 * column and would put four 110px cards there.
 */

import type { LucideIcon } from 'lucide-react';
import { ArrowRight, ClipboardList, Plane, Upload, UserPlus } from 'lucide-react';

import { triggerSoftHaptic } from '@/utils/haptics';

import { SectionCard } from './DashboardPrimitives';

type Tone = 'brand' | 'success' | 'warn' | 'neutral';

const TONE_CHIP: Record<Tone, string> = {
  brand: 'bg-mc-brand-soft text-mc-brand',
  success: 'bg-mc-success/12 text-mc-success',
  warn: 'bg-mc-warn-soft text-mc-warn',
  neutral: 'bg-mc-surface-2 text-mc-text-2',
};

const ACTIONS: {
  page: string;
  label: string;
  hint: string;
  Icon: LucideIcon;
  tone: Tone;
}[] = [
  {
    page: 'flights',
    label: 'Reys qo‘shish',
    hint: 'Yangi reys yaratish',
    Icon: Plane,
    tone: 'brand',
  },
  {
    page: 'import',
    label: 'Import',
    hint: 'Excel fayl yuklash',
    Icon: Upload,
    tone: 'neutral',
  },
  {
    page: 'manager-page',
    label: 'Mijoz qo‘shirish',
    hint: 'Mijozlar ro‘yxati',
    Icon: UserPlus,
    tone: 'success',
  },
  {
    page: 'admin-audit',
    label: 'Audit',
    hint: 'Xodimlar amallari tarixi',
    Icon: ClipboardList,
    tone: 'warn',
  },
];

export function QuickAccess({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <SectionCard title="Tezkor kirish" subtitle="Kun shulardan boshlanadi">
      <div className="grid grid-cols-2 gap-2.5 @[30rem]:grid-cols-4">
        {ACTIONS.map(({ page, label, hint, Icon, tone }) => (
          <button
            key={page}
            type="button"
            onClick={() => {
              triggerSoftHaptic();
              onNavigate(page);
            }}
            className="group flex min-h-[112px] flex-col items-start rounded-mc-md border border-mc-border bg-mc-surface-2 p-3 text-left transition-transform active:scale-[0.97]"
          >
            <span
              className={`mb-2 flex h-11 w-11 items-center justify-center rounded-mc-md ${TONE_CHIP[tone]}`}
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" strokeWidth={1.9} />
            </span>
            {/* Both lines truncate in a 140px card, so both carry the full
                text on hover. */}
            <span
              className="block w-full truncate text-[13px] font-extrabold text-mc-text"
              title={label}
            >
              {label}
            </span>
            <span
              className="block w-full truncate text-[11px] font-medium text-mc-text-3"
              title={hint}
            >
              {hint}
            </span>
            <ArrowRight
              className="mt-auto h-4 w-4 text-mc-brand transition-transform group-active:translate-x-0.5"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
