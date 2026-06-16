import type { FastEntryQueueItem } from '@/store/expectedCargoStore';

/**
 * Export the in-memory scanner queue to a CSV file BEFORE it is saved to the
 * database. This is a worker safety net: a full 8-hour batch can be downloaded
 * as a spreadsheet at any moment, independent of the server. CSV (UTF-8 with a
 * BOM) is used instead of a real .xlsx so the feature needs no extra dependency
 * and still opens cleanly in Excel with a double-click.
 */

const CSV_HEADERS = ['Reys', 'Mijoz kodi', 'Trek kodi', 'Holat', 'Skan vaqti'] as const;

/** Human-readable Uzbek status mirroring the row colours in the scanner table. */
function describeStatus(item: FastEntryQueueItem): string {
  if (item.isWrongClient) return `Boshqa mijoz${item.conflictClientCode ? `: ${item.conflictClientCode}` : ''}`;
  if (item.isAlreadySent) return `Yuborilgan${item.alreadySentFlight ? `: ${item.alreadySentFlight}` : ''}`;
  if (item.notFound) return 'Topilmadi';
  if (item.isResolved) return 'Aniqlandi';
  if (item.clientCode.trim()) return "Qo'lda kiritilgan";
  return 'Tekshirilmoqda';
}

function formatScanTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('uz-UZ');
}

/** Quote a single CSV field, escaping embedded quotes and wrapping when needed. */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportQueueToCsv(
  items: FastEntryQueueItem[],
  flightName: string | null,
): void {
  // Newest-first, matching the on-screen order (scannedAt descending).
  const ordered = [...items].sort((a, b) => {
    const bTime = b.scannedAt ? Date.parse(b.scannedAt) : 0;
    const aTime = a.scannedAt ? Date.parse(a.scannedAt) : 0;
    return bTime - aTime;
  });

  const rows = ordered.map((item) =>
    [
      item.flightName ?? flightName ?? '',
      item.clientCode,
      item.trackCode,
      describeStatus(item),
      formatScanTime(item.scannedAt),
    ]
      .map((field) => escapeCsvField(String(field)))
      .join(','),
  );

  const csv = [CSV_HEADERS.join(','), ...rows].join('\r\n');
  // Prepend a UTF-8 BOM so Excel detects the encoding and renders Uzbek text.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });

  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;

  const suffix = flightName ? flightName.replace(/\s+/g, '_') : 'queue';
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  anchor.setAttribute('download', `scanner_${suffix}_${stamp}.csv`);

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}
