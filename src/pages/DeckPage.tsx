// Một bộ từ (#/vocab/deck/:id): học / ôn / luyện ngữ cảnh, thống kê 7 ngày, danh sách từ (sắp xếp, sửa, xoá,
//   chuyển/chép sang bộ khác), sửa thông tin, gộp, xoá bộ, xuất CSV/JSON, link chia sẻ.
//   Bộ có sẵn chỉ đọc → "Sao chép thành bộ của tôi".
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Copy, Download, Link2, Merge, Pencil, Plus, RotateCcw, Sparkles, Trash2, Volume2, X } from 'lucide-react';
import { useDb } from '../db';
import { STATE_NAMES, STATE_ORDER, cardState, type WordState } from '../lib/srs';
import { type Deck, type DeckWord, inDeck, useAllDecks } from '../lib/vocab';
import { GENERAL, SHARE_MAX_URL, SHARE_MAX_WORDS, copyBuiltin, copyWords, deckFileName, deckJson, deckProgress, deckWordsOf, deleteDeck, download, editWord, encodeShare,
  fillMeanings, mergeDecks, missingMeanings, removeWords, shareSupported, shareUrl, toCsv, updateDeck } from '../lib/decks';
import { sayWord } from '../components/VocabEx';
import DeckCreate from '../components/DeckCreate';

const EMOJIS = ['📚', '📒', '🎓', '🌿', '💻', '🩺', '💼', '✈️', '🔬', '📈', '🏙️', '🎯', '⭐', '🔥', '🧠', '📝', '📄'];
const SRC: Record<string, string> = { custom: 'Tự tạo', test: 'Theo đề', ai: 'Tạo bằng AI', import: 'Nhập file', shared: 'Được chia sẻ', builtin: 'Có sẵn' };
type Sort = 'new' | 'old' | 'abc' | 'learned';
const RANK: Record<WordState, number> = { known: 3, review: 2, learning: 1, new: 0 };
const lc = (s: string) => s.trim().toLowerCase();

export default function DeckPage() {
  const { id = '' } = useParams();
  const deckId = decodeURIComponent(id);
  const decks = useAllDecks();
  const db = useDb();
  const d = decks?.find((x) => x.id === deckId);
  if (!decks || !db.ready) return <div className="page"><p className="muted">Đang tải bộ từ…</p></div>;
  if (!d) return <div className="page"><p className="empty">Không tìm thấy bộ từ này (có thể đã bị xoá). <Link to="/vocab">Về Từ vựng</Link></p></div>;
  return <DeckView key={d.id} d={d} decks={decks} />;
}

