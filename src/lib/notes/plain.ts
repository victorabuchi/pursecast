// Notes written before formatting: plain lines, "☐ " and "☑ " checklists.
export function fromPlain(text: string): string {
  if (!text || /^\s*</.test(text)) return text;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(`<ul class="checklist">${list.join('')}</ul>`);
    list = [];
  };
  for (const line of text.split('\n')) {
    const m = /^([☐☑]) (.*)$/.exec(line);
    if (m) list.push(`<li data-checked="${m[1] === '☑'}">${esc(m[2]!) || '<br>'}</li>`);
    else {
      flush();
      out.push(`<div>${esc(line) || '<br>'}</div>`);
    }
  }
  flush();
  return out.join('');
}
