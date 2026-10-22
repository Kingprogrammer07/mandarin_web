import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AstatkaShelfNoteProps {
  /** The astatka (O… flight) that now holds this flight's bag. */
  astatkaFlightName: string;
}

/**
 * "Ostatkada: OSTATKA-21.10.2026" under a flight.
 *
 * The debt of an astatka bag stays on the flight it came on, so that flight is
 * the one the client pays. This line says where the bag now waits. The name
 * wraps as a whole instead of truncating: a clipped date names another astatka.
 */
export function AstatkaShelfNote({ astatkaFlightName }: AstatkaShelfNoteProps) {
  const { t } = useTranslation();
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] font-semibold text-mc-text-2">
      <Package className="h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden="true" />
      {t('shipments.inAstatka', 'Ostatkada:')}
      <span className="min-w-0 break-words font-bold text-mc-text">{astatkaFlightName}</span>
    </span>
  );
}
