import { useCallback, useState } from "react";

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : stored === "1";
  } catch {
    // Private mode or blocked storage: the switch still works, it just
    // forgets itself on reload.
    return fallback;
  }
}

/**
 * An on/off preference remembered on this device, such as "work mode on" or
 * "saved list hidden". Not for anything that has to be true elsewhere.
 */
export function useStoredFlag(
  key: string,
  fallback: boolean,
): [boolean, (next: boolean | ((current: boolean) => boolean)) => void] {
  const [value, setValue] = useState(() => readFlag(key, fallback));

  const update = useCallback(
    (next: boolean | ((current: boolean) => boolean)) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        try {
          window.localStorage.setItem(key, resolved ? "1" : "0");
        } catch {
          // See readFlag.
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update];
}
