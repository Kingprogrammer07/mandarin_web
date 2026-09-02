import { describe, expect, it } from "vitest";

import { suggestAstatkaName } from "./naming";

/**
 * The suggested name exists to stop the list fragmenting. The two stock-takes
 * done by hand were `A-OSTOTKA-05.08` and `A-OSTATKA-M-26.08` — two spellings
 * and two shapes — so what matters is that this always produces the same shape.
 */
describe("suggestAstatkaName", () => {
  it("pads single-digit days and months, so names sort as text", () => {
    // Without padding, OSTATKA-9.9 sorts after OSTATKA-10.9 in every list.
    expect(suggestAstatkaName(new Date(2026, 8, 2))).toBe("OSTATKA-02.09");
  });

  it("keeps two-digit dates as they are", () => {
    expect(suggestAstatkaName(new Date(2026, 11, 26))).toBe("OSTATKA-26.12");
  });

  it("counts months from one, not zero", () => {
    // A JS month is zero-based; a name that says 00 would be nonsense to read.
    expect(suggestAstatkaName(new Date(2026, 0, 1))).toBe("OSTATKA-01.01");
  });

  it("always produces the same shape", () => {
    const samples = [
      new Date(2026, 0, 1),
      new Date(2026, 5, 15),
      new Date(2026, 11, 31),
    ];
    for (const sample of samples) {
      expect(suggestAstatkaName(sample)).toMatch(/^OSTATKA-\d{2}\.\d{2}$/);
    }
  });
});
