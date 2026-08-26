import { describe, expect, it } from 'vitest';

import { describeApiFailure, describeSearchFailure } from './apiErrors';

describe('describeApiFailure', () => {
  it('reads the domain refusal code and message', () => {
    const result = describeApiFailure({
      status: 409,
      data: { detail: { code: 'STALE_AMOUNT', error: 'Amount changed' } },
    });
    expect(result.code).toBe('STALE_AMOUNT');
    expect(result.message).toBe('Amount changed');
  });

  it('never returns an empty message for a validation 422', () => {
    // FastAPI sends `detail` as an ARRAY here. `typeof [] === 'object'`, so a
    // typeof-only narrowing reads undefined for both fields and the caller
    // renders nothing — a Save button that silently does nothing.
    const result = describeApiFailure({
      status: 422,
      message: 'Request failed with status code 422',
      data: {
        detail: [{ code: 'validation_error', message: 'One or more fields failed validation.' }],
      },
    });
    expect(result.code).toBeNull();
    expect(result.message).toBe('Request failed with status code 422');
  });

  it('falls back to the supplied text when there is no message at all', () => {
    const result = describeApiFailure({ status: 500, data: { detail: [] } });
    expect(result.message).toBe('O‘zgartirishda xatolik yuz berdi');
  });

  it('uses a string detail verbatim', () => {
    const result = describeApiFailure({
      status: 400,
      data: { detail: 'Flight not found' },
    });
    expect(result.code).toBeNull();
    expect(result.message).toBe('Flight not found');
  });

  it('ignores a blank string detail rather than showing an empty banner', () => {
    const result = describeApiFailure({
      status: 400,
      message: 'Bad Request',
      data: { detail: '   ' },
    });
    expect(result.message).toBe('Bad Request');
  });

  it('survives a rejection with no body at all', () => {
    expect(describeApiFailure(new Error('Network Error')).message).toBe(
      'Network Error',
    );
    expect(describeApiFailure(undefined).message).toBe(
      'O‘zgartirishda xatolik yuz berdi',
    );
  });

  it('keeps the code but still produces a message when only the code is sent', () => {
    const result = describeApiFailure({
      status: 409,
      message: 'Conflict',
      data: { detail: { code: 'CARGO_ALREADY_TAKEN' } },
    });
    expect(result.code).toBe('CARGO_ALREADY_TAKEN');
    expect(result.message).toBe('Conflict');
  });
});

describe('describeSearchFailure', () => {
  it('names the query only for a genuine 404', () => {
    expect(describeSearchFailure({ status: 404 }, 'M265')).toContain('M265');
    expect(describeSearchFailure({ status: 404 }, 'M265')).toContain('topilmadi');
  });

  it('does not claim "not found" for an expired session', () => {
    const message = describeSearchFailure({ status: 401 }, 'M265');
    expect(message).not.toContain('topilmadi');
    expect(message).toContain('Sessiya');
  });

  it('does not claim "not found" for a server error', () => {
    const message = describeSearchFailure({ status: 503 }, 'M265');
    expect(message).not.toContain('topilmadi');
    expect(message).toContain('503');
  });

  it('does not claim "not found" when the request never reached the server', () => {
    const message = describeSearchFailure({}, 'M265');
    expect(message).not.toContain('topilmadi');
    expect(message).toContain('Aloqa');
  });

  it('reports an unexpected status with its number', () => {
    expect(describeSearchFailure({ status: 418 }, 'M265')).toContain('418');
  });
});
