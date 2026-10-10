/**
 * Turn bot-generated Telegram rich-message HTML into a small, safe tree for a
 * preview.
 *
 * The daily report is sent with `sendRichMessage`: headings, paragraphs,
 * tables and a collapsible block. The browser's own parser reads the string
 * (DOMParser never runs scripts), and only a fixed set of tags survives into
 * the tree, with `align` and `colspan` as the only attributes. Nothing is ever
 * handed to `dangerouslySetInnerHTML`: client codes and flight names come from
 * user data, and anything unexpected is shown as its text or dropped.
 */
export const RICH_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'code',
  'pre',
  'br',
  'hr',
  'blockquote',
  'ul',
  'ol',
  'li',
  'table',
  'caption',
  'tr',
  'th',
  'td',
  'details',
  'summary',
  'footer',
] as const;

export type RichTag = (typeof RICH_TAGS)[number];

export type RichNode =
  | { kind: 'text'; text: string }
  | {
      kind: 'element';
      tag: RichTag;
      align?: 'left' | 'center' | 'right';
      colSpan?: number;
      children: RichNode[];
    };

const ALLOWED = new Set<string>(RICH_TAGS);
/** Dropped with everything inside them. */
const DROPPED = new Set(['script', 'style', 'template', 'noscript', 'iframe', 'object']);
const ALIGNS = new Set(['left', 'center', 'right']);

function convert(node: Node): RichNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    return text ? [{ kind: 'text', text }] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (DROPPED.has(tag)) return [];

  const children = Array.from(element.childNodes).flatMap(convert);
  // tbody/thead (inserted by the parser), <tg-emoji> and anything unknown:
  // keep what is inside, lose the tag.
  if (!ALLOWED.has(tag)) return children;

  const result: RichNode = { kind: 'element', tag: tag as RichTag, children };
  if (tag === 'td' || tag === 'th') {
    const align = element.getAttribute('align')?.toLowerCase();
    if (align && ALIGNS.has(align)) result.align = align as 'left' | 'center' | 'right';
    const colSpan = Number(element.getAttribute('colspan'));
    if (Number.isInteger(colSpan) && colSpan > 1 && colSpan <= 20) result.colSpan = colSpan;
  }
  return [result];
}

export function parseTelegramRichHtml(html: string): RichNode[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return Array.from(doc.body.childNodes).flatMap(convert);
}
