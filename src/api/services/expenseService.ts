import { apiClient } from '../client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'card';

export interface ExpenseCategory {
  id: number;
  name: string;
  is_active: boolean;
}

export interface ExpenseEmployee {
  id: number;
  full_name: string;
  is_active: boolean;
}

export interface Expense {
  id: number;
  category_id: number;
  category_name: string;
  employee_id: number | null;
  employee_name: string | null;
  amount: number;
  payment_method: PaymentMethod;
  description: string | null;
  note: string | null;
  expense_date: string | null;
  images: string[];
  created_by_username: string | null;
  created_at: string;
  edit_reason: string | null;
  edited_by_username: string | null;
  edited_at: string | null;
}

export interface ExpenseListResponse {
  items: Expense[];
  total: number;
  page: number;
  per_page: number;
}

export interface ExpenseFilters {
  date_from?: string;   // YYYY-MM-DD
  date_to?: string;     // YYYY-MM-DD
  datetime_from?: string; // ISO datetime
  datetime_to?: string;   // ISO datetime
  category_id?: number;
  employee_id?: number;
  payment_method?: PaymentMethod;
  created_by?: string;
  sort?: 'created_desc' | 'created_asc' | 'amount_desc' | 'amount_asc';
}

export interface CreateExpenseRequest {
  category_id: number;
  employee_id?: number | null;
  amount: number;
  payment_method: PaymentMethod;
  description?: string | null;
  note?: string | null;
  expense_date?: string | null;
  images?: string[];
}

export interface UpdateExpenseRequest {
  category_id?: number;
  employee_id?: number | null;
  amount?: number;
  payment_method?: PaymentMethod;
  description?: string | null;
  note?: string | null;
  expense_date?: string | null;
  images?: string[];
  edit_reason: string;
}

export interface DeleteExpenseRequest {
  reason: string;
}

export interface ExpenseSummaryResponse {
  total_count: number;
  total_amount: number;
  payment_method_breakdown: Record<string, { amount: number; count: number }>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const BASE = '/api/v1/expenses';

function getAdminHeaders() {
  const token = localStorage.getItem('access_token');
  return token ? { 'X-Admin-Authorization': `Bearer ${token}` } : {};
}

export const expenseService = {
  // Categories
  getCategories: async (): Promise<ExpenseCategory[]> => {
    const res = await apiClient.get<ExpenseCategory[]>(`${BASE}/categories`, { headers: getAdminHeaders() });
    return res.data;
  },
  createCategory: async (name: string): Promise<ExpenseCategory> => {
    const res = await apiClient.post<ExpenseCategory>(`${BASE}/categories`, { name }, { headers: getAdminHeaders() });
    return res.data;
  },
  updateCategory: async (id: number, data: { name?: string; is_active?: boolean }): Promise<ExpenseCategory> => {
    const res = await apiClient.patch<ExpenseCategory>(`${BASE}/categories/${id}`, data, { headers: getAdminHeaders() });
    return res.data;
  },
  deleteCategory: async (id: number): Promise<void> => {
    await apiClient.delete(`${BASE}/categories/${id}`, { headers: getAdminHeaders() });
  },

  // Employees
  getEmployees: async (): Promise<ExpenseEmployee[]> => {
    const res = await apiClient.get<ExpenseEmployee[]>(`${BASE}/employees`, { headers: getAdminHeaders() });
    return res.data;
  },
  createEmployee: async (full_name: string): Promise<ExpenseEmployee> => {
    const res = await apiClient.post<ExpenseEmployee>(`${BASE}/employees`, { full_name }, { headers: getAdminHeaders() });
    return res.data;
  },
  updateEmployee: async (id: number, data: { full_name?: string; is_active?: boolean }): Promise<ExpenseEmployee> => {
    const res = await apiClient.patch<ExpenseEmployee>(`${BASE}/employees/${id}`, data, { headers: getAdminHeaders() });
    return res.data;
  },
  deleteEmployee: async (id: number): Promise<void> => {
    await apiClient.delete(`${BASE}/employees/${id}`, { headers: getAdminHeaders() });
  },

  // Expenses
  getExpenses: async (page = 1, per_page = 20, filters: ExpenseFilters = {}): Promise<ExpenseListResponse> => {
    const res = await apiClient.get<ExpenseListResponse>(BASE, {
      params: { page, per_page, ...filters },
      headers: getAdminHeaders(),
    });
    return res.data;
  },
  createExpense: async (data: CreateExpenseRequest): Promise<Expense> => {
    const res = await apiClient.post<Expense>(BASE, data, { headers: getAdminHeaders() });
    return res.data;
  },
  updateExpense: async (id: number, data: UpdateExpenseRequest): Promise<Expense> => {
    const res = await apiClient.patch<Expense>(`${BASE}/${id}`, data, { headers: getAdminHeaders() });
    return res.data;
  },
  deleteExpense: async (id: number, reason: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}`, { data: { reason }, headers: getAdminHeaders() });
  },
  getSummary: async (filters: Omit<ExpenseFilters, 'sort' | 'created_by'> = {}): Promise<ExpenseSummaryResponse> => {
    const res = await apiClient.get<ExpenseSummaryResponse>(`${BASE}/summary`, {
      params: filters,
      headers: getAdminHeaders(),
    });
    return res.data;
  },

  // Upload expense images (receipts/proofs)
  uploadImages: async (files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const res = await apiClient.post<string[]>(`${BASE}/upload-images`, formData, {
      headers: {
        ...getAdminHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  // Export expenses to Excel
  exportExpenses: async (filters: Omit<ExpenseFilters, 'sort' | 'created_by'> = {}): Promise<Blob> => {
    const res = await apiClient.get(`${BASE}/export`, {
      params: filters,
      headers: getAdminHeaders(),
      responseType: 'blob',
    });
    return res.data;
  },

  // Get expense edit history
  getHistory: async (expenseId: number): Promise<{ id: number; field_name: string; old_value: string | null; new_value: string | null; changed_by_username: string | null; created_at: string }[]> => {
    const res = await apiClient.get(`${BASE}/${expenseId}/history`, { headers: getAdminHeaders() });
    return res.data;
  },
};
