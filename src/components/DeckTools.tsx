// A5. Bộ từ tự tạo: dán danh sách (nghĩa tự điền), nhập/xuất JSON/CSV.
//   Dòng dán: "word", "word | nghĩa", "word - nghĩa", "word<TAB>nghĩa", hoặc CSV "word,pos,nghĩa,ví dụ".
import { useRef, useState } from 'react';
import { Download, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { setKv, useDb } from '../db';
import { type DeckWord, loadDecks, type UserDeck, userDecks } from '../lib/vocab';
import { freeTranslate } from '../lib/freeTranslate';

function csvRow(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}
const csvCell = (s = '') => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Một dòng → từ (nghĩa có thể trống). */
export function parseLine(line: string): DeckWord | null {
  const l = line.trim();
  if (!l || l.startsWith('#')) return null;
  if (l.includes('\t')) { const [word, vi = '', ex] = l.split('\t').map((x) => x.trim()); return word ? { word, pos: '', vi, ex: ex || undefined } : null; }
  if (/\s\|\s|\|/.test(l)) { const [word, vi = ''] = l.split('|').map((x) => x.trim()); return word ? { word, pos: '', vi } : null; }
  if (/\s[-–:]\s/.test(l)) { const m = l.match(/^(.+?)\s[-–:]\s(.*)$/)!; return { word: m[1].trim(), pos: '', vi: m[2].trim() }; }
  if (l.includes(',')) { const [word, pos = '', vi = '', ex = ''] = csvRow(l); return word ? { word, pos, vi, ex: ex || undefined } : null; }
  return { word: l, pos: '', vi: '' };
}

export function toCsv(words: DeckWord[]) {
  return ['word,pos,meaning,example,ipa', ...words.map((w) => [w.word, w.pos, w.vi, w.ex, w.ipa].map(csvCell).join(','))].join('\n');
}
function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Điền nghĩa còn thiếu: tra bộ có sẵn trước, rồi dịch máy (miễn phí). */
async function fillMeanings(words: DeckWord[], onProgress: (n: number) => void): Promise<DeckWord[]> {
  const known = new Map((await loadDecks()).flatMap((d) => d.words.map((w) => [w.word.toLowerCase(), w] as const)));
  const out: DeckWord[] = [];
  let i = 0;
  for (const w of words) {
    const k = known.get(w.word.toLowerCase());
    let next = k ? { ...k, ...Object.fromEntries(Object.entries(w).filter(([, v]) => v)) } as DeckWord : w;
    if (!next.vi) { try { next = { ...next, vi: (await freeTranslate(w.word)).trim() }; } catch { /* để trống, người học sửa sau */ } }
    out.push(next); onProgress(++i);
  }
  return out;
}

export default function DeckTools() {
  const db = useDb();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const decks = userDecks(db.kv);

  const create = async (deckName: string, raw: DeckWord[]) => {
    const seen = new Set<string>();
    const words = raw.filter((w) => { const k = w.word.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 500);
    if (!words.length) { setMsg('Không đọc được từ nào.'); return; }
    setBusy(`0/${words.length}`);
    const full = await fillMeanings(words, (n) => setBusy(`${n}/${words.length}`));
    const id = `${Date.now().toString(36)}`;
    await setKv(`udeck:${id}`, { id, name: deckName || `Bộ ${decks.length + 1}`, words: full, at: Date.now() } satisfies UserDeck);
    setBusy(null); setMsg(`Đã tạo bộ "${deckName || `Bộ ${decks.length + 1}`}" (${full.length} từ${full.some((w) => !w.vi) ? '; vài từ chưa có nghĩa' : ''}).`);
    setText(''); setName(''); setOpen(false);
  };

  const onFile = async (f: File) => {
    const t = await f.text();
    const base = f.name.replace(/\.(json|csv|txt)$/i, '');
    try {
      if (/\.json$/i.test(f.name) || t.trim().startsWith('[') || t.trim().startsWith('{')) {
        const j = JSON.parse(t);
        const list: { name?: string; words: (DeckWord | string | string[])[] }[] = Array.isArray(j) ? (j.length && (typeof j[0] === 'string' || Array.isArray(j[0]) || 'word' in j[0]) ? [{ name: base, words: j }] : j) : j.decks ?? [j];
        for (const d of list) await create(d.name ?? base, d.words.map((w) => (typeof w === 'string' ? { word: w, pos: '', vi: '' } : Array.isArray(w) ? { word: w[0], pos: w[1] ?? '', vi: w[2] ?? '', ex: w[3] } : { ...w, pos: w.pos ?? '', vi: w.vi ?? (w as { meaning?: string }).meaning ?? '' })).filter((w) => w.word));
      } else {
        const lines = t.split(/\r?\n/);
        if (/^word\s*,/i.test(lines[0])) lines.shift();
        await create(base, lines.map(parseLine).filter(Boolean) as DeckWord[]);
      }
    } catch (e) { setMsg(`Không đọc được file: ${(e as Error).message}`); setBusy(null); }
  };

  const exportAll = () => download('ielts-decks.json', JSON.stringify({ decks: decks.map((d) => ({ name: d.name, words: d.words })) }, null, 1), 'application/json');
  const exportNotebook = () => {
    const words: DeckWord[] = Object.values(db.vocab).filter((c) => c.kind !== 'sentence').map((c) => ({ word: c.word, pos: c.pos ?? '', vi: c.meaning, ex: c.example, ipa: c.ipa }));
    download('so-tu.csv', '\ufeff' + toCsv(words), 'text/csv');
  };

  return (
    <div className="stack deck-tools">
      <div className="row wrap">
        <button className="btn btn--primary btn--sm" onClick={() => setOpen(!open)} data-testid="deck-new"><Plus size={15} /> Tạo bộ</button>
        <button className="btn btn--ghost btn--sm" onClick={() => file.current?.click()}><Upload size={15} /> Nhập JSON/CSV</button>
        {decks.length > 0 && <button className="btn btn--ghost btn--sm" onClick={exportAll}><Download size={15} /> Xuất bộ (JSON)</button>}
        <button className="btn btn--ghost btn--sm" onClick={exportNotebook}><Download size={15} /> Xuất sổ từ (CSV)</button>
        <input ref={file} type="file" accept=".json,.csv,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      </div>
      {open && (
        <form className="card pad stack" onSubmit={(e) => { e.preventDefault(); create(name.trim(), text.split(/\r?\n/).map(parseLine).filter(Boolean) as DeckWord[]); }}>
          <input className="input" placeholder="Tên bộ (vd: Từ Cambridge 18)" value={name} onChange={(e) => setName(e.target.value)} data-testid="deck-name" />
          <textarea className="textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} data-testid="deck-text"
            placeholder={'Mỗi dòng một từ. Có thể kèm nghĩa:\nmitigate\nscarcity | sự khan hiếm\ninfrastructure - cơ sở hạ tầng\nTừ thiếu nghĩa sẽ được tự điền.'} />
          <div className="row wrap"><button className="btn btn--primary" type="submit" disabled={!!busy || !text.trim()}>{busy ? <><Loader2 size={15} className="spin" /> Đang điền nghĩa {busy}</> : 'Tạo bộ'}</button><button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>Huỷ</button></div>
        </form>
      )}
      {busy && !open && <p className="small muted"><Loader2 size={13} className="spin" /> Đang điền nghĩa {busy}…</p>}
      {msg && <p className="small" data-testid="deck-msg">{msg}</p>}
      {decks.length > 0 && (
        <details className="small"><summary>Xoá bộ tự tạo</summary>
          <ul className="deck-del">{decks.map((d) => <li key={d.id}>{d.name} ({d.words.length}) <button className="icon-btn icon-btn--sm" aria-label={`Xoá bộ ${d.name}`} onClick={() => confirm(`Xoá bộ "${d.name}"? Thẻ đã học vẫn giữ trong sổ từ.`) && setKv(`udeck:${d.id.slice(3)}`, undefined)}><Trash2 size={14} /></button></li>)}</ul>
        </details>
      )}
    </div>
  );
}
