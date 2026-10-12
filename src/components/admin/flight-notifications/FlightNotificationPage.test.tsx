import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/api/services/flightNotifications", () => ({
  getNotificationSummary: vi.fn(),
  startSendNotifications: vi.fn(),
  getSendTaskState: vi.fn(),
  getActiveSendTask: vi.fn(),
  cancelSendTask: vi.fn(),
  addForgottenCargo: vi.fn(),
}));
vi.mock("@/api/services/cargo", () => ({ exportFlightCargoExcel: vi.fn() }));
// The forgotten-cargo form (camera, photo picker) is not under test here.
vi.mock("@/components/admin/ForgottenCargoModal", () => ({
  default: () => null,
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  },
}));

import { toast } from "sonner";

import {
  getActiveSendTask,
  getNotificationSummary,
  getSendTaskState,
  startSendNotifications,
} from "@/api/services/flightNotifications";
import FlightNotificationPage from "@/pages/admin/FlightNotificationPage";

import { MAX_POLL_FAILURES, POLL_INTERVAL_MS } from "./sendTask";
import { makeClient, makeSummary, makeTask } from "./testData";

const summaryApi = vi.mocked(getNotificationSummary);
const startApi = vi.mocked(startSendNotifications);
const taskStateApi = vi.mocked(getSendTaskState);
const activeTaskApi = vi.mocked(getActiveSendTask);

function renderPage(fullScreen = false) {
  return render(
    <FlightNotificationPage
      flightName="M284"
      onBack={vi.fn()}
      fullScreen={fullScreen}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  activeTaskApi.mockResolvedValue(null);
});

afterEach(() => {
  localStorage.clear();
});

