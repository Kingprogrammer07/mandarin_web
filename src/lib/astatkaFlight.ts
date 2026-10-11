/**
 * An astatka flight is an ordinary flight whose name starts with "O".
 *
 * It is created on the expected-cargo page like every other flight, and its
 * visibility on the Reyslar board works the same way; the prefix is the only
 * thing that sets it apart. The backend decides it with the same rule
 * (`is_astatka_flight_name` in `flight_names.py`), so keep the two in step.
 */
export const ASTATKA_FLIGHT_PREFIX = 'O';

/** Case- and padding-insensitive, like the board's own `UPPER(TRIM(name))` key. */
export function isAstatkaFlightName(name: string | null | undefined): boolean {
  return (name ?? '').trim().toUpperCase().startsWith(ASTATKA_FLIGHT_PREFIX);
}
