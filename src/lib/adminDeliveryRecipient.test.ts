import { describe, expect, it } from "vitest";
import {
  RECIPIENT_NAME_MAX_LENGTH,
  RECIPIENT_PHONE_MAX_LENGTH,
  normalizeRecipientName,
  recipientProblems,
  toRecipientPayload,
  type RecipientDraft,
} from "./adminDeliveryRecipient";

const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);
const LEFT_TO_RIGHT_ISOLATE = String.fromCodePoint(0x2066);
const FULL_WIDTH_VALI = String.fromCodePoint(0xff36, 0xff21, 0xff2c, 0xff29);

function draft(overrides: Partial<RecipientDraft> = {}): RecipientDraft {
  return {
    profileName: "Anvar Mijozov",
    typedName: null,
    phone: "+998901112233",
    ...overrides,
  };
}

describe("normalizeRecipientName", () => {
  it("cleans a name the way the backend stores it", () => {
    expect(normalizeRecipientName("  Vali \n  Aliyev ")).toBe("Vali Aliyev");
    expect(normalizeRecipientName(`Va${ZERO_WIDTH_SPACE}li`)).toBe("Vali");
    expect(normalizeRecipientName(FULL_WIDTH_VALI)).toBe("VALI");
  });
});

describe("recipientProblems", () => {
  it("accepts the account holder's own name and phone", () => {
    expect(recipientProblems(draft())).toEqual([]);
  });

  it("flags a chosen but empty name instead of falling back to the profile", () => {
    expect(recipientProblems(draft({ typedName: "   " }))).toEqual(["name-missing"]);
  });

  it("treats a typed name made only of invisible characters as empty", () => {
    expect(
      recipientProblems(draft({ typedName: `${ZERO_WIDTH_SPACE}${LEFT_TO_RIGHT_ISOLATE}` })),
    ).toEqual(["name-missing"]);
  });

  it("flags a missing name when the profile has none and nothing was typed", () => {
    expect(recipientProblems(draft({ profileName: "" }))).toEqual(["name-missing"]);
  });

  it("accepts the longest typed name the backend stores and flags one more character", () => {
    const longest = "A".repeat(RECIPIENT_NAME_MAX_LENGTH);
    expect(recipientProblems(draft({ typedName: longest }))).toEqual([]);
    expect(recipientProblems(draft({ typedName: `${longest}A` }))).toEqual([
      "name-too-long",
    ]);
  });

  it("does not hold the profile name to the typed-name rules, as the server does not", () => {
    const longProfileName = "A".repeat(RECIPIENT_NAME_MAX_LENGTH + 30);
    expect(recipientProblems(draft({ profileName: longProfileName }))).toEqual([]);
  });

  it("flags a typed name a spreadsheet would run as a formula", () => {
    expect(recipientProblems(draft({ typedName: "=1+1" }))).toEqual(["name-formula"]);
  });

  it("flags a cleared phone rather than sending the profile phone for someone else", () => {
    expect(recipientProblems(draft({ phone: "  " }))).toEqual(["phone-missing"]);
  });

  it("flags a phone longer than the endpoints accept", () => {
    const tooLong = "9".repeat(RECIPIENT_PHONE_MAX_LENGTH + 1);
    expect(recipientProblems(draft({ phone: tooLong }))).toEqual(["phone-too-long"]);
  });

  it("reports name and phone problems together", () => {
    expect(recipientProblems(draft({ typedName: "", phone: "" }))).toEqual([
      "name-missing",
      "phone-missing",
    ]);
  });
});

describe("toRecipientPayload", () => {
  it("sends only the phone while the profile name is used", () => {
    expect(toRecipientPayload(draft({ phone: " +998901112233 " }))).toEqual({
      phone_number: "+998901112233",
    });
  });

  it("sends a typed name the way the backend will store it", () => {
    expect(
      toRecipientPayload(draft({ typedName: "  Vali   Aliyev ", phone: "+998935551122" })),
    ).toEqual({ recipient_name: "Vali Aliyev", phone_number: "+998935551122" });
  });

  it("does not send a typed name that only repeats the profile name", () => {
    expect(toRecipientPayload(draft({ typedName: " anvar  MIJOZOV " }))).toEqual({
      phone_number: "+998901112233",
    });
  });
});
