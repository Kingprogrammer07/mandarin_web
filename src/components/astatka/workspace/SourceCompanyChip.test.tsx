import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SourceCompanyChip } from "./SourceCompanyChip";

describe("SourceCompanyChip", () => {
  it('reads "AKB · API" and says in words where the bag came from', () => {
    render(<SourceCompanyChip label="AKB" />);

    const chip = screen.getByTitle("AKB API'dan topildi");
    expect(chip).toHaveTextContent("AKB · API");
    // Screen readers hear the sentence, not the "·" shorthand.
    expect(screen.getByText("AKB API'dan topildi")).toHaveClass("sr-only");
    expect(screen.getByText("AKB · API")).toHaveAttribute("aria-hidden", "true");
  });

  it("names only the cargo in the saved list", () => {
    render(<SourceCompanyChip label="AKB" api={false} />);
    expect(screen.getByText("AKB", { selector: "span[aria-hidden]" })).toBeInTheDocument();
    expect(screen.queryByText("AKB · API")).toBeNull();
  });
});
