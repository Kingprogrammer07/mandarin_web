import { CHANNEL_TELEGRAM_URL } from '@/config/contacts';

interface ProhibitedList {
  header_title: string;
  header_subtitle: string;
  items: { title: string; examples: string | null }[];
  footer_note: string;
}

/** Plain-text copy of the prohibited-items list, ready for a Telegram message. */
export function buildProhibitedShareText(list: ProhibitedList): string {
  const rows = list.items.map((item, i) =>
    item.examples ? `${i + 1}. ${item.title} ${item.examples}` : `${i + 1}. ${item.title}`,
  );
  return [list.header_title, list.header_subtitle, '', ...rows, '', list.footer_note].join('\n');
}

/**
 * t.me/share/url opens Telegram's own chat picker. `url` is mandatory there, so
 * it carries the channel link and the list goes in `text`.
 */
export function buildProhibitedShareUrl(list: ProhibitedList): string {
  return `https://t.me/share/url?url=${encodeURIComponent(CHANNEL_TELEGRAM_URL)}&text=${encodeURIComponent(
    buildProhibitedShareText(list),
  )}`;
}
