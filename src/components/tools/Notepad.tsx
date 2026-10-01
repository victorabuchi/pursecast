'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import tools from './tools.module.css';
import styles from './notes/notes.module.css';
import FloatWindow from './FloatWindow';
import { Lights } from './Calculator';
import Markup from './notes/Markup';
import { saveNotepadAction } from '../../lib/money/note-actions';
import { fromPlain } from '../../lib/notes/plain';
import { nowMs } from '../../lib/money/dates';

// The floating note, after macOS Notes: text styles, lists and checklists,
// tables, photos, videos, recordings, files and drawings. Saved to the
// account as it is typed.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function stamp(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()} at ${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`;
}

type Block = 'h1' | 'h2' | 'h3' | 'body' | 'pre' | 'bullet' | 'dash' | 'number' | 'quote' | 'check';
const STYLES: Array<[Block, string, string]> = [
  ['h1', 'Title', styles.sTitle!],
  ['h2', 'Heading', styles.sHeading!],
  ['h3', 'Subheading', styles.sSub!],
  ['body', 'Body', styles.sBody!],
  ['pre', 'Monostyled', styles.sMono!],
];
const LISTS: Array<[Block, string]> = [
  ['bullet', '•  Bulleted List'],
  ['dash', '–  Dashed List'],
  ['number', '1.  Numbered List'],
];
const INKS = ['', '#af52de', '#ff2d55', '#ff9500', '#34c759', '#007aff', '#a2845e'];
type Menu = null | 'format' | 'ink' | 'attach' | 'more' | 'table';

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Dots({ vertical }: { vertical?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" style={vertical ? { transform: 'rotate(90deg)' } : undefined}>
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}

// Images are made smaller before upload, so notes stay quick.
async function shrink(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 1_500_000) return file;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85));
}

