import { createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/api/services/cargo", () => ({ exportFlightCargoExcel: vi.fn() }));

import type { SendTaskState } from "@/api/services/flightNotifications";
import { exportFlightCargoExcel } from "@/api/services/cargo";

import { SendProgressDialog } from "./SendProgressDialog";
import { makeTask } from "./testData";

const exportExcel = vi.mocked(exportFlightCargoExcel);

function renderDialog(taskState: SendTaskState | null) {
  const handlers = {
    onCancel: vi.fn(),
    onRetryPolling: vi.fn(),
    onClose: vi.fn(),
  };
  const view = render(
    <SendProgressDialog
      taskState={taskState}
      flightName="M284"
      isCancelling={false}
      pollFailed={false}
      {...handlers}
    />,
  );
  const rerender = (next: SendTaskState | null, pollFailed = false) =>
    view.rerender(
      <SendProgressDialog
        taskState={next}
        flightName="M284"
        isCancelling={false}
        pollFailed={pollFailed}
        {...handlers}
      />,
    );
  return { ...handlers, rerender };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SendProgressDialog", () => {
  it("renders nothing without a task", () => {
    renderDialog(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a labelled modal that announces progress", () => {
    renderDialog(makeTask());
    const dialog = screen.getByRole("dialog", { name: "Yuborilmoqda..." });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(/M284/);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    expect(screen.getByText("40% — 4/10")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("ignores Escape while running and closes on Escape once done", () => {
    const { onClose, rerender } = renderDialog(makeTask());
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Yopish" }),
    ).not.toBeInTheDocument();

    rerender(
      makeTask({ status: "completed", sent: 9, failed: 1, percent: 100 }),
    );
    expect(
      screen.getByRole("dialog", { name: "Yuborish yakunlandi" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The page then only hides it: the send stays tracked (see the page test).
  it("can be closed once progress polling has failed", () => {
    const { onClose, onRetryPolling, rerender } = renderDialog(makeTask());
    rerender(makeTask(), true);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Yuborish holatini olib bo'lmadi",
    );
    fireEvent.click(screen.getByRole("button", { name: /Qayta tekshirish/ }));
    expect(onRetryPolling).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hands the focus to the given element once it closes", async () => {
    const target = createRef<HTMLButtonElement>();
    const view = render(
      <>
        <button ref={target} type="button">
          Ro'yxat
        </button>
        <SendProgressDialog
          taskState={makeTask({ status: "completed", percent: 100 })}
          flightName="M284"
          isCancelling={false}
          pollFailed={false}
          onCancel={vi.fn()}
          onRetryPolling={vi.fn()}
          onClose={vi.fn()}
          returnFocusRef={target}
        />
      </>,
    );
    view.rerender(
      <>
        <button ref={target} type="button">
          Ro'yxat
        </button>
        <SendProgressDialog
          taskState={null}
          flightName="M284"
          isCancelling={false}
          pollFailed={false}
          onCancel={vi.fn()}
          onRetryPolling={vi.fn()}
          onClose={vi.fn()}
          returnFocusRef={target}
        />
      </>,
    );

    await waitFor(() => expect(document.activeElement).toBe(target.current));
  });

  it("asks before stopping a running send", () => {
    const { onCancel } = renderDialog(makeTask());
    fireEvent.click(screen.getByRole("button", { name: "To'xtatish" }));
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Davom etish" }));
    fireEvent.click(screen.getByRole("button", { name: "To'xtatish" }));
    fireEvent.click(screen.getByRole("button", { name: "Ha, to'xtatish" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows the cancelled title, the error list and export errors when done", async () => {
    exportExcel.mockRejectedValueOnce({ message: "rate_limit" });
    const { onClose } = renderDialog(
      makeTask({
        status: "failed",
        errors: [{ client_id: "M007", error: "Bot bloklangan" }],
      }),
    );
    expect(
      screen.getByRole("dialog", { name: "Yuborish to'xtatildi" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Xatolar" })).toHaveTextContent(
      "M007: Bot bloklangan",
    );

    fireEvent.click(screen.getByRole("button", { name: /Excel yuklab olish/ }));
    expect(exportExcel).toHaveBeenCalledWith("M284");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "1 daqiqa kuting (limit)",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Yopish" })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
