/**
 * The expense form sends exactly what the cashier typed: the whole amount,
 * the typed Tashkent date and time, and nothing until every required field
 * is filled. Editing keeps an untouched date and asks for a reason.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
const update = vi.fn();
const upload = vi.fn();
vi.mock('@/api/hooks/useExpenses', () => ({
  useCreateExpense: () => ({ mutateAsync: create }),
  useUpdateExpense: () => ({ mutateAsync: update }),
  useUploadExpenseImages: () => ({ mutateAsync: upload }),
}));

import type { Expense } from '@/api/services/expenseService';
import { tashkentNow } from '@/lib/expenses';
import { ExpenseForm } from './ExpenseForm';

const categories = [
  { id: 1, name: 'Logistika', is_active: true },
  { id: 2, name: 'Ombor', is_active: true },
];
const employees = [{ id: 5, full_name: 'Narzullo', is_active: true }];

const ROW: Expense = {
  id: 108,
  category_id: 1,
  category_name: 'Logistika',
  employee_id: 5,
  employee_name: 'Narzullo',
  amount: 12_000_000,
  payment_method: 'card',
  description: "M72 reys – avia tashish to'lovi",
  note: null,
  expense_date: '2026-10-29T14:32:00Z',
  images: [],
  created_by_username: 'kassa',
  created_at: '2026-10-29T09:34:00Z',
  edit_reason: null,
  edited_by_username: null,
  edited_at: null,
};

function renderForm(editing: Expense | null = null) {
  const onSaved = vi.fn();
  render(
    <ExpenseForm
      editing={editing}
      categories={categories}
      employees={employees}
      onSaved={onSaved}
      onCancelEdit={vi.fn()}
      titleId="f"
    />,
  );
  return { onSaved };
}

beforeEach(() => {
  create.mockReset().mockResolvedValue({});
  update.mockReset().mockResolvedValue({});
  upload.mockReset();
});

describe('ExpenseForm', () => {
  it('saves nothing until the required fields are filled', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Rasxodni saqlash' }));
    expect(await screen.findByText('Rasxod turini tanlang', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Tavsifni yozing')).toBeInTheDocument();
    expect(screen.getByText('Summani kiriting')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('sends the exact amount and the typed Tashkent time', async () => {
    const { onSaved } = renderForm();
    fireEvent.change(screen.getByLabelText(/Rasxod turi/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Tavsif/), { target: { value: '  Ombor ijarasi ' } });
    fireEvent.change(screen.getByLabelText(/Summa/), { target: { value: '3500000' } });
    expect(screen.getByLabelText(/Summa/)).toHaveValue('3 500 000');
    expect(screen.getByText("uch million besh yuz ming so'm")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Sana va vaqt/), { target: { value: '2026-10-28' } });
    fireEvent.change(screen.getByLabelText('Vaqt'), { target: { value: '09:05' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Karta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rasxodni saqlash' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toEqual({
      category_id: 2,
      employee_id: null,
      amount: 3_500_000,
      payment_method: 'card',
      description: 'Ombor ijarasi',
      images: [],
      note: null,
      expense_date: '2026-10-28T09:05:00.000Z',
    });
  });

  it('refuses a pasted amount with tiyin instead of guessing', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Summa/), { target: { value: '1500.50' } });
    expect(await screen.findByText("Tiyinsiz, butun so'mda kiriting")).toBeInTheDocument();
  });

  it('refuses a future date', async () => {
    renderForm();
    const [y] = tashkentNow().ymd.split('-');
    fireEvent.change(screen.getByLabelText(/Rasxod turi/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Tavsif/), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText(/Summa/), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText(/Sana va vaqt/), { target: { value: `${Number(y) + 1}-01-01` } });
    fireEvent.click(screen.getByRole('button', { name: 'Rasxodni saqlash' }));
    expect(await screen.findByText("Kelgusi sana bo'lmaydi")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('edits with a reason and keeps the date as it was', async () => {
    const { onSaved } = renderForm(ROW);
    expect(screen.getByLabelText(/Summa/)).toHaveValue('12 000 000');
    expect(screen.getByLabelText(/Sana va vaqt/)).toHaveValue('2026-10-29');
    expect(screen.getByLabelText('Vaqt')).toHaveValue('14:32');

    fireEvent.change(screen.getByLabelText(/Summa/), { target: { value: '12500000' } });
    fireEvent.click(screen.getByRole('button', { name: "O'zgarishni saqlash" }));
    expect(await screen.findByText("O'zgarish sababini yozing", { selector: 'p' })).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/O'zgarish sababi/), { target: { value: 'Kurs farqi' } });
    fireEvent.click(screen.getByRole('button', { name: "O'zgarishni saqlash" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(update.mock.calls[0][0]).toEqual({
      id: 108,
      data: {
        category_id: 1,
        employee_id: 5,
        amount: 12_500_000,
        payment_method: 'card',
        description: "M72 reys – avia tashish to'lovi",
        images: [],
        expense_date: '2026-10-29T14:32:00.000Z',
        edit_reason: 'Kurs farqi',
      },
    });
  });

  it('keeps an old amount with tiyin exactly when it is not touched', async () => {
    const { onSaved } = renderForm({ ...ROW, amount: 1500.5 });
    fireEvent.change(screen.getByLabelText(/O'zgarish sababi/), { target: { value: 'Tavsif' } });
    fireEvent.click(screen.getByRole('button', { name: "O'zgarishni saqlash" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(update.mock.calls[0][0].data.amount).toBe(1500.5);
  });
});
