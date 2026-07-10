import { apiClientFormData } from '@/api/client';

export interface ImportResponse {
  message: string;
  imported_count?: number;
  errors?: string[];
}

/**
 * O'zbekiston bazasiga Excel import qilish.
 * @param flightName Operator kiritgan reys nomi — barcha qatorlarga qo'llanadi.
 */
export async function importUzDatabase(
  file: File,
  flightName: string,
): Promise<ImportResponse> {
  const formData = new FormData();
  formData.append('excel_file', file);
  formData.append('flight_name', flightName);

  const response = await apiClientFormData.post<ImportResponse>(
    '/api/v1/import/uz',
    formData
  );
  return response.data;
}

/**
 * Xitoy bazasiga Excel import qilish.
 * @param flightName Operator kiritgan reys nomi — barcha qatorlarga qo'llanadi.
 */
export async function importChinaDatabase(
  file: File,
  flightName: string,
): Promise<ImportResponse> {
  const formData = new FormData();
  formData.append('excel_file', file);
  formData.append('flight_name', flightName);

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
  databaseType: 'uz' | 'china',
  flightName: string,
): Promise<ImportResponse> {
  if (databaseType === 'uz') {
    return importUzDatabase(file, flightName);
  } else {
    return importChinaDatabase(file, flightName);
  }
}
