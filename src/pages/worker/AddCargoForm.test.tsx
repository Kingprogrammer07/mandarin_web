import { forwardRef, useImperativeHandle } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/api/services/adminManagement", () => ({
  getAdminJwtClaims: () => ({
    permissions: new Set(["flights:create", "flights:read", "flights:delete"]),
    isSuperAdmin: false,
  }),
}));
vi.mock("@/api/services/cargo", () => ({
  getClientCodeSuggestions: vi.fn(),
  getClientCodeIndex: vi.fn(),
  getFlightPhotos: vi.fn(),
  deleteCargo: vi.fn(),
  uploadPhoto: vi.fn(),
  getCargoImageMetadata: vi.fn(),
}));
// The real camera needs getUserMedia; a button stands in for "take a photo".
vi.mock("@/components/MultiPhotoUpload", () => ({
  default: forwardRef(function FakeCamera(
    { onChange, onCameraClose }: { onChange: (f: File[]) => void; onCameraClose?: () => void },
    ref,
  ) {
    useImperativeHandle(ref, () => ({ openCamera: () => {}, prepareStream: () => {} }));
    return (
      <button
        type="button"
        onClick={() => {
          onChange([new File(["x"], "p.jpg", { type: "image/jpeg" })]);
          onCameraClose?.();
        }}
      >
        rasmga olish
      </button>
    );
  }),
}));

import {
  deleteCargo,
  getClientCodeIndex,
  getClientCodeSuggestions,
  getFlightPhotos,
  uploadPhoto,
  type CargoPhoto,
  type FlightPhotosResponse,
} from "@/api/services/cargo";
import AddCargoForm from "./AddCargoForm";

const suggestions = vi.mocked(getClientCodeSuggestions);
const flightPhotos = vi.mocked(getFlightPhotos);
const removeCargo = vi.mocked(deleteCargo);
const codeIndex = vi.mocked(getClientCodeIndex);
const upload = vi.mocked(uploadPhoto);

function report(id: string, clientId: string): CargoPhoto {
  return {
    id,
    flight_name: "M123",
    client_id: clientId,
    photo_file_ids: ["f1"],
    weight_kg: 2,
    price_per_kg: null,
    comment: null,
    is_sent: false,
    created_at: "2026-10-17T08:00:00Z",
    updated_at: "2026-10-17T08:00:00Z",
  };
}

function photosPage(photos: CargoPhoto[]): FlightPhotosResponse {
  return {
    flight_name: "M123",
    photos,
    total: photos.length,
    unique_clients: photos.length,
    unsent_count: photos.length,
    sent_count: 0,
    page: 1,
    size: 100,
    total_pages: 1,
  };
}

const codeInput = () => screen.getByPlaceholderText("cargo.clientCodePlaceholder");
const weightInput = () => screen.getByPlaceholderText("cargo.weightPlaceholder");

beforeEach(() => {
  vi.clearAllMocks();
  suggestions.mockResolvedValue({
    query: "",
    exact: true,
    best: null,
    best_reason: null,
    items: [],
  });
  flightPhotos.mockResolvedValue(photosPage([]));
  removeCargo.mockResolvedValue({ success: true, message: "", deleted_cargo_id: "" });
  codeIndex.mockRejectedValue(new Error("offline"));
  upload.mockResolvedValue({ success: true, message: "", photo: report("1", "X1") });
});

function renderForm() {
  return render(<AddCargoForm flightName="M123" onBack={() => {}} onSuccess={() => {}} />);
}

