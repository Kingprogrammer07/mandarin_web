import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UzPostLabelSettings } from "@/api/services/warehouse";
import {
  shouldAskLabelCopies,
  useUzPostLabelCopiesGate,
} from "./useUzPostLabelCopiesGate";

const query = vi.hoisted(() => ({
  data: undefined as UzPostLabelSettings | undefined,
}));

vi.mock("@/api/hooks/useWarehouse", () => ({
  useUzPostLabelSettings: () => ({ data: query.data }),
}));

function settings(
  overrides: Partial<UzPostLabelSettings> = {},
): UzPostLabelSettings {
  return {
    copies: null,
    can_configure: true,
    min_copies: 1,
    max_copies: 5,
    ...overrides,
  };
}

describe("shouldAskLabelCopies", () => {
  it("asks the person who may decide, while nothing is decided", () => {
    expect(shouldAskLabelCopies(settings())).toBe(true);
  });

  it("never asks again once a count is saved", () => {
    expect(shouldAskLabelCopies(settings({ copies: 2 }))).toBe(false);
  });

  it("never asks anyone who may not decide", () => {
    expect(shouldAskLabelCopies(settings({ can_configure: false }))).toBe(
      false,
    );
  });

  it("never holds a print up while the setting is unknown", () => {
    expect(shouldAskLabelCopies(undefined)).toBe(false);
  });
});

describe("useUzPostLabelCopiesGate", () => {
  beforeEach(() => {
    query.data = undefined;
  });

  it("prints straight away when there is nothing to ask", () => {
    query.data = settings({ copies: 2 });
    const print = vi.fn();
    const { result } = renderHook(() => useUzPostLabelCopiesGate());

    act(() => result.current.guard(print));

    expect(print).toHaveBeenCalledTimes(1);
    expect(result.current.dialog.open).toBe(false);
  });

  it("holds the print until the question is answered, then prints once", () => {
    query.data = settings();
    const print = vi.fn();
    const { result } = renderHook(() => useUzPostLabelCopiesGate());

    act(() => result.current.guard(print));
    expect(print).not.toHaveBeenCalled();
    expect(result.current.dialog.open).toBe(true);

    act(() => result.current.dialog.onDone());
    act(() => result.current.dialog.onDone());

    expect(print).toHaveBeenCalledTimes(1);
    expect(result.current.dialog.open).toBe(false);
  });

  it("drops the held print when the question is dismissed", () => {
    query.data = settings();
    const print = vi.fn();
    const { result } = renderHook(() => useUzPostLabelCopiesGate());

    act(() => result.current.guard(print));
    act(() => result.current.dialog.onCancel());
    act(() => result.current.dialog.onDone());

    expect(print).not.toHaveBeenCalled();
    expect(result.current.dialog.open).toBe(false);
  });
});
