import { useCallback, useEffect, useRef, useState } from "react";

import {
  cancelSendTask,
  getActiveSendTask,
  getSendTaskState,
  startSendNotifications,
  type SendRequest,
  type SendTaskState,
} from "@/api/services/flightNotifications";

import {
  activeTaskKey,
  errorMessage,
  initialTaskState,
  isTaskFinished,
  MAX_POLL_FAILURES,
  PENDING_PLACEHOLDER,
  POLL_INTERVAL_MS,
} from "./sendTask";

export interface SendTaskControls {
  taskState: SendTaskState | null;
  /** The progress dialog is up; it can be hidden while the task runs on. */
  isDialogOpen: boolean;
  /**
   * A task this device started or recovered has not reported an end yet —
   * even while its dialog is hidden. No second send may start meanwhile.
   */
  hasUnfinishedTask: boolean;
  isStarting: boolean;
  isCancelling: boolean;
  pollFailed: boolean;
  start: (request: SendRequest) => Promise<void>;
  cancel: () => Promise<void>;
  retryPolling: () => void;
  /** Closes the dialog but keeps following the task. */
  hide: () => void;
  /** Brings a hidden dialog back and asks for fresh numbers. */
  reopen: () => void;
  /** Forgets a finished task on this device: polling, the stored id, the dialog. */
  forget: () => void;
}

/**
 * One flight's bulk notification send: start it, follow its progress, stop it,
 * and pick it up again after a reload.
 *
 * The running task id is kept in localStorage per flight so a reloaded page
 * resumes the progress view instead of losing a send that is still going out.
 */
