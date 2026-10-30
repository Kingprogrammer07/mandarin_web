/** "6262********2994" → "6262 •••• 2994"; anything else is shown as given. */
export function formatMaskedCard(masked: string | null | undefined): string | null {
  if (!masked) return null;
  const head = /^\d{4}/.exec(masked)?.[0];
  const tail = /\d{4}$/.exec(masked)?.[0];
  return head && tail ? `${head} •••• ${tail}` : masked;
}
