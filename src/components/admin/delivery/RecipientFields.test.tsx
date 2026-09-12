import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import RecipientFields from "./RecipientFields";
import { RECIPIENT_PHONE_MAX_LENGTH } from "@/lib/adminDeliveryRecipient";

const NAME_PLACEHOLDER = "Qabul qiluvchining ism-familiyasi";

function renderFields(props: Partial<ComponentProps<typeof RecipientFields>> = {}) {
  const handlers = { onTypedNameChange: vi.fn(), onPhoneChange: vi.fn() };
  render(
    <RecipientFields
      profileName="Anvar Mijozov"
      typedName={null}
      phone="+998901112233"
      problems={[]}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("RecipientFields", () => {
  it("shows the account holder's name until another name is chosen", () => {
    const { onTypedNameChange } = renderFields();

    expect(screen.getByText("Anvar Mijozov")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(NAME_PLACEHOLDER)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Boshqa ism" }));
    expect(onTypedNameChange).toHaveBeenCalledWith("");
  });

  it("starts another name empty and reports what is typed", () => {
    const { onTypedNameChange } = renderFields({ typedName: "" });

    const input = screen.getByPlaceholderText(NAME_PLACEHOLDER);
    expect(input).toHaveValue("");

    fireEvent.change(input, { target: { value: "Vali Aliyev" } });
    expect(onTypedNameChange).toHaveBeenLastCalledWith("Vali Aliyev");
  });

  it("goes back to the profile name", () => {
    const { onTypedNameChange } = renderFields({ typedName: "Vali" });

    fireEvent.click(screen.getByRole("button", { name: "Profildagi ism" }));
    expect(onTypedNameChange).toHaveBeenCalledWith(null);
  });

  it("shows the phone it was given, caps its length and reports edits", () => {
    const { onPhoneChange } = renderFields();

    const phone = screen.getByLabelText("Telefon");
    expect(phone).toHaveValue("+998901112233");
    expect(phone).toHaveAttribute("maxLength", String(RECIPIENT_PHONE_MAX_LENGTH));

    fireEvent.change(phone, { target: { value: "+998935551122" } });
    expect(onPhoneChange).toHaveBeenCalledWith("+998935551122");
  });

  it("points at a missing name and a missing phone", () => {
    renderFields({ typedName: "", phone: "", problems: ["name-missing", "phone-missing"] });

    expect(screen.getByText("Qabul qiluvchi ismini kiriting")).toBeInTheDocument();
    expect(screen.getByText("Qabul qiluvchi telefonini kiriting")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(NAME_PLACEHOLDER)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Telefon")).toHaveAttribute("aria-invalid", "true");
  });

  it("points at a phone longer than the endpoints accept", () => {
    renderFields({ problems: ["phone-too-long"] });

    expect(screen.getByRole("alert")).toHaveTextContent(/Telefon juda uzun/);
    expect(screen.getByLabelText("Telefon")).toHaveAttribute("aria-invalid", "true");
  });

  it("tells the manager what to do when the profile has no name", () => {
    renderFields({ profileName: "" });

    expect(screen.getByText(/Boshqa ism" ni bosing/)).toBeInTheDocument();
  });
});
