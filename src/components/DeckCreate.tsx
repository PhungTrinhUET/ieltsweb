// Hộp "Tạo bộ từ" / "Thêm từ vào bộ": tên, emoji, mô tả, chủ đề, band + 5 cách lấy từ:
//   Gõ từ (tự điền) · Dán danh sách · Nhập file · Tạo bằng AI · Từ đoạn văn.
//   Mọi cách đều đổ vào một danh sách chờ (bỏ chọn được, sửa nghĩa được) rồi mới tạo bộ.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, Plus, Sparkles, Upload, Volume2, Wand2, X } from 'lucide-react';
import { addWords, createDeck, fillMissing, parseFile, parseList, uniqWords } from '../lib/decks';
import type { DeckMeta, DeckWord } from '../lib/vocab';
import { sayWord } from './VocabEx';
import { Clickable } from './WordPopover';
import { aiReady, getAiConfig } from '../store';

type Tab = 'type' | 'paste' | 'file' | 'ai' | 'text';
const TABS: [Tab, string][] = [['type', 'Gõ từ'], ['paste', 'Dán danh sách'], ['file', 'Nhập file'], ['ai', 'Tạo bằng AI'], ['text', 'Từ đoạn văn']];
const EMOJIS = ['📚', '📒', '🎓', '🌿', '💻', '🩺', '💼', '✈️', '🔬', '📈', '🏙️', '🎯', '⭐', '🔥', '🧠', '📝'];
const BANDS = ['5.0', '5.5', '6.0', '6.5', '7.0', '7.5', '8.0+'];
const FILL_MAX = 100;
const lc = (s: string) => s.trim().toLowerCase();

interface Staged extends DeckWord { on: boolean }

/**
 * `deckId` có → thêm từ vào bộ đó; không → tạo bộ mới.
 * `existing`: từ đã có trong bộ (đánh dấu trùng).
 */
