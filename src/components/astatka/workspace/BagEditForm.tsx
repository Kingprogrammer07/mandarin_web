import { useEffect, useRef, useState, type FormEvent } from "react";

import { parseTrackCodes } from "@/lib/astatkaWorkQueue";

export interface BagEditValues {
  clientCode: string;
  sourceFlight: string;
  /** null = take the photo report's weight. */
  weightKg: number | null;
  comment: string;
  trackCodes: string[];
}

/** Only what the worker changed; a field left alone is absent. */
export type BagEditChanges = Partial<BagEditValues>;

/** Fields a saved, confirmed bag can no longer change. */
export interface BagEditLocks {
  clientCode?: boolean;
  sourceFlight?: boolean;
}

interface Props {
  /** The window's footer submits the form through this id. */
  id: string;
  /**
   * The bag as it is now. A field the worker has not typed into shows this
   * and follows it while the form is open — a weight fixed in the photo report
   * below, a code scanned into the row — so it is never saved back stale.
   */
  current: BagEditValues;
  locked?: BagEditLocks;
  onSave: (changes: BagEditChanges) => void;
}

type Field = keyof BagEditValues;

const fieldClass =
  "mt-1 w-full rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 py-2.5 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-brand disabled:opacity-60";
const labelClass =
  "text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3";

function textOf(values: BagEditValues, field: Field): string {
  if (field === "weightKg")
    return values.weightKg === null ? "" : String(values.weightKg);
  if (field === "trackCodes") return values.trackCodes.join("\n");
  return values[field];
}

function sameCodes(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((code) => b.includes(code));
}

/**
 * Scrolls the nearest scrolling ancestor (the window's body) so the element's
 * top edge is at its top. Not `scrollIntoView`: that would also try to scroll
 * the page behind the window.
 */
function scrollToStart(element: HTMLElement) {
  let scroller = element.parentElement;
  while (
    scroller &&
    !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
  ) {
    scroller = scroller.parentElement;
  }
  if (!scroller) return;
  const padding = Number.parseFloat(getComputedStyle(scroller).paddingTop) || 0;
  scroller.scrollTop +=
    element.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top -
    padding;
}

/**
 * "Tahrirlash" for one bag — before it is confirmed (a scan row) or after
 * (a saved bag). It has no buttons of its own: the bag window's footer submits
 * it. Every input is 16px so iOS does not zoom the page on focus.
 */
