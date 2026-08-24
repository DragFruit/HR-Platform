/** HTML from Bitrix landings is often inline (`<a>`, `<br>`) without `<p>`/`<div>`. */

const ESCAPED_TAG = /&lt;(?:\/?[a-z]+|br)\b/i;
const HTML_TAG =
  /<(?:p|h[1-4]|div|ul|ol|li|blockquote|span|pre|strong|em|u|s|del|strike|a|br|i|b|img|table|hr|font|noindex|tbody|thead|tr|td|th)\b/i;

export function looksLikeKnowledgeHtml(src: string): boolean {
  return HTML_TAG.test(src);
}

export function looksLikeEscapedKnowledgeHtml(src: string): boolean {
  return ESCAPED_TAG.test(src);
}

export function decodeEscapedKnowledgeHtml(src: string): string {
  let out = src;
  for (let i = 0; i < 3; i++) {
    if (!looksLikeEscapedKnowledgeHtml(out)) break;
    out = out
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }
  return out;
}

export function stripUnmatchedClosingDivs(html: string): string {
  const opens = (html.match(/<div\b/gi) || []).length;
  const closes = (html.match(/<\/div>/gi) || []).length;
  let out = html;
  let extra = closes - opens;
  while (extra > 0 && /<\/div>\s*$/i.test(out)) {
    out = out.replace(/<\/div>\s*$/i, '');
    extra -= 1;
  }
  return out.trimEnd();
}

/** Keep inline Bitrix HTML as HTML so the editor does not treat it as markdown. */
export function wrapLooseKnowledgeHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return html;
  if (/^<(p|div|h[1-4]|ul|ol|blockquote|table|pre)\b/i.test(trimmed)) return html;
  if (!looksLikeKnowledgeHtml(trimmed)) return html;
  return `<div>${trimmed}</div>`;
}

export function normalizeKnowledgeArticleBody(raw: string): string {
  const decoded = decodeEscapedKnowledgeHtml(String(raw || ''));
  const stripped = stripUnmatchedClosingDivs(decoded);
  return wrapLooseKnowledgeHtml(stripped);
}
