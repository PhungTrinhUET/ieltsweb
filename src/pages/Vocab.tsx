// Từ vựng (kiểu MemCab): trang chính.
//   - 4 trạng thái (Sẽ học / Đang học / Ôn tập / Đã thuộc) theo FSRS (src/lib/srs.ts).
//   - "Hôm nay": Ôn N từ đến hạn (/vocab/review) + Học nhóm từ mới (/vocab/learn) – xem src/pages/VocabSession.tsx.
//   - Bộ từ: chủ đề có sẵn, bộ theo đề, từ đã lưu, bộ tự tạo; mỗi bộ có tiến độ theo trạng thái + "Học tiếp" / "Ôn bộ này".
//   - Sổ từ: tìm, lọc theo trạng thái, sửa/xoá, câu thật trong đề cho từng từ.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Layers, Pencil, Plus, Quote, Trash2, Volume2 } from 'lucide-react';
import { deleteCard, saveCard, useDb } from '../db';
import type { VocabCard } from '../types';
import { STATE_NAMES, STATE_ORDER, cardState, dueCards, dueText, isLearned, learnedToday, newCard, type WordState } from '../lib/srs';
import { type Deck, inDeck, useAllDecks } from '../lib/vocab';
import { sayWord } from '../components/VocabEx';
import ContextList from '../components/ContextList';
import { useSettings } from '../store';
import { readTopics, TOPIC_KEY } from './VocabSession';
import DeckTools from '../components/DeckTools';

type Counts = Record<WordState, number>;
const zero = (): Counts => ({ new: 0, learning: 0, review: 0, known: 0 });