describe("FlightNotificationPage", () => {
  it("shows an error card with retry when the list fails to load, then recovers", async () => {
    summaryApi
      .mockRejectedValueOnce({ message: "Server xatosi", status: 500 })
      .mockResolvedValueOnce(makeSummary([makeClient({ client_id: "M001" })]));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Mijozlar ro'yxatini yuklab bo'lmadi");
    expect(alert).toHaveTextContent("Server xatosi");
    // A failed load must never claim the flight has no clients.
    expect(
      screen.queryByText("Bu reysda mijozlar yo'q"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Mos mijoz topilmadi")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Qayta urinish/ }));

    expect(
      await screen.findByRole("checkbox", { name: /M001/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(summaryApi).toHaveBeenCalledTimes(2);
  });

  it("sends the selected clients with the chosen channels", async () => {
    summaryApi.mockResolvedValue(
      makeSummary([
        makeClient({ client_id: "M001" }),
        makeClient({ client_id: "M002" }),
        makeClient({ client_id: "M003" }),
      ]),
    );
    startApi.mockResolvedValue({
      task_id: "task-1",
      total_clients: 2,
      message: "ok",
    });
    renderPage();

    const first = await screen.findByRole("checkbox", { name: /M001/ });
    fireEvent.click(first);
    fireEvent.click(screen.getByRole("checkbox", { name: /M003/ }));
    expect(first).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("checkbox", { name: /Barchasini tanlash/ }),
    ).toHaveAttribute("aria-checked", "mixed");

    fireEvent.click(screen.getByRole("checkbox", { name: "Bot" }));
    fireEvent.click(screen.getByRole("button", { name: "Yuborish (2)" }));

    await waitFor(() =>
      expect(startApi).toHaveBeenCalledWith("M284", {
        client_ids: ["M001", "M003"],
        only_pending: false,
        mark_bot: true,
        mark_web: true,
      }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Yuborilmoqda..." }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("cargo_send_task:M284")).toBe("task-1");
  });

  it("warns before re-sending to a client that was already notified", async () => {
    summaryApi.mockResolvedValue(
      makeSummary([
        makeClient({ client_id: "M001", is_sent: true, is_sent_web: true }),
      ]),
    );
    startApi.mockResolvedValue({
      task_id: "task-2",
      total_clients: 1,
      message: "ok",
    });
    renderPage();

    fireEvent.click(await screen.findByRole("checkbox", { name: /M001/ }));
    fireEvent.click(screen.getByRole("button", { name: "Yuborish (1)" }));

    const dialog = await screen.findByRole("alertdialog", {
      name: "1 ta mijoz allaqachon yuborilgan",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      within(dialog).getByRole("list", {
        name: "Allaqachon yuborilgan mijozlar",
      }),
    ).toHaveTextContent("M001");
    // A stray Enter must not send twice: the focus starts on the way out.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole("button", { name: "Bekor qilish" }),
      ),
    );
    expect(startApi).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Ha, qayta yuborish" }),
    );
    await waitFor(() => expect(startApi).toHaveBeenCalledTimes(1));
  });

  it("lists many re-sends in a scrolling body and sends nothing on Bekor qilish", async () => {
    const clients = Array.from({ length: 80 }, (_, index) =>
      makeClient({
        client_id: `M${String(index + 1).padStart(3, "0")}`,
        is_sent: true,
        is_sent_bot: true,
      }),
    );
    summaryApi.mockResolvedValue(makeSummary(clients));
    renderPage();

    await screen.findByRole("checkbox", { name: /M001/ });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Barchasini tanlash/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Yuborish (80)" }));

    const dialog = await screen.findByRole("alertdialog", {
      name: "80 ta mijoz allaqachon yuborilgan",
    });
    const list = within(dialog).getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(80);
    // The list scrolls between a fixed header and fixed buttons.
    expect(list).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Bekor qilish" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(startApi).not.toHaveBeenCalled();
  });

  it("keeps a send it lost track of blocked, and can bring its progress back", async () => {
    vi.useFakeTimers({
      toFake: ["setInterval", "clearInterval"],
      shouldAdvanceTime: true,
    });
    try {
      summaryApi.mockResolvedValue(
        makeSummary([
          makeClient({ client_id: "M001" }),
          makeClient({ client_id: "M002" }),
        ]),
      );
      startApi.mockResolvedValue({
        task_id: "task-1",
        total_clients: 1,
        message: "ok",
      });
      taskStateApi.mockRejectedValue({ message: "Network Error" });
      renderPage();

      fireEvent.click(await screen.findByRole("checkbox", { name: /M001/ }));
      fireEvent.click(screen.getByRole("button", { name: "Yuborish (1)" }));
      await screen.findByRole("dialog", { name: "Yuborilmoqda..." });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * MAX_POLL_FAILURES);
      });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Yuborish holatini olib bo'lmadi",
      );
      fireEvent.click(screen.getByRole("button", { name: "Yopish" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      // Still running on the server: tracked, and no second send can start.
      expect(localStorage.getItem("cargo_send_task:M284")).toBe("task-1");
      fireEvent.click(screen.getByRole("checkbox", { name: /M002/ }));
      expect(
        screen.getByRole("button", { name: "Yuborish (2)" }),
      ).toBeDisabled();

      taskStateApi.mockResolvedValue(makeTask());
      fireEvent.click(
        screen.getByRole("button", { name: /Yuborish davom etmoqda/ }),
      );
      expect(
        await screen.findByRole("dialog", { name: "Yuborilmoqda..." }),
      ).toBeInTheDocument();
      expect(startApi).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not send without a channel and says why with an icon and text", async () => {
    summaryApi.mockResolvedValue(
      makeSummary([makeClient({ client_id: "M001" })]),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("checkbox", { name: /M001/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Web" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kamida bittasini tanlang",
    );

    fireEvent.click(screen.getByRole("button", { name: "Yuborish (1)" }));
    expect(startApi).not.toHaveBeenCalled();
  });

  it("says so when refreshing an empty flight fails", async () => {
    summaryApi
      .mockResolvedValueOnce(makeSummary([]))
      .mockRejectedValueOnce({ message: "Server xatosi", status: 500 });
    renderPage();

    const list = await screen.findByRole("region", {
      name: "Mijozlar ro'yxati",
    });
    await within(list).findByText("Bu reysda mijozlar yo'q");
    fireEvent.click(within(list).getByRole("button", { name: "Yangilash" }));

    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Server xatosi"),
    );
  });

  it("tells an empty flight apart from a search with no match", async () => {
    summaryApi.mockResolvedValueOnce(makeSummary([]));
    const { unmount } = renderPage();
    expect(
      await screen.findByText("Bu reysda mijozlar yo'q"),
    ).toBeInTheDocument();
    unmount();

    summaryApi.mockResolvedValueOnce(
      makeSummary([makeClient({ client_id: "M001" })]),
    );
    renderPage();
    await screen.findByRole("checkbox", { name: /M001/ });

    fireEvent.change(screen.getByLabelText("Mijoz kodini qidirish"), {
      target: { value: "ZZZ" },
    });
    expect(screen.getByText("Mos mijoz topilmadi")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Filtrni tozalash/ }));
    expect(screen.getByRole("checkbox", { name: /M001/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hammasi" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("selects every pending client of the flight, across filter and pages", async () => {
    const clients = Array.from({ length: 35 }, (_, index) =>
      makeClient({
        client_id: `M${String(index + 1).padStart(3, "0")}`,
        is_sent: index % 5 === 0,
      }),
    );
    summaryApi.mockResolvedValue(makeSummary(clients));
    renderPage();

    await screen.findByRole("checkbox", { name: /M001/ });
    expect(
      screen.getByRole("navigation", { name: "Sahifalar" }),
    ).toHaveTextContent("1 / 2");
    fireEvent.click(screen.getByRole("button", { name: /Yuborilmaganlar/ }));
    expect(
      screen.getByRole("button", { name: "Yuborish (28)" }),
    ).toBeInTheDocument();
  });

  it("shows a send recovered after reload even while the list is still loading", async () => {
    localStorage.setItem("cargo_send_task:M284", "task-9");
    taskStateApi.mockResolvedValue(makeTask({ task_id: "task-9" }));
    summaryApi.mockReturnValue(new Promise(() => {}));
    renderPage(true);

    expect(
      await screen.findByRole("dialog", { name: "Yuborilmoqda..." }),
    ).toBeInTheDocument();
    expect(taskStateApi).toHaveBeenCalledWith("task-9");
    expect(screen.getByText("Mijozlar yuklanmoqda")).toBeInTheDocument();
  });

  it("gives every icon-only control in the header a name", async () => {
    summaryApi.mockResolvedValue(makeSummary([]));
    renderPage(true);
    await screen.findByText("Bu reysda mijozlar yo'q");
    const header = within(screen.getByRole("banner"));
    expect(header.getByRole("button", { name: "Orqaga" })).toBeInTheDocument();
    expect(header.getByRole("button", { name: "Yangilash" })).toBeEnabled();
    // Full screen has no app navigation bar, so the theme switch moves here.
    expect(
      header.getByRole("button", { name: /rejimga o'tish/ }),
    ).toBeInTheDocument();
  });
});
