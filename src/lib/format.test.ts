import { describe, it, expect } from "vitest"
import {
  getLocaleFromLanguage,
  formatNumberLocalized,
  formatCurrencySum,
  formatCurrencyUz,
} from "./format"

// These helpers are about to become the ONLY way money is rendered: 22 raw
// `toLocaleString` calls across three different locales are scheduled to be
// replaced by them. Locking current behaviour first means that migration can
// be judged by "did the output change", not by reading it.
//
// Assertions compare against Intl output computed the same way rather than
// against hardcoded strings, because the exact separator uz-UZ produces is a
// property of the ICU data in the runtime, not of our code. What we are
// pinning is the CONTRACT: which locale, how many decimals, what suffix.

const nbsp = (s: string) => s.replace(/\u00a0|\u202f/g, " ")

describe("getLocaleFromLanguage", () => {
  it("maps ru to ru-RU", () => {
    expect(getLocaleFromLanguage("ru")).toBe("ru-RU")
  })

  it("defaults to uz-UZ for uz, unknown and undefined", () => {
    expect(getLocaleFromLanguage("uz")).toBe("uz-UZ")
    expect(getLocaleFromLanguage("en")).toBe("uz-UZ")
    expect(getLocaleFromLanguage(undefined)).toBe("uz-UZ")
  })
})

describe("formatCurrencyUz", () => {
  it("renders whole so'm with no decimals", () => {
    expect(formatCurrencyUz(2_300_000)).toBe(
      new Intl.NumberFormat("uz-UZ", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(2_300_000) + " so'm",
    )
  })

  it("never shows a decimal part, even for fractional input", () => {
    expect(formatCurrencyUz(149.5)).not.toContain(".")
    expect(formatCurrencyUz(149.5)).not.toContain(",")
  })

  it("groups thousands rather than printing a bare number", () => {
    expect(nbsp(formatCurrencyUz(1_000_000))).not.toBe("1000000 so'm")
  })

  it("handles zero and negatives without losing the suffix", () => {
    expect(formatCurrencyUz(0)).toContain("so'm")
    expect(formatCurrencyUz(-5000)).toContain("so'm")
    expect(formatCurrencyUz(-5000)).toMatch(/^-|^−/)
  })
})

describe("formatCurrencySum", () => {
  it("always shows exactly two decimals", () => {
    // The debt that started the NBU minimum work: 149.5 must not render as 149.5
    // in one place and 149.50 in another.
    expect(formatCurrencySum(149.5)).toMatch(/[.,]50\b/)
    expect(formatCurrencySum(1000)).toMatch(/[.,]00\b/)
  })

  it("switches locale with the language argument", () => {
    const uz = formatCurrencySum(1234.5, "uz")
    const ru = formatCurrencySum(1234.5, "ru")
    expect(uz).toBe(
      new Intl.NumberFormat("uz-UZ", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(1234.5) + " so'm",
    )
    expect(ru).toBe(
      new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(1234.5) + " so'm",
    )
  })

  it("defaults the suffix to so'm and honours an override", () => {
    expect(formatCurrencySum(10)).toContain("so'm")
    expect(formatCurrencySum(10, "uz", "USD")).toContain("USD")
    expect(formatCurrencySum(10, "uz", "USD")).not.toContain("so'm")
  })
})

describe("formatNumberLocalized", () => {
  it("groups without adding a currency suffix", () => {
    const out = formatNumberLocalized(1_234_567)
    expect(out).not.toContain("so'm")
    expect(nbsp(out)).not.toBe("1234567")
  })
})

describe("money formatting invariants", () => {
  // The failure this suite exists to prevent: the same amount rendering
  // differently on two screens. Whatever the ICU output is, it must be stable.
  it("is deterministic for the same input", () => {
    expect(formatCurrencyUz(87_362)).toBe(formatCurrencyUz(87_362))
    expect(formatCurrencySum(87_362)).toBe(formatCurrencySum(87_362))
  })

  it("does not use US grouping for so'm", () => {
    // en-US would give "2,300,000.00". uz-UZ must not.
    const enUs = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(2_300_000)
    expect(formatCurrencySum(2_300_000)).not.toContain(enUs)
  })
})
