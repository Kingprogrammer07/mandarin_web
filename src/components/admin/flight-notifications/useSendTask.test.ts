import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({ apiClient: {}, apiClientFormData: {} }));
vi.mock("@/api/services/flightNotifications", () => ({
  startSendNotifications: vi.fn(),
  getSendTaskState: vi.fn(),
  getActiveSendTask: vi.fn(),
  cancelSendTask: vi.fn(),
}));

import {
  getActiveSendTask,
  getSendTaskState,
  startSendNotifications,
  type SendTaskState,
} from "@/api/services/flightNotifications";

import { MAX_POLL_FAILURES, POLL_INTERVAL_MS } from "./sendTask";
import { makeTask } from "./testData";
import { useSendTask } from "./useSendTask";

const startApi = vi.mocked(startSendNotifications);
const stateApi = vi.mocked(getSendTaskState);
const activeApi = vi.mocked(getActiveSendTask);

const REQUEST = {
  client_ids: ["M001"],
  only_pending: false,
  mark_bot: false,
  mark_web: true,
};

/** Mounts the hook and lets its reload recovery settle. */
async function mountHook() {
  const notifyError = vi.fn();
  const hook = renderHook(() => useSendTask("M284", notifyError));
  await act(async () => {});
  return { ...hook, notifyError };
}

async function tick(times = 1) {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  localStorage.clear();
  activeApi.mockResolvedValue(null);
  startApi.mockResolvedValue({
    task_id: "task-1",
    total_clients: 10,
    message: "ok",
  });
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("useSendTask", () => {
  it("ignores a late 'running' from an older poll once the end was shown", async () => {
    let answerSlowPoll!: (state: SendTaskState) => void;
    stateApi
      .mockReturnValueOnce(
        new Promise<SendTaskState>((resolve) => {
          answerSlowPoll = resolve;
        }),
      )
      .mockResolvedValueOnce(
        makeTask({ status: "completed", sent: 10, failed: 0, percent: 100 }),
      );
    const { result } = await mountHook();

    await act(() => result.current.start(REQUEST));
    await tick(2);
    expect(result.current.taskState?.status).toBe("completed");

    await act(async () => {
      answerSlowPoll(makeTask({ status: "running" }));
    });
    expect(result.current.taskState?.status).toBe("completed");
    expect(result.current.hasUnfinishedTask).toBe(false);
  });

  it("only hides a task whose polls stopped answering: it stays tracked and can come back", async () => {
    stateApi.mockRejectedValue({ message: "Network Error" });
    const { result } = await mountHook();

    await act(() => result.current.start(REQUEST));
    await tick(MAX_POLL_FAILURES);
    expect(result.current.pollFailed).toBe(true);

    act(() => result.current.hide());
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.hasUnfinishedTask).toBe(true);
    expect(localStorage.getItem("cargo_send_task:M284")).toBe("task-1");

    stateApi.mockResolvedValue(makeTask({ status: "running" }));
    await act(async () => result.current.reopen());
    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.pollFailed).toBe(false);
  });

  it("forgets a finished task", async () => {
    stateApi.mockResolvedValue(
      makeTask({ status: "completed", sent: 10, failed: 0, percent: 100 }),
    );
    const { result } = await mountHook();

    await act(() => result.current.start(REQUEST));
    await tick();
    act(() => result.current.forget());

    expect(result.current.taskState).toBeNull();
    expect(result.current.hasUnfinishedTask).toBe(false);
    expect(localStorage.getItem("cargo_send_task:M284")).toBeNull();
  });

  it("follows a send already running on this flight instead of starting a second one", async () => {
    const { result, notifyError } = await mountHook();
    activeApi.mockResolvedValueOnce(makeTask({ task_id: "task-7" }));

    await act(() => result.current.start(REQUEST));

    expect(startApi).not.toHaveBeenCalled();
    expect(result.current.taskState?.task_id).toBe("task-7");
    expect(result.current.isDialogOpen).toBe(true);
    expect(localStorage.getItem("cargo_send_task:M284")).toBe("task-7");
    expect(notifyError).toHaveBeenCalledWith(
      expect.stringMatching(/allaqachon davom etmoqda/),
    );
  });
});
