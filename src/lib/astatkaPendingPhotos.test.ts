import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/services/astatkaFlights", () => ({
  getAstatkaPackagePhotos: vi.fn(),
  replaceAstatkaPackagePhotos: vi.fn(),
}));

import {
  getAstatkaPackagePhotos,
  replaceAstatkaPackagePhotos,
  type AstatkaCargoPhoto,
  type AstatkaPackagePhotosResult,
} from "@/api/services/astatkaFlights";

import { PendingPhotosError, savePendingPhotos } from "./astatkaPendingPhotos";

const existing = vi.mocked(getAstatkaPackagePhotos);
const put = vi.mocked(replaceAstatkaPackagePhotos);

const photos = (count: number): AstatkaCargoPhoto[] =>
  Array.from({ length: count }, (_, index) => ({ index, url: `https://f/${index}`, error: null }));
const answer = { package: { id: 41 }, photos: [] } as unknown as AstatkaPackagePhotosResult;
const files = (count: number) =>
  Array.from({ length: count }, (_, index) => new File([String(index)], `${index}.jpg`));

beforeEach(() => {
  vi.clearAllMocks();
  put.mockResolvedValue(answer);
});

describe("savePendingPhotos", () => {
  it("sends every photo in one request to a bag without photos", async () => {
    existing.mockResolvedValue([]);
    const taken = files(3);

    await expect(savePendingPhotos("OSTATKA.1", 41, taken)).resolves.toEqual({
      result: answer,
      saved: 3,
      skipped: 0,
    });
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith("OSTATKA.1", 41, taken);
  });

  it("adds onto the end of a bag that has photos, never over them", async () => {
    existing.mockResolvedValue(photos(2));
    const taken = files(2);

    await savePendingPhotos("OSTATKA.1", 41, taken);

    expect(put.mock.calls).toEqual([
      ["OSTATKA.1", 41, [taken[0]], 2],
      ["OSTATKA.1", 41, [taken[1]], 3],
    ]);
  });

  it("leaves out what the bag has no room for", async () => {
    existing.mockResolvedValue(photos(9));

    const outcome = await savePendingPhotos("OSTATKA.1", 41, files(3));

    expect(outcome).toMatchObject({ saved: 1, skipped: 2 });
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("says how many landed when a later one fails", async () => {
    existing.mockResolvedValue(photos(1));
    const failure = new Error("network");
    put.mockResolvedValueOnce(answer).mockRejectedValueOnce(failure);

    const error = await savePendingPhotos("OSTATKA.1", 41, files(3)).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(PendingPhotosError);
    expect(error).toMatchObject({ saved: 1, reason: failure });
  });
});
