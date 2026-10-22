/**
 * The pin rule for "mandarin" delivery requests. The form uses it to explain
 * why it will not submit; the backend (`geo.in_courier_area`) uses the same
 * box and is the authority, so the two must agree at the edges.
 */

import { describe, expect, it } from 'vitest';

import { isInCourierArea } from './courierArea';

describe('isInCourierArea', () => {
  it('accepts a point in central Tashkent', () => {
    expect(isInCourierArea({ latitude: 41.3111, longitude: 69.2797 })).toBe(true);
  });

  it('accepts the exact edges of the box', () => {
    expect(isInCourierArea({ latitude: 41.0, longitude: 68.9 })).toBe(true);
    expect(isInCourierArea({ latitude: 41.6, longitude: 69.8 })).toBe(true);
  });

  it('refuses other cities and the 0/0 placeholder', () => {
    expect(isInCourierArea({ latitude: 39.6542, longitude: 66.9597 })).toBe(false); // Samarkand
    expect(isInCourierArea({ latitude: 0, longitude: 0 })).toBe(false);
    expect(isInCourierArea({ latitude: 41.31, longitude: 70.2 })).toBe(false); // east of the box
  });
});
