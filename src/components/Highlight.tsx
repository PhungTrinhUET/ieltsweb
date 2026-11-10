// Highlight nhiều màu: bôi đen một đoạn chữ trong bài → hiện thanh màu ngay cạnh vùng chọn.
// Lưu trong Note.highlights dạng "<màu>::<chữ>" (bản cũ không có tiền tố = vàng).
import { useEffect, useState } from 'react';
import { Eraser } from 'lucide-react';
import { saveNote, useDb } from '../db';
import { cleanWord } from '../lib/text';
import type { WordSel } from './WordPopover';

export const HL_COLORS = [
  { id: 'yellow', label: 'Vàng' },
  { id: 'green', label: 'Xanh lá' },
  { id: 'blue', label: 'Xanh dương' },
  { id: 'pink', label: 'Hồng' },
  { id: 'orange', label: 'Cam' },
] as const;
export type HlColor = (typeof HL_COLORS)[number]['id'];
/** Một chỗ tô. `p` (đoạn) + `s` (vị trí ký tự đầu trong đoạn) → chỉ tô đúng chỗ đã bôi, không tô các chỗ khác cùng chữ. */
export interface Hl { color: HlColor; text: string; p?: string; s?: number }
export type HlSel = Omit<Hl, 'color'>;

export function parseHl(s: string): Hl {
  const m = s.match(/^(yellow|green|blue|pink|orange)(?:@([^@:]*)@(\d+))?::([\s\S]*)$/);
  return m ? { color: m[1] as HlColor, text: m[4], ...(m[2] != null && m[3] != null ? { p: m[2], s: +m[3] } : {}) } : { color: 'yellow', text: s };
}
const fmtHl = (h: Hl) => `${h.color}${h.p != null && h.s != null ? `@${h.p}@${h.s}` : ''}::${h.text}`;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const overlaps = (h: HlSel, x: HlSel) => (h.p != null && x.p != null
  ? h.p === x.p && h.s! < x.s! + x.text.length && x.s! < h.s! + h.text.length
  : norm(h.text).includes(norm(x.text)) || norm(x.text).includes(norm(h.text)));
/** Bỏ mọi chỗ tô giao với vùng chọn. */
export const removeHls = (list: Hl[], sel: HlSel[]) => list.filter((h) => !sel.some((x) => overlaps(h, x)));
/** Tô vùng chọn (thay chỗ tô cũ giao với nó). */
export const addHls = (list: Hl[], sel: HlSel[], color: HlColor) => {
  const ok = sel.filter((x) => norm(x.text).length >= 2);
  return ok.length ? [...removeHls(list, ok), ...ok.map((x) => ({ ...x, color }))] : list;
};

/** Đọc / ghi highlight của một bài (giữ nguyên phần ghi chú). */
export function useHighlights(materialId: string | undefined) {
  const db = useDb();
  const note = materialId ? db.notes[materialId] : undefined;
  const list = (note?.highlights ?? []).map(parseHl);
  const write = (hs: Hl[]) => {
    if (!materialId) return;
    const cur = db.notes[materialId];
    saveNote({ materialId, text: cur?.text ?? '', highlights: hs.map(fmtHl), updatedAt: Date.now() });
  };
  return {
    list,
    add: (sel: HlSel[], color: HlColor) => write(addHls(list, sel, color)),
    /** Xoá mọi highlight giao với đoạn chữ đã chọn. */
    remove: (sel: HlSel[]) => write(removeHls(list, sel)),
    clear: () => write([]),
  };
}

/**
 * Màu cho từng ký tự của `text` (đoạn `para`) theo danh sách highlight.
 * Chỗ tô có vị trí: chỉ tô đúng vị trí đó. Bản cũ (chỉ có chữ): tô lần xuất hiện đầu tiên.
 */
export function colorMap(text: string, hls: Hl[], para?: string): (HlColor | undefined)[] {
  const map: (HlColor | undefined)[] = new Array(text.length);
  const done = new Set<string>();
  for (const h of hls) {
    if (h.p != null && h.p !== para) continue;
    const words = h.text.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!words.length) continue;
    if (h.p == null) { const k = norm(h.text); if (done.has(k)) continue; done.add(k); }
    const src = words.join('\\s+');
    let m: RegExpExecArray | null = null;
    if (h.s != null) { const re = new RegExp(src, 'y'); re.lastIndex = h.s; m = re.exec(text); }
    if (!m) { // vị trí lệch (bài được sửa) → lần xuất hiện gần vị trí cũ nhất
      const re = new RegExp(src, 'g'); let best: RegExpExecArray | null = null; let x: RegExpExecArray | null;
      while ((x = re.exec(text))) { if (!best || Math.abs(x.index - (h.s ?? 0)) < Math.abs(best.index - (h.s ?? 0))) best = x; if (h.s == null || !x[0].length) break; }
      m = best;
    }
    if (m) for (let i = m.index; i < m.index + m[0].length; i++) map[i] = h.color;
  }
  return map;
}

/**
 * Văn bản có tô màu; nếu có `onWord` thì mỗi từ bấm được để tra nghĩa.
 * `map`/`offset`: bảng màu tính trên cả đoạn (để highlight vắt qua nhiều câu vẫn đúng).
 * `para`: mã đoạn – để vùng bôi chọn biết mình ở đoạn nào, vị trí nào.
 */
