/**
 * Helper functions for Telegram Bot API
 */

/**
 * Get Telegram file URL from file_id
 * Note: In production, you should proxy this through your backend
 * to avoid exposing the bot token
 */
export const getTelegramFileUrl = (fileId: string): string => {
  // For development, we'll use a data URL or placeholder
  // In production, backend should provide a proxy endpoint like:
  // return `/api/v1/telegram/files/${fileId}`;

  // For now, return the file_id as-is (backend will handle)
  return fileId;
};

/**
 * Check if running in Telegram WebApp
 */
export const isTelegramWebApp = (): boolean => {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp;
};

/**
 * Get Telegram WebApp instance
 */
export const getTelegramWebApp = () => {
  if (isTelegramWebApp()) {
    return window.Telegram!.WebApp;
  }
  return null;
};
