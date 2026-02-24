import { apiClientFormData } from '@/api/client';

export interface ImportResponse {
  message: string;
  imported_count?: number;
  errors?: string[];
}

/**
 * O'zbekiston bazasiga Excel import qilish
 */
export async function importUzDatabase(file: File): Promise<ImportResponse> {
  const formData = new FormData();
  formData.append('excel_file', file);

  const response = await apiClientFormData.post<ImportResponse>(
    '/api/v1/import/uz', 
    formData
  );
  return response.data;
}

/**
 * Xitoy bazasiga Excel import qilish
 */
export async function importChinaDatabase(file: File): Promise<ImportResponse> {
  const formData = new FormData();
  formData.append('excel_file', file);

  const response = await apiClientFormData.post<ImportResponse>(
    '/api/v1/import/china',
    formData
  );
  return response.data;
}

/**
 * Universal import function
 */
export async function importExcel(
  file: File,
  databaseType: 'uz' | 'china'
): Promise<ImportResponse> {
  if (databaseType === 'uz') {
    return importUzDatabase(file);
  } else {
    return importChinaDatabase(file);
  }
}
