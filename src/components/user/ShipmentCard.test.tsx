/**
 * An astatka bag's debt stays on the flight it came on, so the client pays
 * that flight. The card says which astatka now holds the bag.
 */
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import i18n from '@/i18n/config';
import type { ShipmentItem } from '@/api/services/shipmentService';
import { ShipmentCard } from './ShipmentCard';

const shipment: ShipmentItem = {
  flight_name: 'M286-M287',
  manifest_flight_name: null,
  tab: 'active',
  total_count: 1,
  total_weight: 4.2,
  is_scanned: true,
  is_sent_web: true,
  is_taken_away: false,
  payment_status: 'pending',
  total_amount: 120000,
  paid_amount: 0,
  remaining_amount: 120000,
  scanned_at: null,
  taken_away_date: null,
  last_update: null,
};

beforeAll(async () => {
  await i18n.changeLanguage('uz');
});

describe('ShipmentCard astatka note', () => {
  it('names the astatka holding the bag, in full', () => {
    render(
      <ShipmentCard
        shipment={{ ...shipment, astatka_flight_name: 'OSTATKA-21.10.2026' }}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('OSTATKA-21.10.2026')).toBeTruthy();
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain(
      'Ostatkada: OSTATKA-21.10.2026',
    );
  });

  it('says nothing when the bag is on no shelf or the backend predates it', () => {
    render(<ShipmentCard shipment={shipment} onOpen={() => {}} />);
    expect(screen.queryByText(/Ostatkada/)).toBeNull();
  });
});
