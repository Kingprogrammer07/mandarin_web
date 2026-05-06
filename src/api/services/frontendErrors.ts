import axios from 'axios';
import { API_BASE_URL } from '@/config/config';

export type FrontendErrorType = 'network' | 'validation' | 'runtime' | 'api' | 'unknown';

interface FrontendErrorPayload {
  error_type: FrontendErrorType;
  message: string;
  url: string;
  user_agent: string;
  telegram_id: number | null;
  timestamp: string;
  stack: string | null;
  status: number | null;
  endpoint: string | null;
  additional_data: Record<string, unknown> | null;
}

interface ThrottleEntry {
  lastSent: string;
  count: number;
}

const PENDING_KEY = 'pending_frontend_errors';
const THROTTLE_KEY = 'frontend_error_throttle';
const THROTTLE_MS = 60 * 60 * 1000; // 1 hour

function getTelegramId(): number | null {
  try {
    const initData = window.Telegram?.WebApp?.initDataUnsafe;
    if (initData?.user?.id) {
      return initData.user.id;
    }
  } catch {
    // ignore
  }
  return null;
}

function hashError(errorType: string, message: string, url: string, stack: string | null): string {
  const stackSnippet = (stack ?? '').slice(0, 300);
  return `${errorType}::${message}::${url}::${stackSnippet}`;
}

function getThrottleMap(): Map<string, ThrottleEntry> {
  try {
    const raw = localStorage.getItem(THROTTLE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function setThrottleMap(map: Map<string, ThrottleEntry>): void {
  try {
    const obj: Record<string, ThrottleEntry> = {};
    for (const [k, v] of map) {
      obj[k] = v;
    }
    localStorage.setItem(THROTTLE_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

/** Check if this error should be throttled. Returns extra message if it should be sent with count. */
function checkThrottle(
  errorType: FrontendErrorType,
  message: string,
  url: string,
  stack: string | null
): { shouldSend: boolean; extraMessage?: string } {
  const hash = hashError(errorType, message, url, stack);
  const now = Date.now();
  const map = getThrottleMap();
  const entry = map.get(hash);

  if (!entry) {
    map.set(hash, { lastSent: new Date().toISOString(), count: 1 });
    setThrottleMap(map);
    return { shouldSend: true };
  }

  const lastSent = new Date(entry.lastSent).getTime();
  const elapsed = now - lastSent;

  if (elapsed < THROTTLE_MS) {
    // Still within throttle window — increment count but don't send
    entry.count += 1;
    setThrottleMap(map);
    return { shouldSend: false };
  }

  // Throttle window expired — send with count info if repeated
  const extraMessage = entry.count > 1 ? ` (yana ${entry.count} marta keldi)` : '';
  map.set(hash, { lastSent: new Date().toISOString(), count: 1 });
  setThrottleMap(map);
  return { shouldSend: true, extraMessage };
}

function buildPayload(
  errorType: FrontendErrorType,
  message: string,
  extras: Partial<Omit<FrontendErrorPayload, 'error_type' | 'message' | 'url' | 'user_agent' | 'telegram_id' | 'timestamp'>> = {}
): FrontendErrorPayload {
  return {
    error_type: errorType,
    message,
    url: window.location.href,
    user_agent: navigator.userAgent,
    telegram_id: getTelegramId(),
    timestamp: new Date().toISOString(),
    stack: extras.stack ?? null,
    status: extras.status ?? null,
    endpoint: extras.endpoint ?? null,
    additional_data: extras.additional_data ?? null,
  };
}

/** Send error to backend immediately; if it fails, queue for retry. */
export async function logFrontendError(
  errorType: FrontendErrorType,
  message: string,
  extras?: Partial<Omit<FrontendErrorPayload, 'error_type' | 'message' | 'url' | 'user_agent' | 'telegram_id' | 'timestamp'>>
): Promise<void> {
  const payload = buildPayload(errorType, message, extras);
  const { shouldSend, extraMessage } = checkThrottle(
    errorType,
    message,
    payload.url,
    payload.stack
  );

  if (!shouldSend) {
    return;
  }

  if (extraMessage) {
    payload.message += extraMessage;
  }

  try {
    await axios.post(`${API_BASE_URL}/log-frontend-error`, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    await flushPendingErrors();
  } catch {
    queuePendingError(payload);
  }
}

/** Queue an error in localStorage for later retry. */
function queuePendingError(payload: FrontendErrorPayload): void {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const queue: FrontendErrorPayload[] = raw ? JSON.parse(raw) : [];
    queue.push(payload);
    if (queue.length > 20) queue.shift();
    localStorage.setItem(PENDING_KEY, JSON.stringify(queue));
  } catch {
    // localStorage may be disabled
  }
}

/** Flush any pending errors from localStorage. Call this after successful API calls. */
export async function flushPendingErrors(): Promise<void> {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const queue: FrontendErrorPayload[] = JSON.parse(raw);
    if (!queue.length) return;

    const failed: FrontendErrorPayload[] = [];
    for (const payload of queue) {
      try {
        await axios.post(`${API_BASE_URL}/log-frontend-error`, payload, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        failed.push(payload);
      }
    }

    if (failed.length) {
      localStorage.setItem(PENDING_KEY, JSON.stringify(failed));
    } else {
      localStorage.removeItem(PENDING_KEY);
    }
  } catch {
    // ignore
  }
}

/** Install global error handlers. Call once at app startup. */
export function installGlobalErrorHandlers(): void {
  window.onerror = (msg, _url, _line, _col, err) => {
    const message = typeof msg === 'string' ? msg : String(msg);
    const stack = err?.stack ?? null;
    logFrontendError('runtime', message, { stack });
    return false; // let browser handle it too
  };

  window.onunhandledrejection = (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : null;
    logFrontendError('runtime', `Unhandled rejection: ${message}`, { stack });
  };
}
