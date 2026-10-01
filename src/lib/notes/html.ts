import sanitize from 'sanitize-html';

// The floating note is stored as HTML. Only the formatting the editor makes
// is kept: headings, lists and checklists, tables, quotes, bold and friends,
// text and highlight colours, and links to the person's own attachments.
const FILE = /^\/api\/note-files\/[0-9a-f-]{36}$/;
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i;

export function cleanNote(html: string): string {
  return sanitize(String(html).slice(0, 400_000), {
    allowedTags: ['p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'span', 'mark', 'h1', 'h2', 'h3', 'pre', 'code', 'blockquote', 'ul', 'ol', 'li', 'table', 'tbody', 'tr', 'td', 'img', 'audio', 'video', 'a', 'figure'],
    allowedAttributes: {
      ul: ['class'],
      li: ['data-checked'],
      span: ['style'],
      mark: ['style'],
      img: ['src', 'alt', 'data-kind'],
      audio: ['src', 'controls'],
      video: ['src', 'controls'],
      a: ['href', 'download', 'data-file'],
      figure: ['class'],
    },
    allowedClasses: { ul: ['checklist', 'dashed'], figure: ['file'] },
    allowedStyles: { '*': { color: [COLOR], 'background-color': [COLOR] } },
    allowedSchemes: [],
    allowedSchemesAppliedToAttributes: [],
    exclusiveFilter: (frame) => ['img', 'audio', 'video'].includes(frame.tag) && !FILE.test(frame.attribs['src'] ?? ''),
    transformTags: {
      a: (tagName, attribs) => (FILE.test(attribs['href'] ?? '') ? { tagName, attribs } : { tagName: 'span', attribs: {} }),
    },
  });
}