export function BagEditForm({ id, current, locked = {}, onSave }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  /** What the worker typed, per field; everything else reads `current`. */
  const [typed, setTyped] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);

  // The form replaces the bag's facts in place, possibly while the window is
  // scrolled down to the photos: bring its first field to the top, and take
  // the focus so a screen reader hears the window changed — the form, not a
  // field, so the phone's keyboard does not pop up.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    form.focus({ preventScroll: true });
    scrollToStart(form);
  }, []);

  const isLocked = (field: Field): boolean =>
    (field === "clientCode" && Boolean(locked.clientCode)) ||
    (field === "sourceFlight" && Boolean(locked.sourceFlight));
  const edited = (field: Field): boolean =>
    !isLocked(field) && typed[field] !== undefined;
  const textFor = (field: Field): string =>
    edited(field) ? (typed[field] ?? "") : textOf(current, field);
  const type = (field: Field) => (value: string) =>
    setTyped((previous) => ({ ...previous, [field]: value }));
  // The bag got confirmed while the form was open: what was typed into a
  // field that is now locked cannot be saved, and must not vanish unexplained.
  const lockedAway = (field: Field): boolean =>
    isLocked(field) &&
    typed[field] !== undefined &&
    typed[field].trim().toUpperCase() !==
      textOf(current, field).trim().toUpperCase();

  const codes = parseTrackCodes(textFor("trackCodes"));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = textFor("clientCode").trim().toUpperCase();
    if (!client) {
      setError("Mijoz kodini yozing.");
      return;
    }
    const weightText = textFor("weightKg").trim().replace(",", ".");
    const weightKg = weightText === "" ? null : Number(weightText);
    if (
      weightKg !== null &&
      (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 100000)
    ) {
      setError("Og'irlik noto'g'ri. Masalan: 4.5");
      return;
    }
    if (edited("trackCodes") && codes.length === 0) {
      setError("Kamida bitta trek kod yozing.");
      return;
    }
    setError(null);

    const sourceFlight = textFor("sourceFlight").trim().toUpperCase();
    const comment = textFor("comment").trim();
    const changes: BagEditChanges = {};
    if (
      edited("clientCode") &&
      client !== current.clientCode.trim().toUpperCase()
    )
      changes.clientCode = client;
    if (
      edited("sourceFlight") &&
      sourceFlight !== current.sourceFlight.trim().toUpperCase()
    )
      changes.sourceFlight = sourceFlight;
    if (edited("weightKg") && weightKg !== current.weightKg)
      changes.weightKg = weightKg;
    if (edited("comment") && comment !== current.comment.trim())
      changes.comment = comment;
    if (
      edited("trackCodes") &&
      !sameCodes(codes, parseTrackCodes(textOf(current, "trackCodes")))
    )
      changes.trackCodes = codes;
    onSave(changes);
  };

  const noteId = (field: Field) => `${id}-${field}-note`;
  // Outside the <label>, tied to the input by aria-describedby: inside it
  // would become part of the field's name.
  const lockedNote = (field: Field) =>
    lockedAway(field) && (
      <p
        id={noteId(field)}
        className="mt-1 text-[11px] font-semibold text-mc-warn"
      >
        Yuk tasdiqlandi — «{typed[field]?.trim()}» saqlanmaydi, bu maydon endi
        o'zgarmaydi.
      </p>
    );

  return (
    <form
      ref={formRef}
      id={id}
      onSubmit={submit}
      tabIndex={-1}
      aria-label="Yukni tahrirlash"
      noValidate
      className="space-y-3 outline-none"
    >
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
        <div>
          <label className="block">
            <span className={labelClass}>Mijoz kodi</span>
            <input
              value={textFor("clientCode")}
              onChange={(event) => type("clientCode")(event.target.value)}
              disabled={locked.clientCode}
              aria-describedby={
                lockedAway("clientCode") ? noteId("clientCode") : undefined
              }
              autoCapitalize="characters"
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          {lockedNote("clientCode")}
        </div>
        <div>
          <label className="block">
            <span className={labelClass}>Qaysi reysdan</span>
            <input
              value={textFor("sourceFlight")}
              onChange={(event) => type("sourceFlight")(event.target.value)}
              disabled={locked.sourceFlight}
              aria-describedby={
                lockedAway("sourceFlight") ? noteId("sourceFlight") : undefined
              }
              placeholder="Masalan: M210"
              autoCapitalize="characters"
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          {lockedNote("sourceFlight")}
        </div>
      </div>
      <label className="block">
        <span className={labelClass}>Og'irligi (kg)</span>
        <input
          value={textFor("weightKg")}
          onChange={(event) => type("weightKg")(event.target.value)}
          inputMode="decimal"
          placeholder="Masalan: 12.5"
          className={fieldClass}
        />
        <span className="mt-1 block text-[11px] font-medium text-mc-text-3">
          Bo'sh qolsa, foto hisobotdagi og'irlik olinadi.
        </span>
      </label>
      <label className="block">
        <span className={labelClass}>Trek kodlar · {codes.length} ta</span>
        <textarea
          value={textFor("trackCodes")}
          onChange={(event) => type("trackCodes")(event.target.value)}
          rows={5}
          placeholder="Har bir qatorga bitta kod"
          className={`${fieldClass} resize-y font-mono`}
        />
      </label>
      <label className="block">
        <span className={labelClass}>Izoh</span>
        <textarea
          value={textFor("comment")}
          onChange={(event) => type("comment")(event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Masalan: qopi yirtilgan"
          className={`${fieldClass} resize-y`}
        />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-mc-sm bg-mc-danger-soft px-3 py-2 text-[13px] font-bold text-mc-danger"
        >
          {error}
        </p>
      )}
    </form>
  );
}
