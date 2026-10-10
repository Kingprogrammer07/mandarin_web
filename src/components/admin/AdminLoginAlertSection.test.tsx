import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/api/services/systemService", () => ({
  systemService: {
    getAdminLoginAlert: vi.fn(),
    updateAdminLoginAlert: vi.fn(),
    checkAdminLoginAlertChat: vi.fn(),
  },
}));

import { systemService } from "@/api/services/systemService";
import AdminLoginAlertSection from "./AdminLoginAlertSection";

const service = vi.mocked(systemService);

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminLoginAlertSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminLoginAlertSection", () => {
  it("will not switch the group mode on without a group id", async () => {
    service.getAdminLoginAlert.mockResolvedValue({ chat_id: null, to_group: false });
    renderSection();

    fireEvent.click(await screen.findByRole("checkbox"));

    expect(screen.getByText("Guruhga yuborish uchun guruh ID kiriting.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Saqlash/ })).toHaveProperty("disabled", true);
  });

  it("saves the group id and the switch together", async () => {
    service.getAdminLoginAlert.mockResolvedValue({ chat_id: null, to_group: false });
    service.updateAdminLoginAlert.mockResolvedValue({
      chat_id: -1001234567890,
      to_group: true,
    });
    renderSection();

    fireEvent.change(await screen.findByPlaceholderText("-1001234567890"), {
      target: { value: " -1001234567890 " },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Saqlash/ }));

    await waitFor(() =>
      expect(service.updateAdminLoginAlert).toHaveBeenCalledWith({
        chat_id: -1001234567890,
        to_group: true,
      }),
    );
    expect(await screen.findByText("Guruhga")).toBeTruthy();
  });

  it("shows which way the notices go now", async () => {
    service.getAdminLoginAlert.mockResolvedValue({ chat_id: -100777, to_group: false });
    renderSection();

    expect(await screen.findByText("Adminlarga")).toBeTruthy();
    expect(screen.getByDisplayValue("-100777")).toBeTruthy();
  });
});
