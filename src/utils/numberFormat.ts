export const normalizeNumber = (value: string): string | null => {
  const normalized = value.replace(/,/g, ".");
  const cleaned = normalized.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) return null;
  if (cleaned.startsWith(".")) return "0" + cleaned;
  return cleaned;
};
