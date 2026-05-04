import type { UzpostBranch } from '@/types/uzpostBranch';

const STORAGE_KEY = 'mandarin:lastUzpostBranch:v1';
const STORAGE_VERSION = 1;

interface SavedUzpostBranchPreference {
  version: typeof STORAGE_VERSION;
  savedAt: string;
  branch: Pick<UzpostBranch, 'id' | 'index' | 'name' | 'address'>;
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isSavedUzpostBranchPreference(value: unknown): value is SavedUzpostBranchPreference {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    version?: unknown;
    savedAt?: unknown;
    branch?: {
      id?: unknown;
      index?: unknown;
      name?: unknown;
      address?: unknown;
    };
  };

  return (
    candidate.version === STORAGE_VERSION &&
    typeof candidate.savedAt === 'string' &&
    typeof candidate.branch?.id === 'number' &&
    typeof candidate.branch.index === 'number' &&
    typeof candidate.branch.name === 'string' &&
    typeof candidate.branch.address === 'string'
  );
}

export function getSavedUzpostBranchId(): number | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const rawPreference = window.localStorage.getItem(STORAGE_KEY);
    if (!rawPreference) {
      return null;
    }

    const parsedPreference: unknown = JSON.parse(rawPreference);
    if (!isSavedUzpostBranchPreference(parsedPreference)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsedPreference.branch.id;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveUzpostBranchPreference(branch: UzpostBranch): void {
  if (!canUseLocalStorage()) {
    return;
  }

  const preference: SavedUzpostBranchPreference = {
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    branch: {
      id: branch.id,
      index: branch.index,
      name: branch.name,
      address: branch.address,
    },
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // Storage can be unavailable in private modes; the delivery flow should continue normally.
  }
}

export function clearSavedUzpostBranchPreference(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
