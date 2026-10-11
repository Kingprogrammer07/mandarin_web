/**
 * Hands a file to the browser's download. The object URL is released a moment
 * later rather than at once: Safari starts the download asynchronously and a
 * URL revoked in the same tick downloads nothing.
 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file name stamp in local time, "2026-10-11_14-05". */
export function fileStamp(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

/** Flight names may hold characters a file system refuses ("/", ":"). */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, "_");
}
