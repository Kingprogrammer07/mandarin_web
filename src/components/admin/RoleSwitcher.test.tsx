import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/api/services/adminAuth", () => ({ switchAdminRole: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));

import RoleSwitcher from "./RoleSwitcher";

/** An unsigned token: the switcher only decodes the claims, it never verifies. */
function signIn(role: string, roles: string[]): void {
  const payload = btoa(JSON.stringify({ sub: "10", role, roles }));
  localStorage.setItem("access_token", `x.${payload}.y`);
}

beforeEach(() => {
  localStorage.clear();
});

describe("RoleSwitcher", () => {
  it("never offers the label permission role", () => {
    signIn("worker", ["worker", "manager", "warehouse", "uzpost-label-config"]);
    render(<RoleSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: /worker/ }));

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "worker",
      "manager",
      "warehouse",
    ]);
    expect(screen.queryByText("uzpost-label-config")).toBeNull();
  });

  it("does not render when the grant is the only other role", () => {
    signIn("warehouse", ["warehouse", "uzpost-label-config"]);

    const { container } = render(<RoleSwitcher />);

    expect(container).toBeEmptyDOMElement();
  });

  it("still offers both roles of an ordinary two-role account", () => {
    signIn("worker", ["worker", "manager"]);
    render(<RoleSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: /worker/ }));

    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  });
});
