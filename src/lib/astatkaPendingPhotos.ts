import {
  getAstatkaPackagePhotos,
  replaceAstatkaPackagePhotos,
  type AstatkaPackagePhotosResult,
} from "@/api/services/astatkaFlights";

/** Same ceiling the server enforces on a bag's own photos. */
export const MAX_OWN_PHOTOS = 10;

export interface PendingPhotosSaved {
  /** The bag and its photos as the server holds them now; null if nothing was sent. */
  result: AstatkaPackagePhotosResult | null;
  saved: number;
  /** Photos left out because the bag already had the most it may hold. */
  skipped: number;
}

/** A save that stopped part-way: the first `saved` photos are on the bag. */
export class PendingPhotosError extends Error {
  readonly saved: number;
  readonly reason: unknown;

  constructor(reason: unknown, saved: number) {
    super(reason instanceof Error ? reason.message : "Rasmlarni saqlab bo'lmadi.");
    this.name = "PendingPhotosError";
    this.reason = reason;
    this.saved = saved;
  }
}

/**
 * Hand photos taken before a bag was confirmed to the bag, now that it is
 * saved. They are added to whatever the bag already has, never in place of
 * it: the confirm may have joined a bag someone photographed earlier. A bag
 * with no photos yet gets all of them in one request; otherwise they go one
 * by one onto the end, the only way the server adds without replacing.
 */
export async function savePendingPhotos(
  flightName: string,
  packageId: number,
  files: File[],
): Promise<PendingPhotosSaved> {
  const existing = (await getAstatkaPackagePhotos(flightName, packageId)).length;
  const batch = files.slice(0, Math.max(0, MAX_OWN_PHOTOS - existing));
  const skipped = files.length - batch.length;
  if (batch.length === 0) return { result: null, saved: 0, skipped };
  if (existing === 0) {
    const result = await replaceAstatkaPackagePhotos(flightName, packageId, batch);
    return { result, saved: batch.length, skipped };
  }
  let result: AstatkaPackagePhotosResult | null = null;
  let saved = 0;
  for (const file of batch) {
    try {
      result = await replaceAstatkaPackagePhotos(flightName, packageId, [file], existing + saved);
    } catch (error) {
      throw new PendingPhotosError(error, saved);
    }
    saved += 1;
  }
  return { result, saved, skipped };
}