export default function Vocab() {
  const db = useDb();
  const s = useSettings();
  const decks = useAllDecks();
  const cards = useMemo(() => Object.values(db.vocab), [db.vocab]);
  const words = useMemo(() => cards.filter((c) => c.kind !== 'sentence'), [cards]);
  const byWord = useMemo(() => new Map(words.map((c) => [c.word.toLowerCase(), c])), [words]);
  const [topics, setTopics] = useState<string[] | null>(readTopics);
  const [filter, setFilter] = useState<WordState | ''>('');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ word: '', pos: '', meaning: '', example: '' });
  const [edit, setEdit] = useState<{ id: string; meaning: string; pos: string; note: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [deckTab, setDeckTab] = useState<Deck['kind']>('topic');

  const topicDecks = decks?.filter((d) => d.kind === 'topic') ?? [];
  const chosen = topics ?? topicDecks.map((t) => t.id.slice(5));
  const toggleTopic = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    setTopics(next); try { localStorage.setItem(TOPIC_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const due = useMemo(() => dueCards(cards), [cards]);
  const doneToday = db.logs.filter((l) => l.rating && l.at >= new Date().setHours(0, 0, 0, 0)).length;
  const reviewN = Math.min(due.length, Math.max(0, s.reviewLimit - doneToday));
  const newLeft = Math.max(0, s.newCardsPerDay - learnedToday(cards));
  const counts = useMemo(() => { const n = zero(); for (const c of words) n[cardState(c)]++; return n; }, [words]);
  const sentences = cards.length - words.length;

  /** Tiến độ một bộ: thẻ đã có + từ chưa thành thẻ (Sẽ học). */
  const deckStats = (d: Deck) => {
    const n = zero(); let due = 0;
    const seen = new Set<string>();
    for (const w of d.words) { const c = byWord.get(w.word.toLowerCase()); seen.add(w.word.toLowerCase()); if (c) { n[cardState(c)]++; if (isLearned(c) && c.due <= Date.now() + 864e5) due++; } else n.new++; }
    if (d.kind === 'saved' || d.kind === 'custom') for (const c of words) if (!seen.has(c.word.toLowerCase()) && inDeck(c, d.id)) { n[cardState(c)]++; if (isLearned(c) && c.due <= Date.now()) due++; }
    return { n, total: n.new + n.learning + n.review + n.known, due };
  };

  const shown = cards.filter((c) => (!filter || cardState(c) === filter) && (!q || c.word.toLowerCase().includes(q.toLowerCase()) || c.meaning.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.addedAt - a.addedAt);
  const tabs: [Deck['kind'], string][] = [['topic', 'Chủ đề'], ['test', 'Theo đề'], ['saved', 'Đã lưu'], ['custom', 'Tự tạo']];
  const list = decks?.filter((d) => d.kind === deckTab) ?? [];

  return (
    <div className="page lt" style={{ ['--skill' as string]: 'var(--primary)' }}>
      <div className="page-head">
        <span className="skill__icon skill__icon--lg"><Layers size={26} /></span>
        <div><h1>Từ vựng</h1><p>Học từ mới theo nhóm qua nhiều dạng bài, ôn đúng lúc sắp quên (FSRS). Câu ví dụ lấy từ đề thật.</p></div>
      </div>

      <div className="lt-boxes" role="group" aria-label="Trạng thái">
        {STATE_ORDER.map((b) => (
          <button key={b} className={`lt-box st--${b}${filter === b ? ' is-on' : ''}`} onClick={() => { setFilter(filter === b ? '' : b); setShowList(true); }}>
            <strong>{counts[b]}</strong>
            <span>{STATE_NAMES[b]}</span>
          </button>
        ))}
      </div>

      <div className="lt-today card" data-testid="vocab-today">
        <div className="lt-today__row">
          <div><div className="lt-today__n">{reviewN} từ cần ôn</div><div className="muted small">{due.length > reviewN ? `${due.length} thẻ đến hạn · giới hạn ${s.reviewLimit}/ngày` : reviewN ? 'yếu nhất trước' : 'không có từ đến hạn'}{sentences ? ` · gồm câu hay sai` : ''}</div></div>
          {reviewN > 0 ? <Link className="btn btn--primary btn--lg" to="/vocab/review" data-testid="vocab-review">Ôn ngay</Link> : <span className="ok-text"><Check size={18} /></span>}
        </div>
        <div className="lt-today__row">
          <div><div className="lt-today__n">{newLeft ? `${Math.min(newLeft, 6)} từ mới` : 'Đủ từ mới hôm nay ✓'}</div><div className="muted small">{learnedToday(cards)}/{s.newCardsPerDay} từ mới hôm nay · nhóm 6 từ, 5 dạng bài</div></div>
          <Link className={`btn btn--lg ${newLeft ? 'btn--primary' : 'btn--ghost'}`} to={newLeft ? '/vocab/learn' : '/vocab/learn?more=1'} data-testid="vocab-learn">{newLeft ? 'Học' : <><Plus size={16} /> Học thêm</>}</Link>
        </div>
      </div>

      <section className="stack">
        <div className="tabs" role="tablist">
          {tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={deckTab === k} className={`tabs__btn${deckTab === k ? ' is-on' : ''}`} onClick={() => setDeckTab(k)}>{label} <small className="muted">{decks?.filter((d) => d.kind === k).length ?? ''}</small></button>)}
        </div>
        {deckTab === 'topic' && <p className="small muted">Bấm ô vuông để chọn chủ đề lấy từ cho nút "Học" ở trên.</p>}
        {deckTab === 'custom' && <DeckTools />}
        {decks === null ? <p className="muted">Đang tải bộ từ…</p> : !list.length ? <p className="empty">{deckTab === 'saved' ? 'Chưa lưu từ nào. Bấm vào từ khi đọc/nghe bài (Luyện tập) để lưu kèm câu gốc.' : deckTab === 'test' ? 'Chưa có bộ theo đề.' : 'Chưa có bộ tự tạo.'}</p> : (
          <div className="deck-grid">
            {list.map((d) => {
              const st = deckStats(d);
              const on = d.kind === 'topic' && chosen.includes(d.id.slice(5));
              const learned = st.n.review + st.n.known;
              return (
                <div key={d.id} className="deck card" data-testid="deck">
                  <div className="deck__head">
                    {d.kind === 'topic' && <button className={`lt-topic__check${on ? ' is-on' : ''}`} onClick={() => toggleTopic(d.id.slice(5))} aria-pressed={on} aria-label={`Chọn chủ đề ${d.name}`}>{on && <Check size={13} />}</button>}
                    <div className="deck__name"><strong>{d.name}</strong>{d.vi && <small className="muted">{d.vi}</small>}{d.ref && <Link className="small" to={`/reading/${d.ref}`}>{d.ref}</Link>}</div>
                    <span className="deck__n">{learned}/{st.total}</span>
                  </div>
                  <div className="deck__bar" aria-label="Tiến độ">
                    {(['known', 'review', 'learning'] as WordState[]).map((k) => st.n[k] ? <span key={k} className={`st--${k}`} style={{ width: `${(st.n[k] / Math.max(1, st.total)) * 100}%` }} title={`${STATE_NAMES[k]}: ${st.n[k]}`} /> : null)}
                  </div>
                  <div className="deck__meta small muted">{STATE_ORDER.map((k) => `${STATE_NAMES[k]} ${st.n[k]}`).join(' · ')}</div>
                  <div className="row">
                    {st.n.new + st.n.learning > 0 && <Link className="btn btn--primary btn--sm" to={`/vocab/learn?more=1&deck=${encodeURIComponent(d.id)}`}>Học tiếp</Link>}
                    {learned + st.n.learning > 0 && <Link className="btn btn--ghost btn--sm" to={`/vocab/review?deck=${encodeURIComponent(d.id)}`}>Ôn bộ này{st.due ? ` (${st.due})` : ''}</Link>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="stack">
        <button className="lt-listhead" onClick={() => setShowList(!showList)} aria-expanded={showList}>
          <h2 className="h3">Sổ từ của bạn <span className="muted small">({cards.length}{filter ? ` · ${STATE_NAMES[filter]}: ${shown.length}` : ''})</span></h2>
          <ChevronDown size={18} className={showList ? 'is-up' : ''} />
        </button>
        {showList && <>
          <div className="row">
            <input className="input" placeholder="Tìm từ…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn--ghost" onClick={() => setAdding(!adding)}><Plus size={16} /> Thêm từ</button>
          </div>
          {filter ? <p className="small">Đang lọc: <strong>{STATE_NAMES[filter]}</strong> <button className="btn btn--text btn--sm" onClick={() => setFilter('')}>Bỏ lọc</button></p> : null}
          {adding && (
            <form className="card pad form-grid" onSubmit={async (e) => { e.preventDefault(); if (!form.word.trim()) return; await saveCard(newCard({ id: `v-${form.word.trim().toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`, word: form.word.trim(), pos: form.pos, meaning: form.meaning, example: form.example || undefined, decks: ['saved'] })); setForm({ word: '', pos: '', meaning: '', example: '' }); setAdding(false); }}>
              <input className="input" placeholder="Từ / cụm" value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} autoFocus />
              <input className="input" placeholder="Loại từ (n, v, adj…)" value={form.pos} onChange={(e) => setForm({ ...form, pos: e.target.value })} />
              <input className="input" placeholder="Nghĩa" value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} />
              <input className="input" placeholder="Câu ví dụ" value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
              <div className="row"><button className="btn btn--primary" type="submit">Lưu</button><button className="btn btn--ghost" type="button" onClick={() => setAdding(false)}>Huỷ</button></div>
            </form>
          )}
          {shown.length === 0 ? <p className="empty">{cards.length ? 'Không có từ nào khớp.' : 'Chưa có từ nào. Bấm "Học" để học từ trong bộ có sẵn, hoặc bấm vào từ trong bài Reading/Listening (Luyện tập) để lưu.'}</p> : (
            <ul className="vlist card" data-testid="vocab-list">
              {shown.slice(0, 300).map((c) => <Row key={c.id} c={c} open={open === c.id} onOpen={() => setOpen(open === c.id ? null : c.id)} edit={edit?.id === c.id ? edit : null} setEdit={setEdit} />)}
            </ul>
          )}
        </>}
      </section>
    </div>
  );
}

function Row({ c, open, onOpen, edit, setEdit }: { c: VocabCard; open: boolean; onOpen: () => void; edit: { id: string; meaning: string; pos: string; note: string } | null; setEdit: (e: { id: string; meaning: string; pos: string; note: string } | null) => void }) {
  const db = useDb();
  const sentence = c.kind === 'sentence';
  const src = c.from && db.materials[c.from];
  return (
    <li className="vlist__row" data-word={c.word.toLowerCase()}>
      <div className="vlist__body">
        <strong className="vocab__w">{sentence ? 'Câu hay sai' : c.word}</strong> {c.ipa && <span className="small muted">{c.ipa}</span>} {c.pos && <em className="vocab__pos">{c.pos}</em>}
        <span className={`lt-tag st--${cardState(c)}`}>{STATE_NAMES[cardState(c)]}</span>
        {edit ? (
          <div className="wpop__form">
            <label className="small">Nghĩa tiếng Việt<input className="input" value={edit.meaning} onChange={(e) => setEdit({ ...edit, meaning: e.target.value })} /></label>
            <label className="small">Loại từ<input className="input" value={edit.pos} onChange={(e) => setEdit({ ...edit, pos: e.target.value })} /></label>
            <label className="small">Ghi chú<textarea className="textarea" rows={2} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></label>
            <div className="wpop__actions">
              <button className="btn btn--ghost btn--sm" onClick={() => setEdit(null)}>Huỷ</button>
              <button className="btn btn--primary btn--sm" onClick={async () => { await saveCard({ ...c, meaning: edit.meaning, pos: edit.pos || undefined, note: edit.note || undefined }); setEdit(null); }}><Check size={15} /> Lưu</button>
            </div>
          </div>
        ) : <>
          {sentence ? <div className="vocab__ex">{c.word}</div> : <div className="vocab__vi">{c.meaning}</div>}
          {c.example && !sentence && <div className="vocab__ex">{c.example}</div>}
          {c.context && <div className="vocab__ex vocab__ctx"><Quote size={12} /> {c.context.text}{c.context.label && <span className="small muted"> – {c.context.label}</span>}</div>}
          {c.note && <div className="small vocab__note">📝 {c.note}</div>}
          {src && <div className="small muted">Từ bài: <Link to={`/${src.skill}/${src.id}/practice`}>{src.title}</Link></div>}
          {open && !sentence && <ContextList word={c.word} max={3} />}
        </>}
        <div className="small muted">{dueText(c)}{!sentence && <> · <button className="btn btn--text btn--sm" onClick={onOpen}>{open ? 'Ẩn câu trong đề' : 'Câu trong đề'}</button></>}</div>
      </div>
      {!sentence && <button className="icon-btn" onClick={() => sayWord(c.word)} aria-label="Phát âm"><Volume2 size={16} /></button>}
      <button className="icon-btn" onClick={() => setEdit({ id: c.id, meaning: c.meaning, pos: c.pos ?? '', note: c.note ?? '' })} aria-label="Sửa"><Pencil size={16} /></button>
      <button className="icon-btn" onClick={() => confirm(`Xoá "${sentence ? 'câu này' : c.word}" khỏi sổ từ?`) && deleteCard(c.id)} aria-label="Xoá"><Trash2 size={16} /></button>
    </li>
  );
}
