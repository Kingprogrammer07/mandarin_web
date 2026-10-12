import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AstatkaCargoPhoto } from "@/api/services/astatkaFlights";

import { PhotoViewer } from "./PhotoViewer";

const photos: AstatkaCargoPhoto[] = [0, 1, 2].map((index) => ({
  index,
  url: `https://files.example/${index}.webp`,
  error: null,
}));

function press(key: string) {
  fireEvent.keyDown(screen.getByRole("dialog"), { key });
}

/** At either end a step button is marked, not `disabled`: it keeps the focus. */
function atEnd(name: string) {
  return screen.getByRole("button", { name });
}

const telegram = window.Telegram!.WebApp;

afterEach(() => {
  delete telegram.disableVerticalSwipes;
  delete telegram.enableVerticalSwipes;
  delete telegram.isVerticalSwipesEnabled;
  Reflect.deleteProperty(telegram, "isVersionAtLeast");
});

describe("PhotoViewer", () => {
  it("is a modal dialog that opens on the tapped photo", () => {
    render(<PhotoViewer photos={photos} initialIndex={2} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "3 / 3" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(atEnd("Keyingi rasm")).toHaveAttribute("aria-disabled", "true");
    expect(atEnd("Oldingi rasm")).toHaveAttribute("aria-disabled", "false");
  });

  it("steps with the arrow keys and stops at both ends", () => {
    render(<PhotoViewer photos={photos} initialIndex={0} onClose={vi.fn()} />);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(atEnd("Oldingi rasm")).toHaveAttribute("aria-disabled", "true");

    press("ArrowLeft");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    press("ArrowRight");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    press("ArrowRight");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    press("ArrowRight");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(atEnd("Keyingi rasm")).toHaveAttribute("aria-disabled", "true");

    press("ArrowLeft");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("keeps the arrow keys working after a step button took the viewer to the end", () => {
    render(<PhotoViewer photos={photos} initialIndex={1} onClose={vi.fn()} />);
    const next = screen.getByRole("button", { name: "Keyingi rasm" });
    next.focus();
    fireEvent.click(next);
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    // A disabled button would have dropped the focus to <body>, out of reach
    // of the viewer's key handler.
    expect(next).toBeEnabled();
    expect(document.activeElement).toBe(next);
    fireEvent.click(next);
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("switches Telegram's swipe-to-minimise off while open, and back on after", () => {
    telegram.isVersionAtLeast = vi.fn(() => true);
    telegram.isVerticalSwipesEnabled = true;
    telegram.disableVerticalSwipes = vi.fn();
    telegram.enableVerticalSwipes = vi.fn();

    const { unmount } = render(
      <PhotoViewer photos={photos} initialIndex={0} onClose={vi.fn()} />,
    );
    expect(telegram.disableVerticalSwipes).toHaveBeenCalledTimes(1);
    expect(telegram.enableVerticalSwipes).not.toHaveBeenCalled();

    unmount();
    expect(telegram.enableVerticalSwipes).toHaveBeenCalledTimes(1);
  });

  it("leaves Telegram's swipes alone on a client too old to switch them", () => {
    telegram.isVersionAtLeast = vi.fn(() => false);
    telegram.disableVerticalSwipes = vi.fn();

    render(<PhotoViewer photos={photos} initialIndex={0} onClose={vi.fn()} />);
    expect(telegram.disableVerticalSwipes).not.toHaveBeenCalled();
  });

  it("steps with the buttons", () => {
    render(<PhotoViewer photos={photos} initialIndex={0} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Keyingi rasm" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Oldingi rasm" }));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("closes on Escape and says which photo it ended on", () => {
    const onClose = vi.fn();
    render(<PhotoViewer photos={photos} initialIndex={0} onClose={onClose} />);

    press("ArrowRight");
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    expect(onClose).toHaveBeenCalledWith(1);
  });

  it("re-takes the photo on screen, and only when it is allowed", () => {
    const onReplace = vi.fn();
    const { unmount } = render(
      <PhotoViewer
        photos={photos}
        initialIndex={1}
        onClose={vi.fn()}
        onReplace={onReplace}
      />,
    );
    press("ArrowRight");
    fireEvent.click(
      screen.getByRole("button", { name: "Shu rasmni qayta olish" }),
    );
    expect(onReplace).toHaveBeenCalledWith(2);
    unmount();

    render(<PhotoViewer photos={photos} initialIndex={0} onClose={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: "Shu rasmni qayta olish" }),
    ).toBeNull();
  });

  it("shows a single photo without the step buttons", () => {
    render(
      <PhotoViewer
        photos={photos.slice(0, 1)}
        initialIndex={0}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keyingi rasm" })).toBeNull();
    expect(screen.getByAltText("1-rasm")).toHaveAttribute("draggable", "false");
  });
});