describe("AddCargoForm", () => {
  it("returns focus to the code field after a photo when only the saved prefix is in it", () => {
    renderForm();
    fireEvent.click(screen.getByText("cargo.fastMode"));
    fireEvent.change(codeInput(), { target: { value: "SAAN" } });
    weightInput().focus();

    fireEvent.click(screen.getByText("rasmga olish"));

    expect(codeInput()).toHaveFocus();
  });

  it("leaves focus alone when the code is already typed in full", () => {
    renderForm();
    fireEvent.change(codeInput(), { target: { value: "SAAN123" } });
    weightInput().focus();

    fireEvent.click(screen.getByText("rasmga olish"));

    expect(weightInput()).toHaveFocus();
  });

  it("warns about an earlier report of the same client and deletes it on confirm", async () => {
    // "SAAN1234" matches the substring search but is another client.
    flightPhotos.mockResolvedValue(
      photosPage([report("7", "SAAN123"), report("8", "SAAN1234")]),
    );
    renderForm();
    fireEvent.change(codeInput(), { target: { value: "SAAN123" } });

    expect(
      await screen.findByText("Bu mijozga shu reysda foto hisobot qilingan"),
    ).toBeInTheDocument();
    expect(flightPhotos).toHaveBeenCalledWith("M123", 1, 100, "SAAN123");

    fireEvent.click(screen.getByText("Eskisini o'chirish"));
    await act(async () => {
      fireEvent.click(await screen.findByText("O'chirish"));
    });

    expect(removeCargo).toHaveBeenCalledTimes(1);
    expect(removeCargo).toHaveBeenCalledWith("7");
    await waitFor(() =>
      expect(screen.queryByText("Eskisini o'chirish")).not.toBeInTheDocument(),
    );
  });

  it("shows no warning for a client with no report on this flight", async () => {
    flightPhotos.mockResolvedValue(photosPage([report("8", "SAAN1234")]));
    renderForm();
    fireEvent.change(codeInput(), { target: { value: "SAAN123" } });

    await waitFor(() => expect(flightPhotos).toHaveBeenCalled());
    expect(screen.queryByText("Eskisini ko'rish")).not.toBeInTheDocument();
  });

  it("refuses an unregistered code until it is ticked, for that one parcel", async () => {
    suggestions.mockResolvedValue({ query: "", exact: false, best: null, best_reason: null, items: [] });
    renderForm();
    fireEvent.click(screen.getByText("cargo.fastMode"));
    fireEvent.click(screen.getByText("rasmga olish"));
    fireEvent.change(codeInput(), { target: { value: "SAAN999" } });
    fireEvent.change(weightInput(), { target: { value: "2" } });

    fireEvent.click(screen.getByText("cargo.saveAndNext"));
    expect(
      await screen.findByText(/tizimda ro'yxatdan o'tmagan. Baribir yuklash/),
    ).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByLabelText(/Ro'yxatdan o'tmagan mijoz/));
    fireEvent.click(screen.getByText("cargo.saveAndNext"));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(upload.mock.calls[0][1]).toBe("SAAN999");

    // The same code on the next parcel starts unticked again.
    fireEvent.change(codeInput(), { target: { value: "SAAN999" } });
    expect(await screen.findByLabelText(/Ro'yxatdan o'tmagan mijoz/)).not.toBeChecked();
  });

  it("completes a code from the saved list without waiting for the server", async () => {
    codeIndex.mockResolvedValue({ clients: [["SAAN123"]], flight_codes: [], generated_at: "" });
    suggestions.mockReturnValue(new Promise(() => {}));
    renderForm();
    await waitFor(() => expect(codeIndex).toHaveBeenCalled());
    fireEvent.change(codeInput(), { target: { value: "SA123" } });

    expect(await screen.findByText("SAAN123")).toBeInTheDocument();
    fireEvent.keyDown(codeInput(), { key: "Enter" });
    await waitFor(() => expect(codeInput()).toHaveValue("SAAN123"));
    expect(weightInput()).toHaveFocus();
  });

  it("lets a region-only code through when it cannot be checked and the worker ticks it", async () => {
    suggestions.mockRejectedValue(new Error("Network Error"));
    renderForm();
    fireEvent.click(screen.getByText("rasmga olish"));
    fireEvent.change(codeInput(), { target: { value: "SA999" } });
    fireEvent.change(weightInput(), { target: { value: "2" } });

    fireEvent.click(screen.getByText("cargo.submit"));
    const tick = await screen.findByLabelText(/Ro'yxatdan o'tmagan mijoz/);
    expect(upload).not.toHaveBeenCalled();

    fireEvent.click(tick);
    expect(tick).toBeChecked();
    fireEvent.click(screen.getByText("cargo.submit"));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(upload.mock.calls[0][1]).toBe("SA999");
  });
});