function DeckView({ d, decks }: { d: Deck; decks: Deck[] }) {
  const db = useDb();
  const nav = useNavigate();
  const mine = d.kind === 'custom' || d.kind === 'saved';
  const own = d.kind === 'custom';
  const cards = useMemo(() => Object.values(db.vocab).filter((c) => c.kind !== 'sentence'), [db.vocab]);
  const byWord = useMemo(() => new Map(cards.map((c) => [lc(c.word), c])), [cards]);
  const words = useMemo(() => deckWordsOf(d), [d, db.vocab]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = deckProgress(d, byWord);
  const [sort, setSort] = useState<Sort>('new');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<{ old: string; w: DeckWord } | null>(null);
  const [adding, setAdding] = useState(false);
  const [info, setInfo] = useState<{ name: string; emoji: string; description: string } | null>(null);
  const [dlg, setDlg] = useState<'delete' | 'merge' | 'share' | null>(null);
  const [msg, setMsg] = useState('');
  const others = decks.filter((x) => (x.kind === 'custom' || x.kind === 'saved') && x.id !== d.id);
  const enc = encodeURIComponent(d.id);
  // Từ chưa có nghĩa (dán/gõ mà chưa tự điền) → điền tự động khi mở bộ.
  const noVi = mine ? missingMeanings(d) : 0;
  const [filling, setFilling] = useState<[number, number] | null>(null);
  const runFill = async () => { setFilling([0, noVi]); const n = await fillMeanings(d.id, (a, b) => setFilling([a, b])).catch(() => 0); setFilling(null); setMsg(n ? `Đã điền nghĩa cho ${n} từ.` : 'Chưa tra được nghĩa (kiểm tra mạng) – bấm ✎ để tự gõ nghĩa.'); };
  useEffect(() => { if (noVi) runFill(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stateOf = (w: DeckWord): WordState => { const c = byWord.get(lc(w.word)); return c ? cardState(c) : 'new'; };
  const shown = useMemo(() => {
    const idx = new Map(words.map((w, i) => [lc(w.word), i]));
    const at = (w: DeckWord) => byWord.get(lc(w.word))?.addedAt ?? idx.get(lc(w.word)) ?? 0;
    const list = words.filter((w) => !q || lc(w.word).includes(lc(q)) || lc(w.vi).includes(lc(q)));
    const by: Record<Sort, (a: DeckWord, b: DeckWord) => number> = {
      new: (a, b) => (idx.get(lc(b.word))! - idx.get(lc(a.word))!) || at(b) - at(a),
      old: (a, b) => (idx.get(lc(a.word))! - idx.get(lc(b.word))!) || at(a) - at(b),
      abc: (a, b) => a.word.localeCompare(b.word),
      learned: (a, b) => RANK[stateOf(b)] - RANK[stateOf(a)] || ((byWord.get(lc(b.word))?.stability ?? 0) - (byWord.get(lc(a.word))?.stability ?? 0)),
    };
    return [...list].sort(by[sort]);
  }, [words, sort, q, byWord]); // eslint-disable-line react-hooks/exhaustive-deps

  // 7 ngày gần nhất: số lượt ôn/học các thẻ trong bộ (đúng / sai).
  const week = useMemo(() => {
    const ids = new Set(cards.filter((c) => inDeck(c, d.id) || words.some((w) => lc(w.word) === lc(c.word))).map((c) => c.id));
    const day0 = new Date().setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => ({ t: day0 - (6 - i) * 864e5, ok: 0, no: 0 }));
    for (const l of db.logs) {
      if (!l.cardId || !ids.has(l.cardId) || l.at < days[0].t) continue;
      const k = Math.min(6, Math.floor((l.at - days[0].t) / 864e5));
      if (l.ok) days[k].ok++; else days[k].no++;
    }
    return days;
  }, [db.logs, cards, words, d.id]);
  const max = Math.max(1, ...week.map((x) => x.ok + x.no));

  const exportCsv = () => download(deckFileName(d.name, 'csv'), toCsv(words), 'text/csv;charset=utf-8');
  const exportJson = () => download(deckFileName(d.name, 'json'), JSON.stringify(deckJson(d, words), null, 1), 'application/json');
  const copyMine = async () => { const nid = await copyBuiltin({ ...d, words }); nav(`/vocab/deck/${encodeURIComponent(nid)}`); };
  const bulk = async (to: string, move: boolean) => {
    const r = await copyWords({ ...d, words }, to, [...sel], move);
    setMsg(`${move ? 'Đã chuyển' : 'Đã chép'} ${r.added} từ${r.dup ? ` (${r.dup} từ đã có)` : ''} sang "${decks.find((x) => x.id === to)?.name}".`);
    setSel(new Set());
  };
  const toggle = (w: string) => setSel((s) => { const n = new Set(s); if (n.has(w)) n.delete(w); else n.add(w); return n; });

  return (
    <div className="page lt dk-page" style={{ ['--skill' as string]: d.color ?? 'var(--primary)' }} data-testid="deck-page">
      <Link to="/vocab" className="back small"><ArrowLeft size={15} /> Từ vựng</Link>
      <header className="dk-head card" style={{ ['--dk' as string]: d.color ?? 'var(--primary)' }}>
        <span className="dk-head__emoji" aria-hidden>{d.emoji ?? '📚'}</span>
        <div className="dk-head__txt">
          {info ? (
            <div className="stack">
              <div className="dk-meta__row">
                <select className="input dk-emoji" value={info.emoji} onChange={(e) => setInfo({ ...info, emoji: e.target.value })} aria-label="Biểu tượng">{EMOJIS.map((e) => <option key={e}>{e}</option>)}</select>
                <input className="input" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} aria-label="Tên bộ" data-testid="dk-rename" />
              </div>
              <input className="input" placeholder="Mô tả" value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} aria-label="Mô tả" />
              <div className="row"><button className="btn btn--primary btn--sm" disabled={!info.name.trim()} onClick={async () => { await updateDeck(d.id, { name: info.name.trim(), emoji: info.emoji, description: info.description || undefined }); setInfo(null); }}><Check size={14} /> Lưu</button><button className="btn btn--text btn--sm" onClick={() => setInfo(null)}>Huỷ</button></div>
            </div>
          ) : <>
            <h1 className="dk-head__name">{d.name}{own && <button className="icon-btn icon-btn--sm" onClick={() => setInfo({ name: d.name, emoji: d.emoji ?? '📚', description: d.description ?? '' })} aria-label="Sửa tên, biểu tượng, mô tả"><Pencil size={15} /></button>}</h1>
            {(d.description || d.vi) && <p className="muted small">{d.description ?? d.vi}</p>}
            <div className="row wrap small">
              <span className="chip">{SRC[d.kind === 'saved' ? 'custom' : d.source ?? 'custom']}</span>
              {d.topic && <span className="chip">{d.topic}</span>}{d.level && <span className="chip">Band {d.level}</span>}
              {d.ref && <Link to={`/reading/${d.ref}`}>Mở bài Reading →</Link>}
            </div>
          </>}
        </div>
      </header>

      <div className="dk-actions">
        <Link className="btn btn--primary" to={`/vocab/learn?more=1&deck=${enc}`} data-testid="dk-learn"><BookOpen size={16} /> Học từ mới{st.n.new ? ` (${st.n.new})` : ''}</Link>
        <Link className={`btn ${st.due ? 'btn--primary' : 'btn--ghost'}`} to={`/vocab/review?deck=${enc}`}><RotateCcw size={16} /> Ôn tập{st.due ? ` (${st.due})` : ''}</Link>
        <Link className="btn btn--ghost" to={`/vocab/context?deck=${enc}`} title="Đoạn văn AI dùng từ của bộ, hoặc điền từ vào câu thật trong đề"><Sparkles size={16} /> Luyện theo ngữ cảnh</Link>
        {!mine && <button className="btn btn--ghost" onClick={copyMine} data-testid="dk-copy"><Copy size={16} /> Sao chép thành bộ của tôi</button>}
      </div>

      <section className="dk-stats card pad">
        <div className="row-between wrap"><strong>{st.learned}/{st.total} từ đã thuộc · {st.pct}%</strong><span className="small muted">{st.due ? `${st.due} từ đến hạn ôn` : 'Không có từ đến hạn'}</span></div>
        <div className="deck__bar">{(['known', 'review', 'learning'] as WordState[]).map((k) => st.n[k] ? <span key={k} className={`st--${k}`} style={{ width: `${(st.n[k] / Math.max(1, st.total)) * 100}%` }} /> : null)}</div>
        <div className="small muted">{STATE_ORDER.map((k) => `${STATE_NAMES[k]} ${st.n[k]}`).join(' · ')}</div>
        <div className="dk-week" aria-label="Lượt học 7 ngày qua">
          {week.map((x) => (
            <div key={x.t} className="dk-week__col" title={`${new Date(x.t).toLocaleDateString('vi-VN')}: ${x.ok} đúng, ${x.no} sai`}>
              <div className="dk-week__bar"><span className="is-no" style={{ height: `${(x.no / max) * 100}%` }} /><span className="is-ok" style={{ height: `${(x.ok / max) * 100}%` }} /></div>
              <small>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(x.t).getDay()]}</small>
            </div>
          ))}
        </div>
        <p className="small muted">Lượt học/ôn 7 ngày: <span className="dk-dot is-ok" /> đúng · <span className="dk-dot is-no" /> sai</p>
      </section>

      <section className="stack">
        <div className="row-between wrap">
          <h2 className="h3">Từ trong bộ <span className="muted small">({words.length})</span></h2>
          <div className="row wrap">
            {mine && <button className="btn btn--ghost btn--sm" onClick={() => setAdding(true)} data-testid="dk-add"><Plus size={15} /> Thêm từ</button>}
            <button className="btn btn--ghost btn--sm" onClick={exportCsv} data-testid="dk-csv"><Download size={15} /> CSV</button>
            <button className="btn btn--ghost btn--sm" onClick={exportJson}><Download size={15} /> JSON</button>
            {shareSupported() && <button className="btn btn--ghost btn--sm" onClick={() => setDlg('share')} data-testid="dk-share"><Link2 size={15} /> Chia sẻ</button>}
            {own && others.length > 0 && <button className="btn btn--ghost btn--sm" onClick={() => setDlg('merge')}><Merge size={15} /> Gộp</button>}
            {own && <button className="btn btn--ghost btn--sm dk-danger" onClick={() => setDlg('delete')} data-testid="dk-delete"><Trash2 size={15} /> Xoá bộ</button>}
          </div>
        </div>
        <div className="row wrap">
          <input className="input" placeholder="Tìm trong bộ…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input dk-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sắp xếp" data-testid="dk-sort">
            <option value="new">Mới thêm trước</option><option value="old">Cũ trước</option><option value="abc">A → Z</option><option value="learned">Thuộc nhiều trước</option>
          </select>
        </div>
        {sel.size > 0 && mine && (
          <div className="dk-bulk card" data-testid="dk-bulk">
            <span className="small"><strong>{sel.size}</strong> từ đã chọn</span>
            <BulkTo decks={others} label="Chuyển sang" onPick={(to) => bulk(to, true)} />
            <BulkTo decks={others} label="Chép sang" onPick={(to) => bulk(to, false)} />
            <button className="btn btn--ghost btn--sm dk-danger" onClick={async () => { if (!confirm(`Bỏ ${sel.size} từ khỏi bộ này? (Tiến độ học của từ vẫn giữ trong Vốn từ.)`)) return; await removeWords(d.id, [...sel]); setSel(new Set()); }}><Trash2 size={14} /> Bỏ khỏi bộ</button>
            <button className="btn btn--text btn--sm" onClick={() => setSel(new Set())}>Bỏ chọn</button>
          </div>
        )}
        {!mine && sel.size > 0 && (
          <div className="dk-bulk card"><span className="small"><strong>{sel.size}</strong> từ đã chọn</span><BulkTo decks={others} label="Chép sang" onPick={(to) => bulk(to, false)} /><button className="btn btn--text btn--sm" onClick={() => setSel(new Set())}>Bỏ chọn</button></div>
        )}
        {filling && <p className="small muted" data-testid="dk-filling">Đang điền nghĩa tiếng Việt {filling[0]}/{filling[1]}…</p>}
        {!filling && noVi > 0 && mine && <p className="small"><button className="btn btn--ghost btn--sm" onClick={runFill} data-testid="dk-fillvi"><Sparkles size={14} /> Tự điền nghĩa cho {noVi} từ còn trống</button></p>}
        {msg && <p className="small" data-testid="dk-pmsg">{msg}</p>}
        {!words.length ? <p className="empty">Bộ chưa có từ nào. {mine && <button className="btn btn--text" onClick={() => setAdding(true)}>＋ Thêm từ</button>}</p> : (
          <ul className="vlist card dk-words" data-testid="dk-words">
            {shown.slice(0, 400).map((w) => {
              const c = byWord.get(lc(w.word));
              const s = stateOf(w);
              const on = sel.has(w.word);
              if (edit && lc(edit.old) === lc(w.word)) return (
                <li key={w.word} className="vlist__row"><div className="vlist__body wpop__form">
                  <div className="dk-meta__row"><input className="input input--sm" value={edit.w.word} onChange={(e) => setEdit({ ...edit, w: { ...edit.w, word: e.target.value } })} aria-label="Từ" /><input className="input input--sm" value={edit.w.pos} placeholder="loại từ" onChange={(e) => setEdit({ ...edit, w: { ...edit.w, pos: e.target.value } })} aria-label="Loại từ" /></div>
                  <input className="input input--sm" value={edit.w.vi} placeholder="Nghĩa tiếng Việt" onChange={(e) => setEdit({ ...edit, w: { ...edit.w, vi: e.target.value } })} aria-label="Nghĩa" data-testid="dk-edit-vi" />
                  <input className="input input--sm" value={edit.w.ipa ?? ''} placeholder="IPA" onChange={(e) => setEdit({ ...edit, w: { ...edit.w, ipa: e.target.value } })} aria-label="IPA" />
                  <input className="input input--sm" value={edit.w.ex ?? ''} placeholder="Câu ví dụ" onChange={(e) => setEdit({ ...edit, w: { ...edit.w, ex: e.target.value } })} aria-label="Ví dụ" />
                  <div className="wpop__actions"><button className="btn btn--ghost btn--sm" onClick={() => setEdit(null)}>Huỷ</button><button className="btn btn--primary btn--sm" disabled={!edit.w.word.trim()} onClick={async () => { await editWord(d.id, edit.old, { ...edit.w, word: edit.w.word.trim() }); setEdit(null); }} data-testid="dk-edit-save"><Check size={14} /> Lưu</button></div>
                </div></li>
              );
              return (
                <li key={w.word} className={`vlist__row${on ? ' is-sel' : ''}`} data-word={lc(w.word)}>
                  <input type="checkbox" className="dk-check" checked={on} onChange={() => toggle(w.word)} aria-label={`Chọn ${w.word}`} />
                  <div className="vlist__body">
                    <strong className="vocab__w">{w.word}</strong> {w.ipa && <span className="small muted">{w.ipa}</span>} {w.pos && <em className="vocab__pos">{w.pos}</em>}
                    <span className={`lt-tag st--${s}`}>{STATE_NAMES[s]}</span>
                    <div className="vocab__vi">{c?.meaning || w.vi || <span className="muted">chưa có nghĩa{mine ? ' – bấm ✎ để thêm' : ''}</span>}</div>
                    {(c?.example ?? w.ex) && <div className="vocab__ex">{c?.example ?? w.ex}</div>}
                  </div>
                  <button className="icon-btn" onClick={() => sayWord(w.word)} aria-label={`Phát âm ${w.word}`}><Volume2 size={16} /></button>
                  {mine && <button className="icon-btn" onClick={() => setEdit({ old: w.word, w: { ...w, vi: c?.meaning || w.vi } })} aria-label={`Sửa ${w.word}`}><Pencil size={16} /></button>}
                  {mine && <button className="icon-btn" onClick={() => confirm(`Bỏ "${w.word}" khỏi bộ?`) && removeWords(d.id, [w.word])} aria-label={`Bỏ ${w.word} khỏi bộ`}><Trash2 size={16} /></button>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {adding && <DeckCreate deckId={d.id} existing={words.map((w) => w.word)} onClose={() => setAdding(false)} />}
      {dlg === 'delete' && <DeleteDlg d={d} n={words.length} onClose={() => setDlg(null)} onDone={() => nav('/vocab')} />}
      {dlg === 'merge' && <MergeDlg d={d} others={others.filter((x) => x.kind === 'custom' || x.id === GENERAL)} onClose={() => setDlg(null)} onDone={(to) => nav(`/vocab/deck/${encodeURIComponent(to)}`)} />}
      {dlg === 'share' && <ShareDlg d={d} words={words} onClose={() => setDlg(null)} onFile={exportJson} />}
    </div>
  );
}

function BulkTo({ decks, label, onPick }: { decks: Deck[]; label: string; onPick: (id: string) => void }) {
  if (!decks.length) return null;
  return (
    <select className="input input--sm" value="" onChange={(e) => e.target.value && onPick(e.target.value)} aria-label={label}>
      <option value="">{label}…</option>{decks.map((x) => <option key={x.id} value={x.id}>{x.emoji ?? '📚'} {x.name}</option>)}
    </select>
  );
}

function Dlg({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__card dk-dlg">
        <div className="row-between"><h2 className="h3">{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

function DeleteDlg({ d, n, onClose, onDone }: { d: Deck; n: number; onClose: () => void; onDone: () => void }) {
  const run = async (keep: boolean) => { await deleteDeck(d.id, keep); onDone(); };
  return (
    <Dlg title={`Xoá bộ "${d.name}"?`} onClose={onClose}>
      <p className="small">Bộ có {n} từ. Bạn muốn làm gì với các từ này?</p>
      <div className="stack">
        <button className="btn btn--primary" onClick={() => run(true)} data-testid="dk-del-keep">Giữ từ trong Sổ chung (giữ tiến độ học)</button>
        <button className="btn btn--danger" onClick={() => run(false)} data-testid="dk-del-all">Xoá luôn các từ chỉ thuộc bộ này</button>
        <button className="btn btn--text" onClick={onClose}>Huỷ</button>
      </div>
    </Dlg>
  );
}

function MergeDlg({ d, others, onClose, onDone }: { d: Deck; others: Deck[]; onClose: () => void; onDone: (to: string) => void }) {
  const [to, setTo] = useState(others[0]?.id ?? '');
  return (
    <Dlg title="Gộp bộ" onClose={onClose}>
      <p className="small">Chuyển toàn bộ từ của "{d.name}" sang bộ khác rồi xoá "{d.name}". Tiến độ học được giữ.</p>
      <select className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Gộp vào bộ">{others.map((x) => <option key={x.id} value={x.id}>{x.emoji ?? '📚'} {x.name}</option>)}</select>
      <div className="modal__actions"><button className="btn btn--ghost" onClick={onClose}>Huỷ</button><button className="btn btn--primary" disabled={!to} onClick={async () => { await mergeDecks(d.id, to); onDone(to); }}>Gộp</button></div>
    </Dlg>
  );
}

function ShareDlg({ d, words, onClose, onFile }: { d: Deck; words: DeckWord[]; onClose: () => void; onFile: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const tooMany = words.length > SHARE_MAX_WORDS;
  useEffect(() => { if (!tooMany && words.length) encodeShare(d, words).then((c) => setUrl(shareUrl(c))).catch(() => setUrl('')); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const long = !!url && url.length > SHARE_MAX_URL;
  return (
    <Dlg title="Chia sẻ bộ từ" onClose={onClose}>
      <p className="small muted">Người nhận mở link sẽ thấy danh sách từ và bấm "Thêm vào bộ của tôi". Chỉ gửi từ và nghĩa – <strong>tiến độ học của bạn không được chia sẻ</strong>.</p>
      {!words.length ? <p className="small">Bộ chưa có từ nào.</p> : tooMany ? <p className="small bk-warn">Bộ có {words.length} từ, link chỉ chứa được tối đa {SHARE_MAX_WORDS} từ → hãy gửi file .json.</p> : url === null ? <p className="small muted">Đang tạo link…</p> : <>
        <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} data-testid="dk-share-url" aria-label="Link chia sẻ" />
        <p className="small muted">Độ dài link: {url.length.toLocaleString('vi-VN')} ký tự.</p>
        {long && <p className="small bk-warn">Link dài hơn {SHARE_MAX_URL.toLocaleString('vi-VN')} ký tự – một số ứng dụng chat có thể cắt mất. Nên gửi file .json.</p>}
      </>}
      <div className="modal__actions">
        <button className="btn btn--ghost" onClick={onFile}><Download size={15} /> Tải file .json</button>
        {url && !tooMany && <button className="btn btn--primary" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* chọn tay */ } }}>{copied ? <><Check size={15} /> Đã chép</> : <><Copy size={15} /> Chép link</>}</button>}
      </div>
    </Dlg>
  );
}

