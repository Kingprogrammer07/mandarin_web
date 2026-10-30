import { useQuery } from '@tanstack/react-query';
import type { PickerBranch } from '@/components/delivery/UzpostBranchPicker';

/**
 * A BTS office from public/bts_branches.json (scraped from bts.uz/uz/nashi-ofisi;
 * the backend checks the code against its own copy of the same file).
 * Shaped like a UzPost branch so the same picker shows it; `index` is the BTS
 * code as a string because codes like "0101" keep their leading zero.
 */
export interface BtsBranch extends PickerBranch {
  index: string;
  region: string;
  district: string | null;
  landmark: string | null;
}

interface RawBtsBranch {
  code: string;
  name: string;
  region: string;
  district: string | null;
  address: string;
  landmark: string | null;
  hours: string | null;
  latitude: number;
  longitude: number;
}

export const BTS_BRANCHES_QUERY_KEY = ['bts-branches'] as const;

async function fetchBtsBranches(): Promise<BtsBranch[]> {
  const response = await fetch('/bts_branches.json', {
    headers: { Accept: 'application/json' },
    cache: 'force-cache',
  });
  // An unknown path comes back as index.html with 200 on Vercel; check the type.
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) {
    throw new Error("BTS filiallarini yuklab bo'lmadi");
  }
  const raw = (await response.json()) as RawBtsBranch[];
  return raw.map((b) => ({
    id: Number(b.code),
    index: b.code,
    name: b.name,
    address: [b.district, b.address].filter(Boolean).join(', '),
    latitude: b.latitude,
    longitude: b.longitude,
    workdays: b.hours,
    lunch: null,
    saturday: null,
    dayOff: null,
    otherScheduleNotes: b.landmark,
    region: b.region,
    district: b.district,
    landmark: b.landmark,
  }));
}

export function useBtsBranches(enabled = true) {
  return useQuery({
    queryKey: BTS_BRANCHES_QUERY_KEY,
    queryFn: fetchBtsBranches,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

const LAST_BTS_BRANCH_KEY = 'mc:last_bts_branch';

/** The office this device sent to last time, so a repeat request is one tap. */
export function readLastBtsBranchCode(): string | null {
  try {
    return localStorage.getItem(LAST_BTS_BRANCH_KEY);
  } catch {
    return null;
  }
}

export function rememberBtsBranchCode(code: string): void {
  try {
    localStorage.setItem(LAST_BTS_BRANCH_KEY, code);
  } catch {
    // Private mode: nothing to remember, the picker still works.
  }
}
