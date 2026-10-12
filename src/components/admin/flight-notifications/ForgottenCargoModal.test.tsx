import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/api/services/flightNotifications", () => ({
  addForgottenCargo: vi.fn(),
}));
// Camera and gallery access are not under test; the modal only owns the list.
vi.mock("@/components/MultiPhotoUpload", () => ({
  default: () => <div>Rasm tanlash</div>,
}));

import ForgottenCargoModal from "@/components/admin/ForgottenCargoModal";

function renderModal() {
  const onClose = vi.fn();
  render(
    <ForgottenCargoModal
      flightName="M284"
      onClose={onClose}
      onSuccess={vi.fn()}
    />,
  );
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ForgottenCargoModal", () => {
  it("is a labelled dialog whose fields have labels", () => {
    renderModal();
    const dialog = screen.getByRole("dialog", {
      name: "Unutilgan yuk qo'shish",
    });
    expect(dialog).toHaveAccessibleDescription("Reys: M284");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText(/Mijoz kodi/)).toHaveAttribute(
      "aria-required",
      "true",
    );
    expect(screen.getByLabelText(/Og'irlik/)).toHaveAttribute(
      "inputmode",
      "decimal",
    );
    expect(screen.getByRole("checkbox", { name: "Web" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("checkbox", { name: /Darhol yuborish/ }),
    ).toBeChecked();
  });

  it("closes on Escape while empty, but keeps a started form", () => {
    const onClose = renderModal();
    fireEvent.change(screen.getByLabelText(/Mijoz kodi/), {
      target: { value: "m001" },
    });
    expect(screen.getByLabelText(/Mijoz kodi/)).toHaveValue("M001");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Mijoz kodi/), {
      target: { value: "" },
    });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("says inside the dialog why it cannot save, where a screen reader hears it", () => {
    renderModal();
    fireEvent.click(
      screen.getByRole("button", { name: "Saqlash va yuborish" }),
    );
    expect(
      within(screen.getByRole("dialog")).getByRole("alert"),
    ).toHaveTextContent("Mijoz kodini kiriting");

    fireEvent.change(screen.getByLabelText(/Mijoz kodi/), {
      target: { value: "M001" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Saqlash va yuborish" }),
    );
    expect(
      within(screen.getByRole("dialog")).getByRole("alert"),
    ).toHaveTextContent("Kamida 1 ta trek kod kiritish majburiy");
  });

  it("flags a missing send channel with text, not colour alone", () => {
    renderModal();
    fireEvent.click(screen.getByRole("checkbox", { name: "Web" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kamida bittasini tanlang",
    );
  });
});
