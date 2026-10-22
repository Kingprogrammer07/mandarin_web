/**
 * A live GPS fix arrives over SSE and is written straight into the query
 * cache. It must only ever move the courier on a delivery the courier is
 * driving to: a delivered or waiting stop showing a moving courier would tell
 * the client something false.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/client', () => ({ apiClient: { get: vi.fn() } }));

import { applyCourierLocation, type CourierDelivery } from './courierService';

function delivery(overrides: Partial<CourierDelivery> = {}): CourierDelivery {
  return {
    public_id: '5f1c2c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
    status: 'on_the_way',
    delivery_date: '2026-10-22',
    position: 1,
    eta_window: '10:30–11:30',
    eta_at: '2026-10-22T06:00:00Z',
    courier_name: 'Aziz',
    address: 'Chilonzor 9',
    latitude: 41.28,
    longitude: 69.2,
    departed_at: '2026-10-22T05:30:00Z',
    delivered_at: null,
    postpone_reason: null,
    delivery_request_id: 7,
    items: [],
    courier: null,
    courier_car: null,
    courier_phone: null,
    arrived_at: null,
    fee_uzs: 30000,
    payment_choice: null,
    payment_method: null,
    paid_at: null,
    can_pay_online: false,
    online_pending: false,
    ...overrides,
  };
}

const fix = {
  public_id: '5f1c2c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  lat: 41.3,
  lon: 69.25,
  heading: 90,
  at: '2026-10-22T05:45:00Z',
};

describe('applyCourierLocation', () => {
  it('moves the courier on a delivery that is on the way', () => {
    const next = applyCourierLocation(delivery(), fix);
    expect(next?.courier).toEqual({
      latitude: 41.3,
      longitude: 69.25,
      heading: 90,
      recorded_at: '2026-10-22T05:45:00Z',
    });
  });

  it('keeps a missing heading as null, not 0 (north)', () => {
    const next = applyCourierLocation(delivery(), { ...fix, heading: undefined });
    expect(next?.courier?.heading).toBeNull();
  });

  it('ignores the fix for any other status', () => {
    for (const status of ['waiting', 'delivered', 'cancelled'] as const) {
      const current = delivery({ status });
      expect(applyCourierLocation(current, fix)).toBe(current);
    }
  });

  it('ignores a malformed fix and an empty cache', () => {
    const current = delivery();
    const broken = { ...fix, lat: 'x' } as unknown as typeof fix;
    expect(applyCourierLocation(current, broken)).toBe(current);
    expect(applyCourierLocation(undefined, fix)).toBeUndefined();
  });
});