export function HlText({ text, map, offset = 0, onWord, sentence, para }: { text: string; map?: (HlColor | undefined)[]; offset?: number; onWord?: (s: WordSel) => void; sentence?: string; para?: string }) {
  const toks = text.split(/(\s+)/);
  let pos = offset;
  const out = toks.map((tok, i) => {
    const start = pos;
    pos += tok.length;
    if (!tok) return null;
    let color: HlColor | undefined;
    if (map) {
      if (/\S/.test(tok)) { for (let k = start; k < start + tok.length; k++) if (map[k]) { color = map[k]; break; } }
      else color = map[start - 1] && map[start - 1] === map[start + tok.length] ? map[start - 1] : undefined;
    }
    const cls = [onWord && /\S/.test(tok) && cleanWord(tok) ? 'w' : '', color ? `hl hl--${color}` : ''].filter(Boolean).join(' ');
    if (!cls) return tok;
    return <span key={i} className={cls} data-w={onWord && /\S/.test(tok) ? cleanWord(tok) || undefined : undefined}>{tok}</span>;
  });
  return (
    <span data-hlp={para} data-hlo={para != null ? offset : undefined} onClick={onWord ? (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.w === undefined) return;
      if (window.getSelection()?.toString().trim()) return; // đang bôi chọn để highlight
      const r = t.getBoundingClientRect();
      onWord({ word: t.dataset.w, sentence: sentence ?? text, x: r.left + window.scrollX, y: r.bottom + window.scrollY });
    } : undefined}>{out}</span>
  );
}

/** Vùng chọn → các mảnh {đoạn, vị trí, chữ}; không có mốc đoạn thì chỉ có chữ (kiểu cũ). */
function selPieces(range: Range, scope: Element, text: string): HlSel[] {
  const lenTo = (el: Element, node: Node, off: number) => { const r = document.createRange(); r.selectNodeContents(el); r.setEnd(node, off); return r.toString().length; };
  const parts: { p: string; s: number; e: number; text: string }[] = [];
  for (const el of scope.querySelectorAll<HTMLElement>('[data-hlp]')) {
    if (!range.intersectsNode(el)) continue;
    const all = el.textContent ?? '';
    let a = el.contains(range.startContainer) ? lenTo(el, range.startContainer, range.startOffset) : 0;
    let b = el.contains(range.endContainer) ? lenTo(el, range.endContainer, range.endOffset) : all.length;
    while (a < b && /\s/.test(all[a])) a++;
    while (b > a && /\s/.test(all[b - 1])) b--;
    if (b <= a) continue;
    const o = +(el.dataset.hlo ?? 0);
    const p = el.dataset.hlp!;
    const last = parts.at(-1);
    // Các câu liền nhau trong cùng đoạn → gộp một mảnh.
    if (last && last.p === p && o + a - last.e <= 1) { last.text += ' '.repeat(o + a - last.e) + all.slice(a, b); last.e = o + b; }
    else parts.push({ p, s: o + a, e: o + b, text: all.slice(a, b) });
  }
  if (parts.length) return parts.map(({ p, s, text: t }) => ({ p, s, text: t }));
  return text.split(/\n+/).map(norm).filter((x) => x.length >= 2).map((t) => ({ text: t }));
}

/** Thanh màu nổi lên khi bôi chọn chữ bên trong phần tử có class `scopeClass`. */
export function HighlightBar({ scopeClass, onAdd, onRemove }: { scopeClass: string; onAdd: (sel: HlSel[], c: HlColor) => void; onRemove: (sel: HlSel[]) => void }) {
  const [st, setSt] = useState<{ sel: HlSel[]; x: number; y: number } | null>(null);
  useEffect(() => {
    let t = 0;
    const check = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const s = window.getSelection();
        const text = s?.toString() ?? '';
        if (!s || s.isCollapsed || norm(text).length < 2) return setSt(null);
        const scope = s.anchorNode?.parentElement?.closest(`.${scopeClass}`);
        if (!scope) return setSt(null);
        const range = s.getRangeAt(0);
        const r = range.getBoundingClientRect();
        setSt({ sel: selPieces(range, scope, text), x: Math.max(8, Math.min(r.left + r.width / 2 - 120, window.innerWidth - 248)), y: r.bottom + 10 > window.innerHeight - 60 ? Math.max(8, r.top - 54) : r.bottom + 10 });
      }, 120);
    };
    document.addEventListener('selectionchange', check);
    return () => { document.removeEventListener('selectionchange', check); window.clearTimeout(t); };
  }, [scopeClass]);
  if (!st) return null;
  const done = () => { window.getSelection()?.removeAllRanges(); setSt(null); };
  return (
    <div className="hlbar" style={{ left: st.x, top: st.y }} onMouseDown={(e) => e.preventDefault()} role="toolbar" aria-label="Highlight">
      {HL_COLORS.map((c) => (
        <button key={c.id} className={`hlbar__dot hl--${c.id}`} title={`Tô ${c.label}`} aria-label={`Tô ${c.label}`} onClick={() => { onAdd(st.sel, c.id); done(); }} />
      ))}
      <button className="hlbar__clear" title="Bỏ highlight ở đoạn đã chọn" aria-label="Bỏ highlight" onClick={() => { onRemove(st.sel); done(); }}><Eraser size={15} /></button>
    </div>
  );
}
