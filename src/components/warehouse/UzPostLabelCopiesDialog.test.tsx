import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import UzPostLabelCopiesDialog from "./UzPostLabelCopiesDialog";

const mutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

vi.mock("@/api/hooks/useWarehouse", () => ({
  useUpdateUzPostLabelSettings: () => mutation,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

interface MutateCallbacks {
  onSuccess?: (settings: { copies: number | null }) => void;
  onError?: (error: unknown) => void;
}

function lastMutateCallbacks(): MutateCallbacks {
  const calls = mutation.mutate.mock.calls;
  return calls[calls.length - 1][1] as MutateCallbacks;
}

function renderDialog(
  props: Partial<ComponentProps<typeof UzPostLabelCopiesDialog>> = {},
) {
  const onDone = vi.fn();
  const onCancel = vi.fn();
  render(
    <UzPostLabelCopiesDialog
      open
      mode="ask"
      currentCopies={null}
      onDone={onDone}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onDone, onCancel };
}

beforeEach(() => {
  mutation.mutate.mockReset();
  mutation.isPending = false;
});

describe("UzPostLabelCopiesDialog", () => {
  it("saves nothing until a count is picked", () => {
    renderDialog();

    expect(
      screen.getByRole("button", { name: "Saqlash va davom etish" }),
    ).toBeDisabled();
  });

  it("saves the picked count, and only then lets the print carry on", () => {
    const { onDone } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "2 nusxa" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Saqlash va davom etish" }),
    );

    expect(mutation.mutate).toHaveBeenCalledWith(2, expect.any(Object));
    expect(onDone).not.toHaveBeenCalled();

    lastMutateCallbacks().onSuccess?.({ copies: 2 });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("keeps the question open when saving fails", () => {
    const { onDone, onCancel } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "3 nusxa" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Saqlash va davom etish" }),
    );
    lastMutateCallbacks().onError?.({ message: "Tarmoq xatosi" });

    expect(onDone).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Hozircha o'tkazib yuborish" }),
    ).toBeEnabled();
  });

  it("lets the print carry on unsaved when skipped", () => {
    const { onDone } = renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: "Hozircha o'tkazib yuborish" }),
    );

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mutation.mutate).not.toHaveBeenCalled();
  });

  it("does not offer to save the count that is already saved", () => {
    renderDialog({ mode: "change", currentCopies: 2 });

    expect(screen.getByRole("button", { name: "2 nusxa" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "4 nusxa" }));
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeEnabled();
  });

  it("cannot be dismissed while the save is in flight", () => {
    mutation.isPending = true;
    const { onCancel } = renderDialog({ mode: "change", currentCopies: 2 });

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    expect(onCancel).not.toHaveBeenCalled();
  });
});
