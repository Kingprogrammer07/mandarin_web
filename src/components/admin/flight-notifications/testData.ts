import type {
  ClientNotificationStatus,
  NotificationSummary,
  SendTaskState,
} from "@/api/services/flightNotifications";

export function makeClient(
  overrides: Partial<ClientNotificationStatus> = {},
): ClientNotificationStatus {
  return {
    client_id: "M001",
    telegram_id: 1001,
    cargo_count: 2,
    total_weight: 3.5,
    total_price_uzs: 120000,
    is_sent: false,
    is_sent_bot: false,
    is_sent_web: false,
    sent_at: null,
    cargo_ids: [1],
    ...overrides,
  };
}

export function makeSummary(
  clients: ClientNotificationStatus[],
  flightName = "M284",
): NotificationSummary {
  const sent = clients.filter((client) => client.is_sent).length;
  return {
    flight_name: flightName,
    total_clients: clients.length,
    sent_count: sent,
    pending_count: clients.length - sent,
    bot_sent_count: clients.filter((client) => client.is_sent_bot).length,
    web_sent_count: clients.filter((client) => client.is_sent_web).length,
    clients,
  };
}

export function makeTask(
  overrides: Partial<SendTaskState> = {},
): SendTaskState {
  return {
    task_id: "task-1",
    status: "running",
    total: 10,
    sent: 3,
    failed: 1,
    skipped: 0,
    percent: 40,
    errors: [],
    started_at: "2026-10-12T10:00:00.000Z",
    finished_at: null,
    ...overrides,
  };
}
