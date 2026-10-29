/**
 * The printed list. Rendered into <body> next to the app, which print CSS
 * hides, so the admin shell's fixed, scrolling layout never cuts a page.
 *
 * Every figure on paper is added up from the printed rows themselves, in
 * tiyin, so the document always agrees with itself.
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import type { Expense } from '@/api/services/expenseService';
import { dmy, formatMoney, spentAt, sumAmounts, tashkentNow } from '@/lib/expenses';

import { PAYMENT_LABEL } from './expenseUi';

const PRINT_CSS = `
@media screen { .expense-print-root { display: none; } }
@media print {
  body > *:not(.expense-print-root) { display: none !important; }
  .expense-print-root { display: block; color: #111; background: #fff; font: 11px/1.4 Manrope, system-ui, sans-serif; }
  @page { size: A4; margin: 12mm; }
  .expense-print-root table { width: 100%; border-collapse: collapse; }
  .expense-print-root th, .expense-print-root td { border-bottom: 1px solid #ddd; padding: 5px 6px; text-align: left; vertical-align: top; }
  .expense-print-root th { font-weight: 700; border-bottom: 1.5px solid #111; }
  .expense-print-root .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .expense-print-root tr { break-inside: avoid; }
  .expense-print-root tfoot td { border-bottom: 0; font-weight: 700; }
}
`;

export interface PrintJob {
  id: number;
  rows: Expense[];
  period: string;
  filters: string[];
}

export function ExpensePrint({ job, onDone }: { job: PrintJob; onDone: () => void }) {
  useEffect(() => {
    window.addEventListener('afterprint', onDone, { once: true });
    // One frame so the portal is painted before the dialog snapshots it.
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', onDone);
    };
  }, [onDone]);

  const total = sumAmounts(job.rows.map((r) => r.amount));
  const cash = sumAmounts(job.rows.filter((r) => r.payment_method === 'cash').map((r) => r.amount));
  const card = sumAmounts(job.rows.filter((r) => r.payment_method === 'card').map((r) => r.amount));
  const printed = tashkentNow();

  return createPortal(
    <div className="expense-print-root">
      <style>{PRINT_CSS}</style>
      <h1 style={{ fontSize: 16, margin: '0 0 2px' }}>Mandarin Cargo — rasxodlar ro'yxati</h1>
      <p style={{ margin: 0 }}>
        Davr: {job.period}
        {job.filters.length > 0 && ` · ${job.filters.join(' · ')}`}
      </p>
      <p style={{ margin: '0 0 10px', color: '#555' }}>
        Chop etildi: {dmy(printed.ymd)} {printed.hm} (Toshkent)
      </p>
      <table>
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Sana / vaqt</th>
            <th>Tavsif</th>
            <th>Rasxod turi</th>
            <th>Kim oldi</th>
            <th>To'lov</th>
            <th className="num">Summa, so'm</th>
          </tr>
        </thead>
        <tbody>
          {job.rows.map((r, i) => {
            const when = spentAt(r);
            return (
              <tr key={r.id}>
                <td className="num">{i + 1}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{when ? `${dmy(when.ymd)} ${when.hm}` : '—'}</td>
                <td>{r.description || '—'}</td>
                <td>{r.category_name}</td>
                <td>{r.employee_name ?? '—'}</td>
                <td>{PAYMENT_LABEL[r.payment_method]}</td>
                <td className="num">{formatMoney(r.amount)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6}>Jami: {job.rows.length} ta yozuv</td>
            <td className="num">{formatMoney(total)}</td>
          </tr>
          <tr>
            <td colSpan={6} style={{ fontWeight: 400 }}>
              shundan naqd
            </td>
            <td className="num" style={{ fontWeight: 400 }}>
              {formatMoney(cash)}
            </td>
          </tr>
          <tr>
            <td colSpan={6} style={{ fontWeight: 400 }}>
              shundan karta
            </td>
            <td className="num" style={{ fontWeight: 400 }}>
              {formatMoney(card)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p style={{ marginTop: 28, display: 'flex', gap: 48 }}>
        <span>Tuzdi: ______________________</span>
        <span>Tekshirdi: ______________________</span>
      </p>
    </div>,
    document.body,
  );
}
