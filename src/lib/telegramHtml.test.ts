import { describe, expect, it } from 'vitest';

import { parseTelegramRichHtml, type RichNode } from './telegramHtml';

function text(nodes: RichNode[]): string {
  return nodes
    .map((node) => (node.kind === 'text' ? node.text : text(node.children)))
    .join('');
}

describe('parseTelegramRichHtml', () => {
  it('keeps headings, tables and cell alignment', () => {
    const nodes = parseTelegramRichHtml(
      '<h3>📊 Kunlik</h3><table bordered striped><tr><td>💵 Naqd</td>' +
        '<td align="right" colspan="2">150 000</td></tr></table>',
    );

    expect(nodes.map((node) => node.kind === 'element' && node.tag)).toEqual(['h3', 'table']);
    const table = nodes[1] as Extract<RichNode, { kind: 'element' }>;
    // The parser's own <tbody> is dropped; the row sits right under the table.
    const row = table.children[0] as Extract<RichNode, { kind: 'element' }>;
    expect(row.tag).toBe('tr');
    expect(row.children[1]).toMatchObject({ tag: 'td', align: 'right', colSpan: 2 });
  });

  it('decodes escaped user data and never treats it as markup', () => {
    const nodes = parseTelegramRichHtml('<p>S&lt;img src=x onerror=alert(1)&gt; · M&amp;1</p>');
    expect(text(nodes)).toBe('S<img src=x onerror=alert(1)> · M&1');
    expect(JSON.stringify(nodes)).not.toContain('"tag":"img"');
  });

  it('drops scripts and unknown tags but keeps their text', () => {
    const nodes = parseTelegramRichHtml(
      '<script>alert(1)</script><a href="javascript:x">link</a>' +
        '<tg-emoji emoji-id="5">📊</tg-emoji><b>x</b>',
    );
    expect(text(nodes)).toBe('link📊x');
    expect(JSON.stringify(nodes)).not.toContain('javascript');
  });
});