export function useSendTask(
  flightName: string,
  notifyError: (message: string) => void,
): SendTaskControls {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskState, setTaskState] = useState<SendTaskState | null>(null);
  const [isHidden, setIsHidden] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [pollFailed, setPollFailed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failuresRef = useRef(0);
  // The task the dialog belongs to. A poll answered after the operator closed
  // the dialog must not reopen it.
  const trackedIdRef = useRef<string | null>(null);
  // Polls overlap on a slow link (a 30 s timeout, a 5 s interval): once the
  // end has been shown, a late "running" from an older poll must not bring
  // the task back to life with nothing left to poll it.
  const finishedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyState = useCallback(
    (state: SendTaskState) => {
      setTaskState(state);
      if (isTaskFinished(state.status)) {
        finishedRef.current = true;
        stopPolling();
      }
    },
    [stopPolling],
  );

  const pollOnce = useCallback(
    async (id: string) => {
      try {
        const state = await getSendTaskState(id);
        if (trackedIdRef.current !== id || finishedRef.current) return;
        failuresRef.current = 0;
        setPollFailed(false);
        applyState(state);
      } catch {
        // A single failed poll is retried on the next tick; only a run of them
        // stops polling and tells the operator the numbers are stale.
        failuresRef.current += 1;
        if (
          trackedIdRef.current === id &&
          !finishedRef.current &&
          failuresRef.current >= MAX_POLL_FAILURES
        ) {
          stopPolling();
          setPollFailed(true);
        }
      }
    },
    [applyState, stopPolling],
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      trackedIdRef.current = id;
      finishedRef.current = false;
      failuresRef.current = 0;
      setPollFailed(false);
      pollRef.current = setInterval(() => {
        void pollOnce(id);
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, pollOnce],
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  /** Follows a task that is already running: after a reload, or a second start. */
  const resume = useCallback(
    (state: SendTaskState) => {
      localStorage.setItem(activeTaskKey(flightName), state.task_id);
      setTaskId(state.task_id);
      setTaskState(state);
      setIsHidden(false);
      startPolling(state.task_id);
    },
    [flightName, startPolling],
  );

  // Restore an in-progress send after page reload/reopen.
  //
  // Two recovery paths:
  //  1. A real task_id in localStorage → resume it directly.
  //  2. No id, or the "pending" placeholder (reload happened mid send-start),
  //     or a stale id whose state lookup failed → ask the server for any task
  //     still running on this flight (cargo_send_active index).
  useEffect(() => {
    let cancelled = false;
    const storageKey = activeTaskKey(flightName);

    const recoverFromServer = async () => {
      try {
        const active = await getActiveSendTask(flightName);
        if (cancelled) return;
        if (!active || isTaskFinished(active.status)) {
          localStorage.removeItem(storageKey);
          return;
        }
        resume(active);
      } catch {
        if (!cancelled) localStorage.removeItem(storageKey);
      }
    };

    const restore = async () => {
      const saved = localStorage.getItem(storageKey);
      if (saved && saved !== PENDING_PLACEHOLDER) {
        try {
          const state = await getSendTaskState(saved);
          if (cancelled) return;
          if (isTaskFinished(state.status)) {
            localStorage.removeItem(storageKey);
            return;
          }
          resume(state);
          return;
        } catch {
          // Stale/unknown id — fall through to server-side recovery.
        }
      }
      await recoverFromServer();
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [flightName, resume]);

  const start = useCallback(
    async (request: SendRequest) => {
      const storageKey = activeTaskKey(flightName);
      setIsStarting(true);
      try {
        // Another device (or another operator) may already be sending this
        // flight; a second task would message the same clients twice.
        let running: SendTaskState | null = null;
        try {
          running = await getActiveSendTask(flightName);
        } catch {
          // The check is a guard, not a gate: if it cannot answer, the start
          // request below will fail on the same network or go through.
        }
        if (running && !isTaskFinished(running.status)) {
          resume(running);
          notifyError(
            "Bu reysga yuborish allaqachon davom etmoqda — uning holati ko'rsatildi.",
          );
          return;
        }
        // Persist a placeholder BEFORE the request resolves so a reload in this
        // window can still recover the task via the server-side flight index.
        localStorage.setItem(storageKey, PENDING_PLACEHOLDER);
        try {
          const response = await startSendNotifications(flightName, request);
          localStorage.setItem(storageKey, response.task_id);
          setTaskId(response.task_id);
          setIsHidden(false);
          setTaskState(
            initialTaskState(
              response.task_id,
              response.total_clients,
              new Date().toISOString(),
            ),
          );
          startPolling(response.task_id);
        } catch (error) {
          // Drop the optimistic placeholder so reload recovery doesn't chase a
          // task that never started.
          localStorage.removeItem(storageKey);
          notifyError(errorMessage(error, "Yuborishni boshlashda xatolik"));
        }
      } finally {
        setIsStarting(false);
      }
    },
    [flightName, notifyError, resume, startPolling],
  );

  const cancel = useCallback(async () => {
    if (!taskId) return;
    setIsCancelling(true);
    try {
      // Polling picks up status="failed" and stops by itself.
      await cancelSendTask(taskId);
    } catch {
      notifyError("Bekor qilishda xatolik yuz berdi");
      setIsCancelling(false);
    }
  }, [taskId, notifyError]);

  const retryPolling = useCallback(() => {
    if (!taskId) return;
    startPolling(taskId);
    void pollOnce(taskId);
  }, [taskId, startPolling, pollOnce]);

  const hide = useCallback(() => setIsHidden(true), []);

  const reopen = useCallback(() => {
    setIsHidden(false);
    retryPolling();
  }, [retryPolling]);

  const forget = useCallback(() => {
    stopPolling();
    trackedIdRef.current = null;
    finishedRef.current = false;
    localStorage.removeItem(activeTaskKey(flightName));
    setTaskId(null);
    setTaskState(null);
    setIsHidden(false);
    setIsCancelling(false);
    setPollFailed(false);
  }, [flightName, stopPolling]);

  return {
    taskState,
    isDialogOpen: taskState !== null && !isHidden,
    hasUnfinishedTask: taskState !== null && !isTaskFinished(taskState.status),
    isStarting,
    isCancelling,
    pollFailed,
    start,
    cancel,
    retryPolling,
    hide,
    reopen,
    forget,
  };
}
