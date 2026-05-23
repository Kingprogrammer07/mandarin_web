/**
 * Shared logic for rendering the 6-step cargo tracking stepper.
 *
 * Both the public track result card and the client cargo history derive their
 * visual stepper from the same raw step statuses, so the mapping lives here to
 * keep them consistent.
 */

export type RawStepStatus = "available" | "pending" | "nodata";
export type VisualStepStatus = "completed" | "active" | "upcoming";

/**
 * Map ordered raw step statuses to per-step visual statuses for a linear
 * stepper.
 *
 * - `completed` — milestone reached (`available`).
 * - `active` — the first not-yet-reached milestone (the current frontier).
 * - `upcoming` — every milestone after the frontier.
 *
 * Only an `available` status marks a step done. A `pending` or `nodata` step is
 * never shown as completed just because a *later* step happens to be reached.
 * This fixes parcels (e.g. still in China) that previously showed every early
 * step as completed because a default-`pending` step 5 pulled the frontier to
 * the end.
 *
 * @param statuses Raw statuses in step order (index 0 = step 1).
 * @returns Visual statuses aligned by index to the input.
 */
export function deriveVisualStatuses(statuses: RawStepStatus[]): VisualStepStatus[] {
  // First milestone that is not yet reached — the active frontier. If every
  // step is reached, there is no active step (-1) and all map to completed.
  const frontierIndex = statuses.findIndex((status) => status !== "available");

  return statuses.map((status, index) => {
    if (status === "available") return "completed";
    if (index === frontierIndex) return "active";
    return "upcoming";
  });
}

/**
 * Completion percentage (0–100) = reached milestones / total milestones.
 *
 * Accepts either raw statuses (`available` counts as reached) or already-derived
 * visual statuses (`completed` counts as reached), so callers can pass whichever
 * they already hold.
 */
export function computeStepProgress(
  statuses: ReadonlyArray<RawStepStatus | VisualStepStatus>,
): number {
  if (statuses.length === 0) return 0;
  const reached = statuses.filter(
    (status) => status === "available" || status === "completed",
  ).length;
  return Math.round((reached / statuses.length) * 100);
}
