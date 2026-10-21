import { useSyncExternalStore } from "react";

/**
 * Whether a photo camera (`CameraCapture`) is open anywhere on the page.
 *
 * A phone gives its camera to one stream at a time: on iOS opening a second
 * one silences the first for good, on some Androids it fails outright. The
 * astatka's barcode scanner reads this and lets go of the camera while a
 * photo is being taken, then starts again.
 */
let openCount = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Mark a photo camera open; call the returned function when it closes. */
export function holdPhotoCamera(): () => void {
  openCount += 1;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openCount -= 1;
    notify();
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePhotoCameraOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => openCount > 0,
    () => false,
  );
}
