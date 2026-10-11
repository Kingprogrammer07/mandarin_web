import { afterEach, describe, expect, it } from "vitest";

import { mayRefocusScanField } from "./useScanFieldFocusLock";

function field(): HTMLInputElement {
  const input = document.createElement("input");
  input.setAttribute("aria-label", "Trek kod");
  document.body.appendChild(input);
  return input;
}

afterEach(() => {
  document.body.innerHTML = "";
  window.getSelection()?.removeAllRanges();
});

describe("keeping the scan field focused", () => {
  it("takes the focus back from a button or from nowhere", () => {
    const scan = field();
    expect(mayRefocusScanField(scan)).toBe(true);

    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    expect(mayRefocusScanField(scan)).toBe(true);

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    document.body.appendChild(toggle);
    toggle.focus();
    expect(mayRefocusScanField(scan)).toBe(true);
  });

  it("leaves another field the worker is typing in alone", () => {
    const scan = field();
    const search = document.createElement("input");
    search.type = "search";
    document.body.appendChild(search);
    search.focus();
    expect(mayRefocusScanField(scan)).toBe(false);

    const select = document.createElement("select");
    document.body.appendChild(select);
    select.focus();
    expect(mayRefocusScanField(scan)).toBe(false);
  });

  it("waits while a dialog or menu is open", () => {
    const scan = field();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    expect(mayRefocusScanField(scan)).toBe(false);
    dialog.setAttribute("role", "menu");
    expect(mayRefocusScanField(scan)).toBe(false);
    dialog.remove();
    expect(mayRefocusScanField(scan)).toBe(true);
  });

  it("does not wipe text the worker selected to copy", () => {
    const scan = field();
    const code = document.createElement("p");
    code.textContent = "YT2592580753209";
    document.body.appendChild(code);
    const range = document.createRange();
    range.selectNodeContents(code);
    window.getSelection()?.addRange(range);
    expect(mayRefocusScanField(scan)).toBe(false);
  });

  it("does nothing once the field is gone or already focused", () => {
    const scan = field();
    scan.focus();
    expect(mayRefocusScanField(scan)).toBe(false);
    scan.remove();
    expect(mayRefocusScanField(scan)).toBe(false);
  });
});
