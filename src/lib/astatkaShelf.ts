import type { AstatkaShelfBag } from "@/api/services/warehouse";

/** A bag the regular «Berish» cannot give: its payment row already says taken. */
export function needsShelfHandout(bag: AstatkaShelfBag): boolean {
  return bag.state === "left_behind";
}