async function upload(blob: Blob, name: string, kind?: string): Promise<{ url: string; kind: string; name: string } | { error: string }> {
  const form = new FormData();
  form.append('file', blob, name);
  if (kind) form.append('kind', kind);
  const res = await fetch('/api/note-files', { method: 'POST', body: form });
  return res.json();
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default function Notepad({ initial, savedAt, onClose }: { initial: string; savedAt: string | null; onClose: () => void }) {
  const [at, setAt] = useState(savedAt);
  const [min, setMin] = useState(false);
  const [big, setBig] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [block, setBlock] = useState<Block>('body');
  const [marks, setMarks] = useState({ b: false, i: false, u: false, s: false });
  const [title, setTitle] = useState('New Note');
  const [empty, setEmpty] = useState(true);
  const [markup, setMarkup] = useState(false);
  const [busy, setBusy] = useState('');
  const [recording, setRecording] = useState<{ since: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [table, setTable] = useState<{ top: number; left: number; width: number; rowTop: number; rowHeight: number } | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const range = useRef<Range | null>(null);
  const timer = useRef<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const start = useCallback(() => ({ x: Math.max(16, document.documentElement.clientWidth - 760), y: 110 }), []);

  const save = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setAt(await saveNotepadAction(editor.current?.innerHTML ?? ''));
    }, 700);
  }, []);

  // Title from the first line, like Notes.
  const refresh = useCallback(() => {
    const el = editor.current;
    if (!el) return;
    const text = el.innerText.trim();
    setEmpty(!text && !el.querySelector('img, video, audio, table, figure'));
    setTitle(text.split('\n')[0]?.trim().slice(0, 40) || 'New Note');
  }, []);

  useEffect(() => {
    if (editor.current) {
      editor.current.innerHTML = fromPlain(initial);
      refresh();
    }
    // Each line its own block, so styles and lists apply to that line.
    document.execCommand('defaultParagraphSeparator', false, 'div');
    return () => void (timer.current && window.clearTimeout(timer.current));
  }, [initial, refresh]);

  const changed = () => {
    refresh();
    save();
  };

  // Where the cursor is: the text style, marks, and the table it is in.
  const where = useCallback(() => {
    const el = editor.current;
    const sel = window.getSelection();
    if (!el || !sel?.rangeCount || !el.contains(sel.anchorNode)) return;
    range.current = sel.getRangeAt(0).cloneRange();
    let n: Node | null = sel.anchorNode;
    let found: Block = 'body';
    let cell: HTMLElement | null = null;
    while (n && n !== el) {
      if (n instanceof HTMLElement) {
        const tag = n.tagName;
        if (tag === 'TD' && !cell) cell = n;
        if (found === 'body') {
          if (tag === 'H1') found = 'h1';
          else if (tag === 'H2') found = 'h2';
          else if (tag === 'H3') found = 'h3';
          else if (tag === 'PRE') found = 'pre';
          else if (tag === 'BLOCKQUOTE') found = 'quote';
          else if (tag === 'OL') found = 'number';
          else if (tag === 'UL') found = n.classList.contains('checklist') ? 'check' : n.classList.contains('dashed') ? 'dash' : 'bullet';
        }
      }
      n = n.parentNode;
    }
    setBlock(found);
    setMarks({ b: document.queryCommandState('bold'), i: document.queryCommandState('italic'), u: document.queryCommandState('underline'), s: document.queryCommandState('strikeThrough') });
    if (cell && body.current) {
      const t = cell.closest('table')!.getBoundingClientRect();
      const row = cell.closest('tr')!.getBoundingClientRect();
      const b = body.current.getBoundingClientRect();
      setTable({ top: t.top - b.top + body.current.scrollTop, left: t.left - b.left, width: t.width, rowTop: row.top - b.top + body.current.scrollTop, rowHeight: row.height });
    } else setTable(null);
  }, []);

  // The recording timer.
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setSeconds(Math.floor((nowMs() - recording.since) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    document.addEventListener('selectionchange', where);
    return () => document.removeEventListener('selectionchange', where);
  }, [where]);

  // Put the cursor back where it was before a toolbar click.
  const restore = () => {
    const el = editor.current;
    if (!el) return;
    const sel = window.getSelection();
    // Still in the note (toolbar clicks keep focus): leave the cursor be.
    if (sel?.rangeCount && el.contains(sel.anchorNode)) return;
    el.focus();
    if (range.current && sel) {
      sel.removeAllRanges();
      sel.addRange(range.current);
    }
  };

  const exec = (cmd: string, value?: string) => {
    restore();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, value);
    changed();
    where();
  };

  // Runs a change to the line's style and keeps the cursor where it was:
  // a marker sits at the cursor while the browser rebuilds the line.
  const keepCaret = (fn: () => void) => {
    const sel = window.getSelection();
    if (!sel?.rangeCount || !sel.isCollapsed) return fn();
    const mark = document.createElement('span');
    mark.setAttribute('data-caret', '');
    sel.getRangeAt(0).insertNode(mark);
    fn();
    const found = editor.current?.querySelector('span[data-caret]');
    if (found) {
      const r = document.createRange();
      r.setStartBefore(found);
      r.collapse(true);
      const parent = found.parentNode;
      found.remove();
      parent?.normalize();
      const s2 = window.getSelection();
      s2?.removeAllRanges();
      s2?.addRange(r);
    }
  };

  const currentList = (): HTMLElement | null => {
    const sel = window.getSelection();
    let n: Node | null = sel?.anchorNode ?? null;
    while (n && n !== editor.current) {
      if (n instanceof HTMLElement && (n.tagName === 'UL' || n.tagName === 'OL')) return n;
      n = n.parentNode;
    }
    return null;
  };

  // One kind of list at a time: bullets, dashes, numbers or a checklist.
  const setList = (kind: 'bullet' | 'dash' | 'number' | 'check') => {
    restore();
    keepCaret(() => applyList(kind));
    changed();
    where();
  };

  const applyList = (kind: 'bullet' | 'dash' | 'number' | 'check') => {
    const list = currentList();
    const same = list && ((kind === 'number' && list.tagName === 'OL') || (kind !== 'number' && list.tagName === 'UL' && (kind === 'check' ? list.classList.contains('checklist') : kind === 'dash' ? list.classList.contains('dashed') : !list.classList.length)));
    if (same) document.execCommand(kind === 'number' ? 'insertOrderedList' : 'insertUnorderedList');
    else {
      if (list && (list.tagName === 'OL') !== (kind === 'number')) document.execCommand(list.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
      if (!currentList()) document.execCommand(kind === 'number' ? 'insertOrderedList' : 'insertUnorderedList');
      const now = currentList();
      if (now) {
        now.className = kind === 'check' ? 'checklist' : kind === 'dash' ? 'dashed' : '';
        if (!now.className) now.removeAttribute('class');
        now.querySelectorAll('li').forEach((li) => (kind === 'check' ? !li.hasAttribute('data-checked') && li.setAttribute('data-checked', 'false') : li.removeAttribute('data-checked')));
      }
    }
  };

  const setBlockStyle = (b: Block) => {
    setMenu(null);
    if (b === 'bullet' || b === 'dash' || b === 'number' || b === 'check') return setList(b);
    restore();
    const tag = b === 'body' ? 'div' : b === 'quote' ? 'blockquote' : b;
    keepCaret(() => {
      if (currentList()) document.execCommand(currentList()!.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
      document.execCommand('formatBlock', false, tag === block ? 'div' : tag);
    });
    changed();
    where();
  };

  // Ticking a checklist item: a click on its circle.
  const onEditorDown = (e: React.MouseEvent) => {
    const li = (e.target as HTMLElement).closest('ul.checklist > li') as HTMLElement | null;
    if (!li) return;
    const r = li.getBoundingClientRect();
    if (e.clientX - r.left > 26) return;
    e.preventDefault();
    li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
    changed();
  };

  const onKey = (e: React.KeyboardEvent) => {
    // New checklist items start unticked.
    if (e.key === 'Enter') requestAnimationFrame(() => {
      editor.current?.querySelectorAll('ul.checklist > li:not([data-checked])').forEach((li) => li.setAttribute('data-checked', 'false'));
      const sel = window.getSelection();
      const li = sel?.anchorNode instanceof HTMLElement ? sel.anchorNode.closest('ul.checklist > li') : sel?.anchorNode?.parentElement?.closest('ul.checklist > li');
      if (li && li.getAttribute('data-checked') === 'true' && !li.textContent) li.setAttribute('data-checked', 'false');
    });
    if (e.key === 'Tab' && table) {
      // Tab moves between table cells.
      const sel = window.getSelection();
      const cell = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('td');
      if (cell) {
        e.preventDefault();
        const cells = [...cell.closest('table')!.querySelectorAll('td')];
        const next = cells[cells.indexOf(cell) + (e.shiftKey ? -1 : 1)];
        if (next) {
          const r = document.createRange();
          r.selectNodeContents(next);
          r.collapse(false);
          sel!.removeAllRanges();
          sel!.addRange(r);
        }
      }
    }
  };

  const insertTable = () => {
    setMenu(null);
    exec('insertHTML', '<table><tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table><div><br></div>');
  };

  const tableCell = (): HTMLTableCellElement | null => {
    const n = range.current?.startContainer ?? null;
    const el = n instanceof HTMLElement ? n : n?.parentElement;
    return (el?.closest('td') as HTMLTableCellElement | null) ?? null;
  };

  const editTable = (what: 'row' | 'col' | 'delRow' | 'delCol' | 'delete') => {
    setMenu(null);
    const cell = tableCell();
    if (!cell) return;
    const tbl = cell.closest('table')!;
    const row = cell.closest('tr')!;
    const col = cell.cellIndex;
    if (what === 'row') {
      const tr = document.createElement('tr');
      for (let i = 0; i < row.cells.length; i++) tr.appendChild(Object.assign(document.createElement('td'), { innerHTML: '<br>' }));
      row.after(tr);
    } else if (what === 'col') [...tbl.rows].forEach((r) => r.cells[col]!.after(Object.assign(document.createElement('td'), { innerHTML: '<br>' })));
    else if (what === 'delRow') {
      if (tbl.rows.length > 1) row.remove();
      else tbl.remove();
    } else if (what === 'delCol') {
      if (row.cells.length > 1) [...tbl.rows].forEach((r) => r.cells[col]?.remove());
      else tbl.remove();
    } else tbl.remove();
    changed();
    setTable(null);
  };

  const insertFile = async (file: Blob, name: string, kind?: string) => {
    setBusy(kind === 'sketch' ? 'Adding drawing…' : `Adding ${name}…`);
    try {
      const res = await upload(file, name, kind);
      if ('error' in res) return setBusy(res.error);
      const html =
        res.kind === 'image' || res.kind === 'sketch'
          ? `<div><img src="${res.url}" alt="${esc(res.name)}" data-kind="${res.kind}"></div><div><br></div>`
          : res.kind === 'video'
            ? `<div><video src="${res.url}" controls></video></div><div><br></div>`
            : res.kind === 'audio'
              ? `<div><audio src="${res.url}" controls></audio></div><div><br></div>`
              : `<figure class="file"><a href="${res.url}" download="${esc(res.name)}" data-file="1">${esc(res.name)}</a></figure><div><br></div>`;
      if (!range.current && editor.current) {
        const r = document.createRange();
        r.selectNodeContents(editor.current);
        r.collapse(false);
        range.current = r;
      }
      exec('insertHTML', html);
      setBusy('');
    } catch {
      setBusy('That could not be added. Try again.');
    }
  };

  const pick = async (files: FileList | null) => {
    for (const f of [...(files ?? [])]) await insertFile(f.type.startsWith('image/') ? await shrink(f) : f, f.name);
  };

  const record = async () => {
    setMenu(null);
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(null);
        void insertFile(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), `Recording ${stamp(new Date().toISOString())}.webm`, 'audio');
      };
      recorder.current = rec;
      rec.start();
      setRecording({ since: nowMs() });
      setSeconds(0);
    } catch {
      setBusy('The microphone is blocked. Allow it in the browser to record.');
    }
  };

  const finishMarkup = (png: Blob | null) => {
    setMarkup(false);
    if (png) void insertFile(png, 'Drawing.png', 'sketch');
  };

  const copyText = async () => {
    setMenu(null);
    await navigator.clipboard.writeText(editor.current?.innerText ?? '');
    setBusy('Copied');
    window.setTimeout(() => setBusy(''), 1500);
  };

  const download = () => {
    setMenu(null);
    const html = `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><body style="font-family:system-ui;max-width:720px;margin:40px auto;line-height:1.55">${editor.current?.innerHTML ?? ''}</body>`;
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([html], { type: 'text/html' })), download: `${title || 'Note'}.html` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const clearNote = () => {
    setMenu(null);
    if (!window.confirm('Clear this note? Its text, pictures and recordings go.')) return;
    if (editor.current) editor.current.innerHTML = '';
    changed();
  };

  // Toolbar clicks keep the text selection.
  const keep = (e: React.MouseEvent) => e.preventDefault();

  return (
    <FloatWindow id="notepad" start={start} className={`${tools.note} ${styles.notes} ${big ? tools.noteBig : ''} ${min ? tools.noteMin : ''}`} label="Note">
      <div className={styles.bar} data-drag>
        <Lights onClose={onClose} onMin={() => setMin((m) => !m)} onMax={() => setBig((b) => !b)} />
        <b className={styles.title}>{title}</b>
        {!min && (
          <span className={styles.toolRow}>
            <span className={styles.pill} onMouseDown={keep}>
              <span className={styles.anchor}>
                <button type="button" className={styles.tb} data-on={menu === 'format'} disabled={markup} onClick={() => setMenu(menu === 'format' ? null : 'format')} aria-label="Format" title="Format">
                  <span className={styles.aa}>Aa</span>
                </button>
                {menu === 'format' && (
                  <div className={`${styles.pop} ${styles.formatPop}`} onMouseDown={keep}>
                    <div className={styles.marks}>
                      <button type="button" data-on={marks.b} onClick={() => exec('bold')} aria-label="Bold">
                        <b>B</b>
                      </button>
                      <button type="button" data-on={marks.i} onClick={() => exec('italic')} aria-label="Italic">
                        <i style={{ fontFamily: 'Georgia, serif' }}>I</i>
                      </button>
                      <button type="button" data-on={marks.u} onClick={() => exec('underline')} aria-label="Underline">
                        <u>U</u>
                      </button>
                      <button type="button" data-on={marks.s} onClick={() => exec('strikeThrough')} aria-label="Strikethrough">
                        <s>S</s>
                      </button>
                      <i className={styles.vsep} />
                      <button type="button" onClick={() => exec('hiliteColor', '#fde68a')} aria-label="Highlight" title="Highlight">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M15 4l5 5-9 9H6v-5Z M4 21h16" />
                        </svg>
                      </button>
                      <span className={styles.anchor}>
                        <button type="button" onClick={() => setMenu('ink')} aria-label="Text colour" title="Text colour">
                          <i className={styles.inkDot} />
                        </button>
                      </span>
                    </div>
                    <div className={styles.popSep} />
                    {STYLES.map(([b, label, cls]) => (
                      <button key={b} type="button" className={`${styles.styleRow} ${cls}`} onClick={() => setBlockStyle(b)}>
                        <span className={styles.check}>{block === b ? <Check /> : null}</span>
                        {label}
                      </button>
                    ))}
                    {LISTS.map(([b, label]) => (
                      <button key={b} type="button" className={`${styles.styleRow} ${styles.sBody}`} onClick={() => setBlockStyle(b)}>
                        <span className={styles.check}>{block === b ? <Check /> : null}</span>
                        {label}
                      </button>
                    ))}
                    <div className={styles.popSep} />
                    <button type="button" className={`${styles.styleRow} ${styles.sBody}`} onClick={() => setBlockStyle('quote')}>
                      <span className={styles.check}>{block === 'quote' ? <Check /> : null}</span>
                      <span className={styles.quoteBar} /> Block Quote
                    </button>
                  </div>
                )}
                {menu === 'ink' && (
                  <div className={`${styles.pop} ${styles.inkPop}`} onMouseDown={keep}>
                    {INKS.map((c) => (
                      <button key={c || 'default'} type="button" className={styles.ink} style={{ background: c || 'var(--w-fg)' }} onClick={() => (exec('foreColor', c || (getComputedStyle(editor.current!).color ?? '#1d1d1f')), setMenu(null))} aria-label={c ? `Colour ${c}` : 'Default colour'} />
                    ))}
                  </div>
                )}
              </span>
              <button type="button" className={styles.tb} data-on={block === 'check'} disabled={markup} onClick={() => setList('check')} aria-label="Checklist" title="Checklist">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="5.5" cy="7" r="2.6" fill="currentColor" />
                  <path d="m4.4 7 .9.9 1.6-1.8" stroke="var(--w-note)" strokeWidth="1.2" />
                  <circle cx="5.5" cy="17" r="2.6" />
                  <path d="M11 7h10M11 17h10" />
                </svg>
              </button>
              <span className={styles.anchor}>
                <button type="button" className={styles.tb} disabled={markup} onClick={insertTable} aria-label="Table" title="Table">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <rect x="3" y="4.5" width="18" height="15" rx="2" />
                    <path d="M3 9.5h18M3 14.5h18M12 9.5v10" />
                  </svg>
                </button>
              </span>
              <span className={styles.anchor}>
                <button type="button" className={styles.tb} data-on={menu === 'attach'} disabled={markup} onClick={() => setMenu(menu === 'attach' ? null : 'attach')} aria-label="Attach" title="Attach">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m20.5 11.5-8.2 8.2a5.3 5.3 0 0 1-7.5-7.5l8.2-8.2a3.5 3.5 0 0 1 5 5l-8.2 8.2a1.8 1.8 0 0 1-2.5-2.5l7.5-7.5" />
                  </svg>
                </button>
                {menu === 'attach' && (
                  <div className={`${styles.pop} ${styles.menuPop}`} onMouseDown={keep}>
                    <button type="button" className={styles.menuRow} onClick={() => (setMenu(null), photoInput.current?.click())}>
                      Choose Photo or Video
                    </button>
                    <button type="button" className={styles.menuRow} onClick={record}>
                      {recording ? 'Stop Recording' : 'Record Audio'}
                    </button>
                    <button type="button" className={styles.menuRow} onClick={() => (setMenu(null), fileInput.current?.click())}>
                      Attach File
                    </button>
                    {[
                      ['Take Photo', 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3ZM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
                      ['Scan Documents', 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M9 9h6v6H9Z'],
                      ['Add Sketch', 'M4 19c4-1 5-6 8-6s3 4 6 3M14 6l4 4-7 7H7v-4Z'],
                    ].map(([label, d]) => (
                      <button key={label} type="button" className={styles.menuRow} disabled title="Available on iPhone and iPad">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d={d} />
                        </svg>
                        {label}
                      </button>
                    ))}
                    <div className={styles.popSep} />
                  </div>
                )}
              </span>
              <button type="button" className={`${styles.tb} ${markup ? styles.tbMarkupOn : ''}`} onClick={() => (setMenu(null), setMarkup((m) => !m))} aria-label="Markup" title="Markup">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9.5" />
                  <path d="M12 6.5 9.5 13v4h5v-4Z M12 6.5V10" />
                </svg>
              </button>
            </span>
            <span className={styles.anchor}>
              <button type="button" className={styles.more} data-on={menu === 'more'} onClick={() => setMenu(menu === 'more' ? null : 'more')} aria-label="More" title="More">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 6 6 6-6 6M13 6l6 6-6 6" />
                </svg>
              </button>
              {menu === 'more' && (
                <div className={`${styles.pop} ${styles.menuPop} ${styles.morePop}`}>
                  <button type="button" className={styles.menuRow} onClick={copyText}>
                    Copy Text
                  </button>
                  <button type="button" className={styles.menuRow} onClick={download}>
                    Download Note
                  </button>
                  <button type="button" className={styles.menuRow} onClick={() => (setMenu(null), window.print())}>
                    Print…
                  </button>
                  <div className={styles.popSep} />
                  <button type="button" className={`${styles.menuRow} ${styles.danger}`} onClick={clearNote}>
                    Clear Note
                  </button>
                </div>
              )}
            </span>
          </span>
        )}
      </div>
      {!min && (
        <div className={styles.body} ref={body} onMouseDown={() => menu && setMenu(null)}>
          <p className={styles.date}>{stamp(at)}</p>
          {(busy || recording) && (
            <p className={styles.status}>
              {recording ? (
                <>
                  <i className={styles.recDot} /> Recording {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                  <button type="button" onClick={record}>
                    Stop
                  </button>
                </>
              ) : (
                busy
              )}
            </p>
          )}
          {table && !markup && (
            <>
              <span className={styles.anchor} style={{ position: 'absolute', top: table.top - 22, left: table.left + table.width / 2 - 16 }}>
                <button type="button" className={styles.handle} onMouseDown={keep} onClick={() => setMenu(menu === 'table' ? null : 'table')} aria-label="Table options">
                  <Dots />
                </button>
                {menu === 'table' && (
                  <div className={`${styles.pop} ${styles.menuPop}`} style={{ top: 24, left: -60 }} onMouseDown={keep}>
                    <button type="button" className={styles.menuRow} onClick={() => editTable('row')}>
                      Add Row Below
                    </button>
                    <button type="button" className={styles.menuRow} onClick={() => editTable('col')}>
                      Add Column After
                    </button>
                    <div className={styles.popSep} />
                    <button type="button" className={styles.menuRow} onClick={() => editTable('delRow')}>
                      Delete Row
                    </button>
                    <button type="button" className={styles.menuRow} onClick={() => editTable('delCol')}>
                      Delete Column
                    </button>
                    <button type="button" className={`${styles.menuRow} ${styles.danger}`} onClick={() => editTable('delete')}>
                      Delete Table
                    </button>
                  </div>
                )}
              </span>
              <button type="button" className={`${styles.handle} ${styles.handleRow}`} style={{ top: table.rowTop + table.rowHeight / 2 - 12, left: table.left - 24 }} onMouseDown={keep} onClick={() => editTable('row')} aria-label="Add row" title="Add a row below">
                <Dots vertical />
              </button>
            </>
          )}
          <div
            ref={editor}
            className={styles.editor}
            data-empty={empty || undefined}
            contentEditable={!markup}
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Note"
            spellCheck
            onInput={changed}
            onMouseDown={onEditorDown}
            onKeyDown={onKey}
            onKeyUp={where}
            onPaste={(e) => {
              // Pictures pasted in become attachments; other text stays plain.
              const files = [...e.clipboardData.files];
              if (files.length) {
                e.preventDefault();
                void pick(e.clipboardData.files);
                return;
              }
              e.preventDefault();
              document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
            }}
          />
          {markup && <Markup onDone={finishMarkup} />}
        </div>
      )}
      <input ref={photoInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => (void pick(e.target.files), (e.target.value = ''))} />
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => (void pick(e.target.files), (e.target.value = ''))} />
    </FloatWindow>
  );
}
