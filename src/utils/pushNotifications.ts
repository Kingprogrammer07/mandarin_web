/**
 * Browser Push Notification helpers.
 *
 * Uses the Page Visibility API + Notifications API to alert warehouse
 * staff when new queues arrive while the tab is in the background.
 *
 * Web Push (service-worker based) infrastructure is also provided;
 * the actual server-side push sending must be implemented separately.
 */

const SUBSCRIPTION_KEY = "push_subscription";

// ─── Permission ─────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export function getNotificationPermission(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

// ─── Local notification (immediate, no server needed) ───────────────────────

interface LocalNotifyOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  vibrate?: number[];
}

export function showLocalNotification(options: LocalNotifyOptions): Notification | null {
  if (!("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;

  const notif = new Notification(options.title, {
    body: options.body,
    icon: options.icon ?? "/mandarin_cargo_logo.png",
    badge: options.badge ?? "/mandarin_cargo_logo.png",
    tag: options.tag ?? "pickup-queue",
    requireInteraction: options.requireInteraction ?? false,
    vibrate: options.vibrate ?? [200, 100, 200],
  } as NotificationOptions);

  notif.onclick = () => {
    window.focus();
    notif.close();
  };

  return notif;
}

// ─── Vibration (mobile) ─────────────────────────────────────────────────────

export function vibratePattern(pattern: number[] = [200, 100, 200]): void {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

// ─── Page Visibility ────────────────────────────────────────────────────────

export function isPageVisible(): boolean {
  return document.visibilityState === "visible";
}

export function addVisibilityChangeListener(callback: (visible: boolean) => void): () => void {
  const handler = () => callback(document.visibilityState === "visible");
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}

// ─── Web Push infrastructure (requires backend support) ─────────────────────

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Subscribe to push notifications via the service worker.
 * Returns the PushSubscription JSON so the frontend can send it
 * to the backend (or stores it locally for now).
 *
 * @param vapidPublicKey — VAPID public key from backend config.
 */
export async function subscribeToPushNotifications(
  vapidPublicKey: string,
): Promise<PushSubscriptionJSON | null> {
  if (!("serviceWorker" in navigator)) return null;
  if (!("PushManager" in window)) return null;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    return existing.toJSON() as PushSubscriptionJSON;
  }

  const permission = await requestNotificationPermission();
  if (permission !== "granted") return null;

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const json = subscription.toJSON() as PushSubscriptionJSON;
  localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(json));
  return json;
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return false;

  const ok = await sub.unsubscribe();
  if (ok) localStorage.removeItem(SUBSCRIPTION_KEY);
  return ok;
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}
