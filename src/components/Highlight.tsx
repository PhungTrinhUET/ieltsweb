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
export interface Hl { color: HlColor; text: string }

export function parseHl(s: string): Hl {
  const m = s.match(/^(yellow|green|blue|pink|orange)::([\s\S]*)$/);
  return m ? { color: m[1] as HlColor, text: m[2] } : { color: 'yellow', text: s };
}
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Đọc / ghi highlight của một bài (giữ nguyên phần ghi chú). */
export function useHighlights(materialId: string | undefined) {
  const db = useDb();
  const note = materialId ? db.notes[materialId] : undefined;
  const list = (note?.highlights ?? []).map(parseHl);
  const write = (hs: Hl[]) => {
    if (!materialId) return;
    const cur = db.notes[materialId];
    saveNote({ materialId, text: cur?.text ?? '', highlights: hs.map((h) => `${h.color}::${h.text}`), updatedAt: Date.now() });
  };
  return {
    list,
    add: (text: string, color: HlColor) => {
      const pieces = text.split(/\n+/).map(norm).filter((p) => p.length >= 2);
      if (!pieces.length) return;
      const rest = list.filter((h) => !pieces.some((p) => p === h.text));
      write([...rest, ...pieces.map((p) => ({ color, text: p }))]);
    },
    /** Xoá mọi highlight giao với đoạn chữ đã chọn. */
    remove: (text: string) => {
      const pieces = text.split(/\n+/).map(norm).filter(Boolean);
      write(list.filter((h) => !pieces.some((p) => h.text.includes(p) || p.includes(h.text))));
    },
    clear: () => write([]),
  };
}

/** Màu cho từng ký tự của `text` theo danh sách highlight (khớp không phân biệt khoảng trắng). */
export function colorMap(text: string, hls: Hl[]): (HlColor | undefined)[] {
  const map: (HlColor | undefined)[] = new Array(text.length);
  for (const h of hls) {
    const words = h.text.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!words.length) continue;
    const re = new RegExp(words.join('\\s+'), 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      for (let i = m.index; i < m.index + m[0].length; i++) map[i] = h.color;
      if (!m[0].length) re.lastIndex++;
    }
  }
  return map;
}

/**
 * Văn bản có tô màu; nếu có `onWord` thì mỗi từ bấm được để tra nghĩa.
 * `map`/`offset`: bảng màu tính trên cả đoạn (để highlight vắt qua nhiều câu vẫn đúng).
 */
export function HlText({ text, map, offset = 0, onWord, sentence }: { text: string; map?: (HlColor | undefined)[]; offset?: number; onWord?: (s: WordSel) => void; sentence?: string }) {
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
    <span onClick={onWord ? (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.w === undefined) return;
      if (window.getSelection()?.toString().trim()) return; // đang bôi chọn để highlight
      const r = t.getBoundingClientRect();
      onWord({ word: t.dataset.w, sentence: sentence ?? text, x: r.left + window.scrollX, y: r.bottom + window.scrollY });
    } : undefined}>{out}</span>
  );
}

/** Thanh màu nổi lên khi bôi chọn chữ bên trong phần tử có class `scopeClass`. */
export function HighlightBar({ scopeClass, onAdd, onRemove }: { scopeClass: string; onAdd: (text: string, c: HlColor) => void; onRemove: (text: string) => void }) {
  const [st, setSt] = useState<{ text: string; x: number; y: number } | null>(null);
  useEffect(() => {
    let t = 0;
    const check = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const s = window.getSelection();
        const text = s?.toString() ?? '';
        if (!s || s.isCollapsed || norm(text).length < 2) return setSt(null);
        const node = s.anchorNode?.parentElement;
        if (!node?.closest(`.${scopeClass}`)) return setSt(null);
        const r = s.getRangeAt(0).getBoundingClientRect();
        setSt({ text, x: Math.max(8, Math.min(r.left + r.width / 2 - 120, window.innerWidth - 248)), y: r.bottom + 10 > window.innerHeight - 60 ? Math.max(8, r.top - 54) : r.bottom + 10 });
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
        <button key={c.id} className={`hlbar__dot hl--${c.id}`} title={`Tô ${c.label}`} aria-label={`Tô ${c.label}`} onClick={() => { onAdd(st.text, c.id); done(); }} />
      ))}
      <button className="hlbar__clear" title="Bỏ highlight ở đoạn đã chọn" aria-label="Bỏ highlight" onClick={() => { onRemove(st.text); done(); }}><Eraser size={15} /></button>
    </div>
  );
}
