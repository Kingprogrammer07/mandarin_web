import { useQuery } from '@tanstack/react-query';
import type { UzpostBranch } from '@/types/uzpostBranch';

interface RawUzpostBranch {
  ID?: unknown;
  Name?: unknown;
  Index?: unknown;
  Address?: unknown;
  Longitude?: unknown;
  Latitude?: unknown;
  Workdays?: unknown;
  Lunch?: unknown;
  Saturday?: unknown;
  'Day off'?: unknown;
  'Other schedule notes'?: unknown;
}

const UZPOST_BRANCHES_QUERY_KEY = ['uzpost-branches'] as const;

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBranch(rawBranch: RawUzpostBranch): UzpostBranch | null {
  const id = readNumber(rawBranch.ID);
  const index = readNumber(rawBranch.Index);
  const longitude = readNumber(rawBranch.Longitude);
  const latitude = readNumber(rawBranch.Latitude);
  const address = readText(rawBranch.Address);
  // 172 of the 1593 branches carry no `Name` key at all, and they are not
  // scattered: every branch in Surxondaryo (93) and Xorazm (66) is missing one.
  // Requiring a name dropped those regions out of the picker entirely, so a
  // client in Termiz or Urganch was offered nothing to choose. The address
  // already reads as a place ("Surxondaryo, Termiz, Shodlik, Tarakkiyot 13"),
  // so it stands in as the label rather than the branch disappearing.
  const name = readText(rawBranch.Name) ?? address;

  // Address is still required: the 16 branches without one have no label and
  // nothing to show a courier either, so there is nothing to offer.
  if (!id || !index || !longitude || !latitude || !name || !address) {
    return null;
  }

  return {
    id,
    name,
    index,
    address,
    longitude,
    latitude,
    workdays: readText(rawBranch.Workdays),
    lunch: readText(rawBranch.Lunch),
    saturday: readText(rawBranch.Saturday),
    dayOff: readText(rawBranch['Day off']),
    otherScheduleNotes: readText(rawBranch['Other schedule notes']),
  };
}

async function fetchUzpostBranches(): Promise<UzpostBranch[]> {
  // The branches file is large and effectively static across sessions; force
  // the browser HTTP cache so repeated calculator opens do not retrigger an
  // Edge Request.
  const response = await fetch('/uzpost_branches_full.json', {
    headers: { Accept: 'application/json, text/plain' },
    cache: 'force-cache',
  });

  if (!response.ok) {
    throw new Error('UzPost filiallarini yuklab bolmadi');
  }

  // A missing file does NOT arrive as a 404 in production: Vercel falls the
  // unmatched path through to the SPA and serves index.html with a 200, so
  // `response.ok` passes and JSON.parse dies on "<!doctype html>" instead.
  // Dev hides this — Vite's fallback keys on `Accept: text/html` and 404s.
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    throw new Error('UzPost filiallar fayli topilmadi');
  }

  const parsedData: unknown = JSON.parse(await response.text());

  if (!Array.isArray(parsedData)) {
    throw new Error('UzPost filiallari notogri formatda');
  }

  return parsedData
    .map((item) => normalizeBranch(item as RawUzpostBranch))
    .filter((branch): branch is UzpostBranch => branch !== null);
}

export function useUzpostBranches(enabled = true) {
  return useQuery({
    queryKey: UZPOST_BRANCHES_QUERY_KEY,
    queryFn: fetchUzpostBranches,
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
