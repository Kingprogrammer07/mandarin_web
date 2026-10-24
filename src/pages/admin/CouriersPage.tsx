import { useState } from 'react';
import { Gauge, Lock, Map as MapIcon, type LucideIcon } from 'lucide-react';

import { getAdminJwtClaims } from '@/api/services/adminManagement';
import CourierDayBoard from '@/components/admin/couriers/CourierDayBoard';
import CourierMileageBoard from '@/components/admin/couriers/CourierMileageBoard';
import { triggerSoftHaptic } from '@/utils/haptics';

type Tab = 'map' | 'mileage';

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'map', label: 'Xarita', Icon: MapIcon },
  { id: 'mileage', label: 'Kilometrlar', Icon: Gauge },
];

/** Admin «Kuryerlar»: where each courier is, the road they took, and the month's kilometres. */
export default function CouriersPage() {
  const [tab, setTab] = useState<Tab>('map');
  const claims = getAdminJwtClaims();
  // Location history: the server refuses without this too; checked here so the
  // page explains itself instead of showing two failed requests.
  const allowed = claims.isSuperAdmin || claims.permissions.has('courier:monitor');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-mc-text">Kuryerlar</h1>
          <p className="mt-0.5 text-[12px] font-medium text-mc-text-2">Jonli joylashuv, kunlik yo'l va kilometrlar</p>
        </div>
        {allowed && (
          <div
            role="tablist"
            aria-label="Kuryerlar bo'limi"
            className="flex w-full rounded-mc-md border border-mc-border bg-mc-surface-2 p-1 sm:w-auto"
          >
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    triggerSoftHaptic();
                    setTab(id);
                  }}
                  className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-mc-sm px-4 text-[13px] font-extrabold transition-[transform,background-color] active:scale-[0.98] sm:flex-none ${
                    active ? 'bg-mc-surface text-mc-text shadow-[var(--mc-shadow-card)]' : 'text-mc-text-2'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.3} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!allowed ? (
        <section className="flex items-start gap-3 rounded-mc-lg border border-mc-border bg-mc-surface p-4 shadow-[var(--mc-shadow-card)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mc-surface-2 text-mc-text-2">
            <Lock className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold text-mc-text">Ruxsat yo'q</h2>
            <p className="mt-1 text-[12px] font-medium leading-relaxed text-mc-text-2">
              Bu sahifa kuryerlarning joylashuv tarixini ko'rsatadi, shuning uchun uni superadmin yoki «Rollar»
              bo'limida <span className="font-bold text-mc-text">courier:monitor</span> huquqi berilgan rol ko'radi.
            </p>
          </div>
        </section>
      ) : tab === 'map' ? (
        <CourierDayBoard />
      ) : (
        <CourierMileageBoard />
      )}
    </div>
  );
}
