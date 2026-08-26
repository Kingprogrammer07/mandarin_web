import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { expenseService, type ExpenseFilters } from '../services/expenseService';
import { apiErrorMessage } from '@/utils/apiError';

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (page: number, filters: ExpenseFilters) =>
    [...expenseKeys.all, 'list', page, filters] as const,
  summary: (filters: ExpenseFilters) =>
    [...expenseKeys.all, 'summary', filters] as const,
  categories: () => [...expenseKeys.all, 'categories'] as const,
  employees: () => [...expenseKeys.all, 'employees'] as const,
};

// ── Categories ────────────────────────────────────────────────────────────────

export function useExpenseCategories() {
  return useQuery({
    queryKey: expenseKeys.categories(),
    queryFn: () => expenseService.getCategories(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => expenseService.createCategory(name),
    onSuccess: () => {
      toast.success("Toifa qo'shildi");
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories() });
    },
    onError: () => toast.error("Toifa qo'shishda xatolik"),
  });
}

export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; is_active?: boolean } }) =>
      expenseService.updateCategory(id, data),
    onSuccess: () => {
      toast.success("Toifa yangilandi");
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories() });
    },
    onError: () => toast.error("Toifa yangilashda xatolik"),
  });
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => expenseService.deleteCategory(id),
    onSuccess: () => {
      toast.success("Toifa o'chirildi");
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories() });
    },
    onError: () => toast.error("Toifa o'chirishda xatolik"),
  });
}

// ── Employees ─────────────────────────────────────────────────────────────────

export function useExpenseEmployees() {
  return useQuery({
    queryKey: expenseKeys.employees(),
    queryFn: () => expenseService.getEmployees(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateExpenseEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (full_name: string) => expenseService.createEmployee(full_name),
    onSuccess: () => {
      toast.success("Xodim qo'shildi");
      queryClient.invalidateQueries({ queryKey: expenseKeys.employees() });
    },
    onError: () => toast.error("Xodim qo'shishda xatolik"),
  });
}

export function useUpdateExpenseEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { full_name?: string; is_active?: boolean } }) =>
      expenseService.updateEmployee(id, data),
    onSuccess: () => {
      toast.success("Xodim yangilandi");
      queryClient.invalidateQueries({ queryKey: expenseKeys.employees() });
    },
    onError: () => toast.error("Xodim yangilashda xatolik"),
  });
}

export function useDeleteExpenseEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => expenseService.deleteEmployee(id),
    onSuccess: () => {
      toast.success("Xodim o'chirildi");
      queryClient.invalidateQueries({ queryKey: expenseKeys.employees() });
    },
    onError: () => toast.error("Xodim o'chirishda xatolik"),
  });
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export function useExpenses(page = 1, per_page = 20, filters: ExpenseFilters = {}) {
  return useQuery({
    queryKey: expenseKeys.list(page, filters),
    queryFn: () => expenseService.getExpenses(page, per_page, filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useExpenseSummary(filters: Omit<ExpenseFilters, 'sort' | 'created_by'> = {}) {
  return useQuery({
    queryKey: expenseKeys.summary(filters),
    queryFn: () => expenseService.getSummary(filters),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: expenseService.createExpense,
    onSuccess: () => {
      toast.success("Rasxod qo'shildi");
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Rasxod qo'shishda xatolik"));
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof expenseService.updateExpense>[1] }) =>
      expenseService.updateExpense(id, data),
    onSuccess: () => {
      toast.success("Rasxod yangilandi");
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Rasxod yangilashda xatolik"));
    },
  });
}

export function useUploadExpenseImages() {
  return useMutation({
    mutationFn: (files: File[]) => expenseService.uploadImages(files),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      expenseService.deleteExpense(id, reason),
    onSuccess: () => {
      toast.success("Rasxod o'chirildi");
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Rasxod o'chirishda xatolik"));
    },
  });
}

export function useExpenseHistory(expenseId: number | null) {
  return useQuery({
    queryKey: ['expense-history', expenseId],
    queryFn: () => (expenseId ? expenseService.getHistory(expenseId) : Promise.resolve([])),
    enabled: expenseId !== null,
  });
}
