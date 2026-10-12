import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/api/services/uzpostBranches", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/services/uzpostBranches")>();
  return { ...actual, addUzpostBranch: vi.fn(), getAddedUzpostBranches: vi.fn() };
});

import { addUzpostBranch } from "@/api/services/uzpostBranches";
import AddUzpostBranchDialog from "./AddUzpostBranchDialog";

const add = vi.mocked(addUzpostBranch);

function renderDialog() {
  const onAdded = vi.fn();
  const onUseExisting = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["uzpost-branches"], []);
  render(
    <QueryClientProvider client={client}>
      <AddUzpostBranchDialog
        open
        onOpenChange={vi.fn()}
        onAdded={onAdded}
        onUseExisting={onUseExisting}
      />
    </QueryClientProvider>,
  );
  return { onAdded, onUseExisting, client };
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillValid() {
  fill("Filial nomi", "Toshkent 215-bo'lim");
  fill("Indeks", "100215");
  fill("Manzil", "Toshkent, Yunusobod 5");
  fill(
    "Koordinata yoki Google Maps havolasi",
    "https://www.google.com/maps/place/X/@41.30,69.20,17z/data=!3d41.3111!4d69.2797",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AddUzpostBranchDialog", () => {
  it("does not send an incomplete form", () => {
    renderDialog();
    fill("Indeks", "1002");
    fireEvent.click(screen.getByRole("button", { name: /Saqlash/ }));

    expect(add).not.toHaveBeenCalled();
    expect(screen.getByText("Indeks 6 ta raqamdan iborat bo'lishi kerak.")).toBeTruthy();
    expect(screen.getByText("Filial nomini yozing.")).toBeTruthy();
  });

  it("keeps only digits in the index", () => {
    renderDialog();
    fill("Indeks", "10a02 15");
    expect((screen.getByLabelText("Indeks") as HTMLInputElement).value).toBe("100215");
  });

  it("saves the pin from a maps link and hands the new branch back", async () => {
    add.mockResolvedValue({
      ID: 900001,
      Name: "Toshkent 215-bo'lim",
      Index: 100215,
      Address: "Toshkent, Yunusobod 5",
      Latitude: 41.3111,
      Longitude: 69.2797,
      Workdays: null,
      Custom: true,
    });
    const { onAdded, client } = renderDialog();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /Saqlash/ }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(add.mock.calls[0][0]).toEqual({
      name: "Toshkent 215-bo'lim",
      postcode_index: "100215",
      address: "Toshkent, Yunusobod 5",
      latitude: 41.3111,
      longitude: 69.2797,
      workdays: null,
    });
    expect(onAdded.mock.calls[0][0]).toMatchObject({ id: 900001, isCustom: true });
    expect(client.getQueryData<{ id: number }[]>(["uzpost-branches"])?.[0].id).toBe(900001);
  });

  it("offers the listed branch when the index already exists", async () => {
    add.mockRejectedValue({
      status: 409,
      message: "x",
      data: {
        detail: {
          message: "100215 indeksli filial ro'yxatda bor.",
          branch_id: 5300,
          name: "Toshkent 215",
          address: "Yunusobod",
        },
      },
    });
    const { onUseExisting, onAdded } = renderDialog();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /Saqlash/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Shu filialni tanlash" }));
    expect(onUseExisting).toHaveBeenCalledWith(5300);
    expect(onAdded).not.toHaveBeenCalled();
    expect(screen.getByText("100215 indeksli filial ro'yxatda bor.")).toBeTruthy();
  });
});
