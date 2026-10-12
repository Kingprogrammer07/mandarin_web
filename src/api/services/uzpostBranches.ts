import { apiClient } from "../client";

/** An added branch as the server returns it: the catalogue file's own shape. */
export interface AddedUzpostBranchEntry {
  ID: number;
  Name: string;
  Index: number;
  Address: string;
  Longitude: number;
  Latitude: number;
  Workdays: string | null;
  Custom: true;
}

export interface AddUzpostBranchPayload {
  name: string;
  postcode_index: string;
  address: string;
  latitude: number;
  longitude: number;
  workdays?: string | null;
}

/** The 409 body when the index is already listed. */
export interface UzpostBranchConflict {
  message: string;
  branch_id: number;
  name: string | null;
  address: string | null;
}

export async function getAddedUzpostBranches(): Promise<AddedUzpostBranchEntry[]> {
  const response = await apiClient.get<AddedUzpostBranchEntry[]>(
    "/api/v1/uzpost-branches/custom",
  );
  return response.data;
}

export async function addUzpostBranch(
  payload: AddUzpostBranchPayload,
): Promise<AddedUzpostBranchEntry> {
  const response = await apiClient.post<AddedUzpostBranchEntry>(
    "/api/v1/uzpost-branches/custom",
    payload,
  );
  return response.data;
}

export async function hideUzpostBranch(branchId: number): Promise<void> {
  await apiClient.delete(`/api/v1/uzpost-branches/custom/${branchId}`);
}

/** The listed branch a refused add points at, if the refusal was a duplicate. */
export function uzpostBranchConflict(error: unknown): UzpostBranchConflict | null {
  const detail = (error as { status?: number; data?: { detail?: unknown } })?.data
    ?.detail;
  if ((error as { status?: number })?.status !== 409) return null;
  if (!detail || typeof detail !== "object") return null;
  const conflict = detail as Partial<UzpostBranchConflict>;
  return typeof conflict.branch_id === "number"
    ? {
        message: String(conflict.message ?? ""),
        branch_id: conflict.branch_id,
        name: conflict.name ?? null,
        address: conflict.address ?? null,
      }
    : null;
}
