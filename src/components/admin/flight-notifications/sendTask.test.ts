import { describe, expect, it } from "vitest";

import {
  activeTaskKey,
  errorMessage,
  formatDuration,
  initialTaskState,
  isTaskFinished,
  sendProgress,
} from "./sendTask";
import { makeTask } from "./testData";

const START = Date.parse("2026-10-12T10:00:00.000Z");

describe("sendProgress", () => {
  it("estimates the remaining time from the rate so far", () => {
    // 4 of 10 processed in 40 s → 0.1/s → 60 s left.
    const progress = sendProgress(makeTask(), START + 40_000);
    expect(progress).toMatchObject({
      processed: 4,
      percent: 40,
      isDone: false,
      wasCancelled: false,
      etaText: "~1 daqiqa qoldi",
    });
  });

  it("has no estimate before anything was processed or once done", () => {
    expect(
      sendProgress(makeTask({ sent: 0, failed: 0, percent: 0 }), START + 5_000)
        .etaText,
    ).toBeNull();
    expect(
      sendProgress(makeTask({ status: "completed" }), START + 5_000).etaText,
    ).toBeNull();
  });

  it("reads a failed task that stopped early as cancelled", () => {
    expect(
      sendProgress(makeTask({ status: "failed" }), START).wasCancelled,
    ).toBe(true);
    expect(
      sendProgress(
        makeTask({ status: "failed", sent: 9, failed: 1, percent: 100 }),
        START,
      ).wasCancelled,
    ).toBe(false);
  });

  it("clamps the percent into 0–100 for the bar", () => {
    expect(sendProgress(makeTask({ percent: 140 }), START).percent).toBe(100);
    expect(sendProgress(makeTask({ percent: -3 }), START).percent).toBe(0);
  });
});

describe("task helpers", () => {
  it("formats durations the way the dialog always did", () => {
    expect(formatDuration(12.4)).toBe("12 soniya");
    expect(formatDuration(120)).toBe("2 daqiqa");
    expect(formatDuration(135)).toBe("2 daq 15 son");
  });

  it("knows the finished statuses and the storage key", () => {
    expect(isTaskFinished("completed")).toBe(true);
    expect(isTaskFinished("failed")).toBe(true);
    expect(isTaskFinished("running")).toBe(false);
    expect(activeTaskKey("M284")).toBe("cargo_send_task:M284");
  });

  it("builds the optimistic running state", () => {
    expect(initialTaskState("t-1", 7, "2026-10-12T10:00:00.000Z")).toEqual(
      makeTask({
        task_id: "t-1",
        total: 7,
        sent: 0,
        failed: 0,
        percent: 0,
      }),
    );
  });

  it("takes the API client's message and falls back otherwise", () => {
    expect(errorMessage({ message: "Server xatosi", status: 500 }, "x")).toBe(
      "Server xatosi",
    );
    expect(errorMessage(new Error("boom"), "x")).toBe("boom");
    expect(errorMessage({ message: "  " }, "fallback")).toBe("fallback");
    expect(errorMessage("text", "fallback")).toBe("fallback");
    expect(errorMessage(null, "fallback")).toBe("fallback");
  });
});
