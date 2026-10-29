import { describe, expect, it } from 'vitest';
import { buildProhibitedShareText, buildProhibitedShareUrl } from './prohibitedShare';

const list = {
  header_title: 'TAQIQLANGAN',
  header_subtitle: 'Diqqat',
  items: [
    { title: 'Batareyalar', examples: '(powerbank)' },
    { title: 'Suyuqliklar', examples: null },
  ],
  footer_note: 'Eslatma',
};

describe('prohibited items share', () => {
  it('numbers every item and keeps header and footer', () => {
    expect(buildProhibitedShareText(list)).toBe(
      'TAQIQLANGAN\nDiqqat\n\n1. Batareyalar (powerbank)\n2. Suyuqliklar\n\nEslatma',
    );
  });

  it('builds a Telegram share link with the text encoded', () => {
    const url = new URL(buildProhibitedShareUrl(list));
    expect(url.origin + url.pathname).toBe('https://t.me/share/url');
    expect(url.searchParams.get('url')).toBe('https://t.me/mandarin_cargo');
    expect(url.searchParams.get('text')).toBe(buildProhibitedShareText(list));
  });
});
