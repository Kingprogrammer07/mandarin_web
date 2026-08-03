/**
 * Shared styling for **native** `<select>` elements.
 *
 * A native dropdown's option list is drawn by the OS, not by the page, so
 * Tailwind classes on `<select>` never reach it. With a translucent dark
 * background (`dark:bg-white/5`) the closed control looked right while the open
 * list stayed white-on-white — unreadable in dark mode.
 *
 * Two things fix it together:
 *  - `dark:[color-scheme:dark]` tells the browser to render its own widgets
 *    dark, which is what actually restyles the popup;
 *  - a solid `dark:bg-[#111827]` on the control, since alpha over an unknown
 *    backdrop is what made the text wash out in the first place.
 *
 * Radix `Select` (in `components/ui/select.tsx`) renders its own list and does
 * not need any of this — use it for anything richer than a plain list.
 */
export const NATIVE_SELECT_CLASS = [
  'rounded-xl border px-3 py-2 text-sm font-semibold outline-none',
  'border-gray-200 bg-white text-gray-900',
  'dark:[color-scheme:dark] dark:border-white/10 dark:bg-[#111827] dark:text-white',
  'focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15',
  'disabled:opacity-50',
].join(' ');

/**
 * For `<option>` children. Firefox on Linux ignores `color-scheme` for options,
 * so the colours are stated explicitly as well.
 */
export const NATIVE_OPTION_CLASS = 'bg-white text-gray-900 dark:bg-[#111827] dark:text-white';
