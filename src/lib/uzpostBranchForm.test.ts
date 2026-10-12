import { describe, expect, it } from "vitest";

import { parseCoordinates, validateUzpostBranchForm } from "./uzpostBranchForm";

const valid = {
  name: "Yangi filial",
  postcodeIndex: "100215",
  address: "Toshkent, Yunusobod 5",
  coordinates: "41.3111, 69.2797",
  workdays: "",
};

describe("parseCoordinates", () => {
  it("reads typed pairs", () => {
    expect(parseCoordinates("41.3111, 69.2797")).toEqual({
      latitude: 41.3111,
      longitude: 69.2797,
    });
    expect(parseCoordinates(" 41.3 69.2 ")).toEqual({ latitude: 41.3, longitude: 69.2 });
  });

  it("reads Google Maps links, preferring the pin over the view", () => {
    expect(
      parseCoordinates(
        "https://www.google.com/maps/place/X/@41.30,69.20,17z/data=!3m1!4b1!4m6!3m5!1s0x0!8m2!3d41.3111!4d69.2797",
      ),
    ).toEqual({ latitude: 41.3111, longitude: 69.2797 });
    expect(parseCoordinates("https://www.google.com/maps/@41.31,69.27,15z")).toEqual({
      latitude: 41.31,
      longitude: 69.27,
    });
    expect(parseCoordinates("https://maps.google.com/?q=41.31,69.27")).toEqual({
      latitude: 41.31,
      longitude: 69.27,
    });
  });

  it("returns null for text without a point", () => {
    expect(parseCoordinates("")).toBeNull();
    expect(parseCoordinates("Toshkent")).toBeNull();
  });
});

describe("validateUzpostBranchForm", () => {
  it("accepts a complete branch", () => {
    expect(validateUzpostBranchForm(valid)).toEqual({});
  });

  it("asks for exactly six index digits", () => {
    expect(validateUzpostBranchForm({ ...valid, postcodeIndex: "10021" }).postcodeIndex).toBe(
      "Indeks 6 ta raqamdan iborat bo'lishi kerak.",
    );
    expect(validateUzpostBranchForm({ ...valid, postcodeIndex: "10021a" }).postcodeIndex).toBeTruthy();
  });

  it("catches swapped coordinates", () => {
    expect(
      validateUzpostBranchForm({ ...valid, coordinates: "69.2797, 41.3111" }).coordinates,
    ).toContain("tashqarida");
  });

  it("requires a name and an address", () => {
    const errors = validateUzpostBranchForm({ ...valid, name: " ", address: "" });
    expect(errors.name).toBeTruthy();
    expect(errors.address).toBeTruthy();
  });
});