export default function DeckCreate({ deckId, existing = [], onClose, initial }: { deckId?: string; existing?: string[]; onClose: () => void; initial?: { name?: string; words?: DeckWord[] } }) {
  const nav = useNavigate();
  const [meta, setMeta] = useState<DeckMeta & { name: string }>({ name: initial?.name ?? '', emoji: '📚', description: '', topic: '', level: '' });
  const [tab, setTab] = useState<Tab>('paste');
  const [staged, setStaged] = useState<Staged[]>(() => (initial?.words ?? []).map((w) => ({ ...w, on: true })));
  const [fill, setFill] = useState<[number, number] | null>(null);
  const [msg, setMsg] = useState('');
  const have = useMemo(() => new Set(existing.map(lc)), [existing]);
  const inStage = useMemo(() => new Set(staged.map((w) => lc(w.word))), [staged]);

  const push = (ws: DeckWord[]) => {
    const fresh = uniqWords(ws).filter((w) => !inStage.has(lc(w.word)));
    setStaged((s) => [...s, ...fresh.map((w) => ({ ...w, on: !have.has(lc(w.word)) }))]);
    setMsg(`Đã đưa ${fresh.length} từ vào danh sách${ws.length > fresh.length ? ` (bỏ ${ws.length - fresh.length} từ trùng)` : ''}.`);
  };
  const chosen = staged.filter((w) => w.on && !have.has(lc(w.word)));
  const missing = staged.filter((w) => w.on && (!w.vi || !w.pos || !w.ipa)).length;

  const autoFill = async () => {
    const idx = staged.map((w, i) => [w, i] as const).filter(([w]) => w.on && (!w.vi || !w.pos || !w.ipa)).slice(0, FILL_MAX);
    setFill([0, idx.length]);
    const out = await fillMissing(idx.map(([w]) => w), (n, t) => setFill([n, t]), FILL_MAX);
    setStaged((s) => { const next = [...s]; idx.forEach(([, i], k) => { next[i] = { ...out[k], on: next[i].on }; }); return next; });
    setFill(null);
    setMsg(`Đã tự điền ${idx.length} từ${missing > FILL_MAX ? ` (tối đa ${FILL_MAX} từ mỗi lần – bấm lại để điền tiếp)` : ''}.`);
  };

  const finish = async () => {
    const words = chosen.map(({ on: _on, ...w }) => w); // eslint-disable-line @typescript-eslint/no-unused-vars
    if (deckId) { const r = await addWords(deckId, words); onClose(); setMsg(`Đã thêm ${r.added} từ.`); return; }
    const src = tab === 'ai' ? 'ai' : tab === 'file' ? 'import' : 'custom';
    const id = await createDeck({ ...meta, source: src, description: meta.description || undefined, topic: meta.topic || undefined, level: meta.level || undefined }, words);
    onClose();
    nav(`/vocab/deck/${encodeURIComponent(id)}`);
  };

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={deckId ? 'Thêm từ vào bộ' : 'Tạo bộ từ'} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__card dk-create" data-testid="deck-create">
        <div className="row-between"><h2>{deckId ? 'Thêm từ vào bộ' : 'Tạo bộ từ'}</h2><button className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>
        {!deckId && (
          <div className="dk-meta">
            <div className="dk-meta__row">
              <select className="input dk-emoji" value={meta.emoji} onChange={(e) => setMeta({ ...meta, emoji: e.target.value })} aria-label="Biểu tượng">{EMOJIS.map((e) => <option key={e}>{e}</option>)}</select>
              <input className="input" placeholder="Tên bộ (vd: Từ Cambridge 18)" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} data-testid="dk-name" />
            </div>
            <input className="input" placeholder="Mô tả (không bắt buộc)" value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
            <div className="dk-meta__row">
              <input className="input" placeholder="Chủ đề (vd: Environment)" value={meta.topic} onChange={(e) => setMeta({ ...meta, topic: e.target.value })} />
              <select className="input" value={meta.level} onChange={(e) => setMeta({ ...meta, level: e.target.value })} aria-label="Band mục tiêu"><option value="">Band mục tiêu…</option>{BANDS.map((b) => <option key={b}>{b}</option>)}</select>
            </div>
          </div>
        )}

        <div className="tabs dk-tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`tabs__btn${tab === k ? ' is-on' : ''}`} onClick={() => { setTab(k); setMsg(''); }} data-testid={`dk-tab-${k}`}>{l}</button>)}</div>
        <div className="dk-pane">
          {tab === 'type' && <TypeWord onAdd={(w) => push([w])} />}
          {tab === 'paste' && <PasteList existing={[...have, ...inStage]} onAdd={push} />}
          {tab === 'file' && <FileIn onAdd={(ws, m) => { push(ws); if (!deckId && m) setMeta((x) => ({ ...x, name: x.name || m.name || '', emoji: m.emoji || x.emoji, description: x.description || m.description || '' })); }} />}
          {tab === 'ai' && <AiGen topic={meta.topic || meta.name} band={meta.level} onAdd={push} />}
          {tab === 'text' && <FromText onAdd={push} />}
        </div>

        {staged.length > 0 && (
          <div className="dk-stage" data-testid="dk-stage">
            <div className="row-between wrap">
              <strong className="small">Danh sách chờ: {chosen.length}/{staged.length} từ được chọn</strong>
              <div className="row">
                {missing > 0 && <button className="btn btn--ghost btn--sm" onClick={autoFill} disabled={!!fill} data-testid="dk-fill"><Wand2 size={14} /> Tự điền phần còn thiếu ({Math.min(missing, FILL_MAX)})</button>}
                <button className="btn btn--text btn--sm" onClick={() => setStaged([])}>Xoá hết</button>
              </div>
            </div>
            {fill && <div className="dk-prog"><div className="bar"><div className="bar__fill" style={{ width: `${(fill[0] / Math.max(1, fill[1])) * 100}%` }} /></div><span className="small muted">Đang điền {fill[0]}/{fill[1]}…</span></div>}
            <ul className="dk-list">
              {staged.map((w, i) => {
                const dup = have.has(lc(w.word));
                return (
                  <li key={w.word + i} className={`${!w.on || dup ? 'is-off' : ''}`}>
                    <input type="checkbox" checked={w.on && !dup} disabled={dup} onChange={(e) => setStaged((s) => s.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} aria-label={`Chọn ${w.word}`} />
                    <div className="dk-list__w"><strong>{w.word}</strong> {w.pos && <em className="vocab__pos">{w.pos}</em>} {w.ipa && <span className="muted small">{w.ipa}</span>}{dup && <span className="lt-tag">đã có trong bộ</span>}</div>
                    <input className="input input--sm dk-list__vi" value={w.vi} placeholder="nghĩa…" onChange={(e) => setStaged((s) => s.map((x, j) => (j === i ? { ...x, vi: e.target.value } : x)))} aria-label={`Nghĩa của ${w.word}`} />
                    <button className="icon-btn icon-btn--sm" onClick={() => setStaged((s) => s.filter((_, j) => j !== i))} aria-label={`Bỏ ${w.word}`}><X size={14} /></button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {msg && <p className="small muted" data-testid="dk-msg">{msg}</p>}
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Huỷ</button>
          <button className="btn btn--primary" onClick={finish} disabled={!!fill || (!!deckId && !chosen.length) || (!deckId && !meta.name.trim())} data-testid="dk-finish">
            {deckId ? `Thêm ${chosen.length} từ` : `Tạo bộ${chosen.length ? ` (${chosen.length} từ)` : ' trống'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function TypeWord({ onAdd }: { onAdd: (w: DeckWord) => void }) {
  const [w, setW] = useState<DeckWord>({ word: '', pos: '', vi: '' });
  const [busy, setBusy] = useState(false);
  const lookup = async () => {
    if (!w.word.trim()) return;
    setBusy(true);
    const [f] = await fillMissing([{ ...w, word: w.word.trim() }], () => {});
    setW(f); setBusy(false);
  };
  const add = () => { if (!w.word.trim()) return; onAdd({ ...w, word: w.word.trim() }); setW({ word: '', pos: '', vi: '' }); };
  return (
    <div className="stack dk-type">
      <div className="row">
        <input className="input" placeholder="Gõ một từ / cụm từ rồi Enter" value={w.word} onChange={(e) => setW({ ...w, word: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (w.vi) add(); else lookup(); } }} onBlur={() => !w.vi && w.word.trim() && lookup()} data-testid="dk-word" />
        <button className="icon-btn" onClick={() => w.word && sayWord(w.word)} aria-label="Nghe"><Volume2 size={16} /></button>
      </div>
      {busy && <p className="small muted"><Loader2 size={13} className="spin" /> Đang tra loại từ, phiên âm, nghĩa, ví dụ…</p>}
      <div className="dk-meta__row">
        <input className="input input--sm" placeholder="loại từ" value={w.pos} onChange={(e) => setW({ ...w, pos: e.target.value })} />
        <input className="input input--sm" placeholder="IPA" value={w.ipa ?? ''} onChange={(e) => setW({ ...w, ipa: e.target.value })} />
      </div>
      <input className="input input--sm" placeholder="Nghĩa tiếng Việt" value={w.vi} onChange={(e) => setW({ ...w, vi: e.target.value })} />
      <input className="input input--sm" placeholder="Nghĩa tiếng Anh" value={w.en ?? ''} onChange={(e) => setW({ ...w, en: e.target.value })} />
      <input className="input input--sm" placeholder="Câu ví dụ" value={w.ex ?? ''} onChange={(e) => setW({ ...w, ex: e.target.value })} />
      <button className="btn btn--ghost btn--sm" onClick={add} disabled={!w.word.trim()} data-testid="dk-type-add"><Plus size={14} /> Thêm vào danh sách</button>
    </div>
  );
}

function PasteList({ existing, onAdd }: { existing: string[]; onAdd: (ws: DeckWord[]) => void }) {
  const [text, setText] = useState('');
  const rows = useMemo(() => parseList(text, existing), [text, existing]);
  const ok = rows.filter((r) => r.w && !r.err && !r.dup);
  return (
    <div className="stack">
      <textarea className="textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} data-testid="dk-paste"
        placeholder={'Mỗi dòng một từ, các kiểu được nhận:\nmitigate\nscarcity - sự khan hiếm\ninfrastructure<TAB>cơ sở hạ tầng\nsustainable; adj; bền vững; Sustainable growth is key.'} />
      {rows.length > 0 && (
        <ul className="dk-preview small" data-testid="dk-preview">
          {rows.slice(0, 200).map((r) => (
            <li key={r.line} className={r.err ? 'is-err' : r.dup ? 'is-dup' : ''}>
              <span className="muted">{r.line}.</span> <strong>{r.w?.word ?? r.raw}</strong>{r.w?.pos && <em> {r.w.pos}</em>}{r.w?.vi && <> – {r.w.vi}</>}
              {r.err && <span className="dk-flag"><AlertTriangle size={12} /> {r.err}</span>}
              {r.dup && <span className="dk-flag dk-flag--dup">{r.dup === 'list' ? 'trùng trong danh sách' : 'đã có'}</span>}
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn--ghost btn--sm" disabled={!ok.length} onClick={() => { onAdd(ok.map((r) => r.w!)); setText(''); }} data-testid="dk-paste-add"><Plus size={14} /> Đưa {ok.length} từ vào danh sách</button>
    </div>
  );
}

function FileIn({ onAdd }: { onAdd: (ws: DeckWord[], meta?: DeckMeta & { name?: string }) => void }) {
  const [err, setErr] = useState('');
  return (
    <div className="stack">
      <p className="small muted">CSV / TSV với cột <code>word,pos,meaning,example,ipa</code> (dòng tiêu đề tuỳ chọn), hoặc file bộ từ <code>.json</code> xuất từ app.</p>
      <label className="btn btn--ghost btn--sm dk-file"><Upload size={15} /> Chọn file<input type="file" accept=".csv,.tsv,.txt,.json" hidden data-testid="dk-file" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        try { const ds = parseFile(f.name, await f.text()); setErr(''); onAdd(ds.flatMap((d) => d.words), { ...ds[0]?.meta, name: ds[0]?.name }); }
        catch (x) { setErr(`Không đọc được file: ${(x as Error).message}`); }
      }} /></label>
      {err && <p className="small no-text">{err}</p>}
    </div>
  );
}

function AiGen({ topic: t0, band: b0, onAdd }: { topic: string; band?: string; onAdd: (ws: DeckWord[]) => void }) {
  const ready = aiReady(getAiConfig());
  const [topic, setTopic] = useState(t0);
  const [band, setBand] = useState(b0 || '6.5');
  const [n, setN] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!ready) return <p className="small">Cần cài AI trong <a href="#/settings">Cài đặt → AI</a> để tạo bộ bằng AI. Các cách khác không cần AI.</p>;
  const go = async () => {
    setBusy(true); setErr('');
    try { const { genDeckWords } = await import('../ai/assist'); onAdd(await genDeckWords(topic, band, n, getAiConfig())); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="stack">
      <input className="input" placeholder="Chủ đề (vd: Urbanisation, Climate change)" value={topic} onChange={(e) => setTopic(e.target.value)} />
      <div className="dk-meta__row">
        <label className="small">Band <select className="input input--sm" value={band} onChange={(e) => setBand(e.target.value)}>{BANDS.map((b) => <option key={b}>{b}</option>)}</select></label>
        <label className="small">Số từ <input type="number" className="input input--sm" min={10} max={50} value={n} onChange={(e) => setN(Math.max(10, Math.min(50, +e.target.value || 10)))} /></label>
      </div>
      {err && <p className="small no-text">{err}</p>}
      <button className="btn btn--ghost btn--sm" onClick={go} disabled={busy || !topic.trim()}>{busy ? <><Loader2 size={14} className="spin" /> AI đang soạn…</> : <><Sparkles size={14} /> Tạo {n} từ</>}</button>
      <p className="small muted">Kết quả hiện ở danh sách chờ bên dưới – bỏ chọn từ không muốn trước khi tạo bộ.</p>
    </div>
  );
}

function FromText({ onAdd }: { onAdd: (ws: DeckWord[]) => void }) {
  const ready = aiReady(getAiConfig());
  const [text, setText] = useState('');
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sents = useMemo(() => text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z"“(])/).filter((s) => s.trim()), [text]);
  const ai = async () => {
    setBusy(true); setErr('');
    try { const { pickPassageWords } = await import('../ai/assist'); onAdd(await pickPassageWords(text, getAiConfig())); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="stack">
      {!pick ? <>
        <textarea className="textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Dán một đoạn văn tiếng Anh (bài báo, bài Reading…)" data-testid="dk-text" />
        <div className="row wrap">
          {ready && <button className="btn btn--ghost btn--sm" onClick={ai} disabled={busy || text.trim().length < 80}>{busy ? <><Loader2 size={14} className="spin" /> AI đang chọn…</> : <><Sparkles size={14} /> AI gợi ý 10–20 từ</>}</button>}
          <button className="btn btn--ghost btn--sm" onClick={() => setPick(true)} disabled={!text.trim()} data-testid="dk-text-pick">Tự bấm chọn từ</button>
        </div>
        {err && <p className="small no-text">{err}</p>}
      </> : <>
        <p className="small muted">Bấm vào từ muốn học – câu chứa từ được giữ làm ví dụ. <button className="btn btn--text btn--sm" onClick={() => setPick(false)}>Sửa đoạn văn</button></p>
        <div className="dk-passage">{sents.map((s, i) => <Clickable key={i} text={s + ' '} onWord={(w) => onAdd([{ word: w.word, pos: '', vi: '', ex: w.sentence.trim() }])} />)}</div>
      </>}
    </div>
  );
}
