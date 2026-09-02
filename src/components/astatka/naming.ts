/**
 * A name for a stock-take that the worker will recognise tomorrow.
 *
 * Offered, not imposed: the field stays editable because the person doing the
 * count knows what it should be called.
 *
 * The two stock-takes done by hand were `A-OSTOTKA-05.08` and
 * `A-OSTATKA-M-26.08` — two spellings and two shapes, from two people typing
 * freely. Proposing one form stops the list fragmenting that way again.
 */
export function suggestAstatkaName(now: Date): string {
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `OSTATKA-${day}.${month}`;
}
