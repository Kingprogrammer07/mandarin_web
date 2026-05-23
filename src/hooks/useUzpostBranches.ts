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
  const name = readText(rawBranch.Name);
  const address = readText(rawBranch.Address);

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
  const response = await fetch('/branches.json', {
    headers: { Accept: 'application/json, text/plain' },
    cache: 'force-cache',
  });

  if (!response.ok) {
    throw new Error('UzPost filiallarini yuklab bolmadi');
  }

  const rawText = await response.text();
  // The source file currently contains bare NaN values, which are not valid JSON.
  const jsonText = rawText.replace(/:\s*NaN(?=\s*[,}])/g, ': null');
  const parsedData: unknown = JSON.parse(jsonText);

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
