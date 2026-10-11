import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { AstatkaIndexResponse } from "@/api/services/astatkaFlights";
import type { WorkRow } from "@/lib/astatkaWorkQueue";

/**
 * The astatka window's memory on the device, per astatka flight.
 *
 * - `queues`: the work-mode rows, so a reload, a dead battery or a crashed
 *   Telegram does not lose an hour of scanning or a confirm still waiting for
 *   the internet.
 * - `indexes`: the last downloaded list of the astatka's bags, which answers
 *   scans when there is no network.
 * - `backups`: what "Tozalash" removed, so "Backupdan tiklash" can undo it.
 *
 * Every call swallows storage errors: a private window or a full disk must
 * cost the worker the offline safety net, never the screen.
 */

interface QueueRecord {
  flight: string;
  rows: WorkRow[];
  updatedAt: string;
}

export interface QueueBackup {
  id?: number;
  flight: string;
  savedAt: string;
  reason: string;
  rows: WorkRow[];
}

interface AstatkaWorkspaceDB extends DBSchema {
  queues: { key: string; value: QueueRecord };
  indexes: { key: string; value: AstatkaIndexResponse };
  backups: { key: number; value: QueueBackup; indexes: { by_flight: string } };
}

const DB_NAME = "mandarin-astatka-workspace";
const BACKUPS_KEPT_PER_FLIGHT = 10;

let dbPromise: Promise<IDBPDatabase<AstatkaWorkspaceDB>> | null = null;

function database(): Promise<IDBPDatabase<AstatkaWorkspaceDB>> {
  dbPromise ??= openDB<AstatkaWorkspaceDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore("queues", { keyPath: "flight" });
      db.createObjectStore("indexes", { keyPath: "astatka_flight_name" });
      const backups = db.createObjectStore("backups", {
        keyPath: "id",
        autoIncrement: true,
      });
      backups.createIndex("by_flight", "flight");
    },
  }).catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

const key = (flight: string) => flight.trim().toUpperCase();

export const astatkaWorkspaceDb = {
  async loadQueue(flight: string): Promise<WorkRow[]> {
    try {
      const record = await (await database()).get("queues", key(flight));
      return record?.rows ?? [];
    } catch {
      return [];
    }
  },

  async saveQueue(flight: string, rows: WorkRow[]): Promise<void> {
    try {
      await (await database()).put("queues", {
        flight: key(flight),
        rows,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Best effort — see the module comment.
    }
  },

  async loadIndex(flight: string): Promise<AstatkaIndexResponse | null> {
    try {
      return (await (await database()).get("indexes", key(flight))) ?? null;
    } catch {
      return null;
    }
  },

  async saveIndex(index: AstatkaIndexResponse): Promise<void> {
    try {
      await (await database()).put("indexes", {
        ...index,
        astatka_flight_name: key(index.astatka_flight_name),
      });
    } catch {
      // Best effort.
    }
  },

  async addBackup(flight: string, rows: WorkRow[], reason: string): Promise<void> {
    if (rows.length === 0) return;
    try {
      const db = await database();
      await db.add("backups", {
        flight: key(flight),
        savedAt: new Date().toISOString(),
        reason,
        rows,
      });
      const ids = (await db.getAllKeysFromIndex("backups", "by_flight", key(flight))).sort(
        (a, b) => a - b,
      );
      for (const id of ids.slice(0, Math.max(0, ids.length - BACKUPS_KEPT_PER_FLIGHT))) {
        await db.delete("backups", id);
      }
    } catch {
      // Best effort.
    }
  },

  async listBackups(flight: string): Promise<QueueBackup[]> {
    try {
      const rows = await (await database()).getAllFromIndex(
        "backups",
        "by_flight",
        key(flight),
      );
      return rows.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    } catch {
      return [];
    }
  },
};
