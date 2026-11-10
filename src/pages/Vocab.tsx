// Từ vựng: ôn theo hộp Leitner (src/lib/srs.ts) – mỗi ngày một nút "Ôn hôm nay", mỗi thẻ chỉ 2 nút Nhớ / Chưa nhớ.
// Nguồn từ: bộ từ IELTS theo chủ đề (public/data/vocab-deck.json, từ content/vocab/) + từ người học tự lưu khi đọc bài.
// Một buổi ôn: từ đến hạn (hộp 1–2: nhìn từ → nhớ nghĩa; hộp 3+: nhìn nghĩa → gõ lại từ) + từ mới (xem thẻ đầy đủ),
// cuối buổi hỏi lại các từ mới và từ "Chưa nhớ" cho tới khi nhớ hết.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Eye, Layers, Pencil, Plus, Trash2, Volume2, X } from 'lucide-react';
import { deleteCard, saveCard, useDb } from '../db';
import type { VocabCard } from '../types';
import { BOX_HINT, BOX_NAMES, boxOf, dueCards, dueText, isLearned, learn, learnedToday, newCard, review, type Box } from '../lib/srs';
import { speak, ttsAvailable } from '../lib/tts';
import { normAnswer, shuffle } from '../lib/text';
import { touchStreak, useSettings } from '../store';

type DeckTopic = { id: string; name: string; vi: string; words: [string, string, string, string?][] };
const TOPIC_KEY = 'ielts:vocab-topics';
const deckId = (w: string) => `d-${w.toLowerCase().replace(/\s+/g, '-')}`;

function useDeck() {
  const [deck, setDeck] = useState<DeckTopic[] | null>(null);
  useEffect(() => {
    fetch('./data/vocab-deck.json').then((r) => (r.ok ? r.json() : null)).then((d) => setDeck(d?.topics ?? [])).catch(() => setDeck([]));
  }, []);
  return deck;
}
function readTopics(): string[] | null { try { return JSON.parse(localStorage.getItem(TOPIC_KEY) ?? 'null'); } catch { return null; } }

/** Một lượt trong buổi ôn. learn = từ mới (xem thẻ đầy đủ); recall = nhìn từ nhớ nghĩa; type = nhìn nghĩa gõ từ. */
type Step = { card: VocabCard; kind: 'learn' | 'recall' | 'type'; repeat?: boolean };
type Session = { steps: Step[]; i: number; shown: boolean; typed: string; checked: boolean; graded: Set<string>; stats: { first: number; right: number; fresh: number } };

export default function Vocab() {
  const db = useDb();
  const s = useSettings();
  const deck = useDeck();
  const cards = useMemo(() => Object.values(db.vocab), [db.vocab]);
  const byWord = useMemo(() => new Map(cards.map((c) => [c.word.toLowerCase(), c])), [cards]);
  const [topics, setTopics] = useState<string[] | null>(readTopics);
  const [extra, setExtra] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [done, setDone] = useState<Session['stats'] | null>(null);
  const [filter, setFilter] = useState<Box | 0>(0);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ word: '', pos: '', meaning: '', example: '' });
  const [edit, setEdit] = useState<{ id: string; meaning: string; pos: string; note: string } | null>(null);
  const [showList, setShowList] = useState(false);

  const chosen = topics ?? deck?.map((t) => t.id) ?? [];
  const toggleTopic = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    setTopics(next); try { localStorage.setItem(TOPIC_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const due = useMemo(() => dueCards(cards), [cards]);
  const newLeft = Math.max(0, s.newCardsPerDay + extra - learnedToday(cards));
  // Từ mới: từ tự lưu chưa học trước, rồi từ trong bộ có sẵn theo thứ tự chủ đề đã chọn.
  const fresh = useMemo(() => {
    const own = cards.filter((c) => !isLearned(c)).sort((a, b) => a.addedAt - b.addedAt);
    const fromDeck = (deck ?? []).filter((t) => chosen.includes(t.id)).flatMap((t) => t.words
      .filter(([w]) => !byWord.has(w.toLowerCase()))
      .map(([w, pos, meaning, example]) => newCard({ id: deckId(w), word: w, pos, meaning, example, from: `deck:${t.id}` })));
    return [...own, ...fromDeck];
  }, [cards, deck, chosen, byWord]);
  const todayNew = fresh.slice(0, newLeft);
  const boxes = useMemo(() => { const n = [0, 0, 0, 0, 0, 0]; for (const c of cards) if (isLearned(c)) n[boxOf(c)]++; return n; }, [cards]);

  const start = (more = 0) => {
    const news = more ? fresh.slice(0, more) : todayNew;
    if (more) setExtra((e) => e + more);
    const steps: Step[] = [
      ...shuffle(due).map((c) => ({ card: c, kind: boxOf(c) >= 3 ? 'type' as const : 'recall' as const })),
      ...news.map((c) => ({ card: c, kind: 'learn' as const })),
    ];
    if (!steps.length) return;
    touchStreak(); setDone(null);
    setSession({ steps, i: 0, shown: false, typed: '', checked: false, graded: new Set(), stats: { first: 0, right: 0, fresh: news.length } });
  };

  /** Xong một lượt. remembered: undefined với thẻ học mới. */
  const next = async (remembered?: boolean) => {
    if (!session) return;
    const st = session.steps[session.i];
    const steps = [...session.steps];
    const stats = { ...session.stats };
    const graded = new Set(session.graded);
    let card = st.card;
    if (st.kind === 'learn') {
      card = learn(card);
      await saveCard(card);
      steps.push({ card, kind: 'recall', repeat: true }); // hỏi lại cuối buổi
    } else {
      if (!graded.has(card.id) && !st.repeat) {
        graded.add(card.id); stats.first++; if (remembered) stats.right++;
        card = review(card, !!remembered);
        await saveCard(card);
      }
      if (!remembered) steps.push({ card, kind: 'recall', repeat: true }); // chưa nhớ → hỏi lại tới khi nhớ
    }
    const i = session.i + 1;
    if (i >= steps.length) { setSession(null); setDone(stats); window.scrollTo(0, 0); return; }
    setSession({ steps, i, shown: false, typed: '', checked: false, graded, stats });
  };

  if (session) return <Review session={session} setSession={setSession} next={next} onExit={() => setSession(null)} />;

  const shown = cards.filter((c) => (!filter || (isLearned(c) && boxOf(c) === filter)) && (!q || c.word.toLowerCase().includes(q.toLowerCase()) || c.meaning.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.addedAt - a.addedAt);
  const total = due.length + todayNew.length;

  return (
    <div className="page lt" style={{ ['--skill' as string]: 'var(--primary)' }}>
      <div className="page-head">
        <span className="skill__icon skill__icon--lg"><Layers size={26} /></span>
        <div><h1>Từ vựng</h1><p>Mỗi ngày một buổi ôn ~10 phút. Nhớ thì từ lên hộp, quên thì về hộp 1.</p></div>
      </div>

      {done && (
        <div className="lt-done card pad">
          <strong>Xong buổi ôn 🎉</strong>
          <span>{done.fresh > 0 && <>{done.fresh} từ mới · </>}{done.first > 0 ? <>nhớ ngay {done.right}/{done.first} từ cũ</> : 'không có từ cũ đến hạn'}</span>
        </div>
      )}

      <div className="lt-boxes" role="group" aria-label="Các hộp">
        {([1, 2, 3, 4, 5] as Box[]).map((b) => (
          <button key={b} className={`lt-box lt-box--${b}${filter === b ? ' is-on' : ''}`} onClick={() => { setFilter(filter === b ? 0 : b); setShowList(true); }} title={`${BOX_NAMES[b]} – ${BOX_HINT[b]}`}>
            <strong>{boxes[b]}</strong>
            <span>{BOX_NAMES[b]}</span>
            <small>{BOX_HINT[b]}</small>
          </button>
        ))}
      </div>

      <div className="lt-today card">
        {total > 0 ? (
          <>
            <div>
              <div className="lt-today__n">{total} từ</div>
              <div className="muted small">{due.length} từ đến hạn ôn · {todayNew.length} từ mới</div>
            </div>
            <button className="btn btn--primary btn--lg" onClick={() => start()}>Ôn hôm nay</button>
          </>
        ) : (
          <>
            <div>
              <div className="lt-today__n">Hôm nay xong rồi ✓</div>
              <div className="muted small">{deck === null ? 'Đang tải bộ từ…' : fresh.length ? 'Ngày mai quay lại ôn tiếp nhé.' : 'Đã học hết từ trong các chủ đề đã chọn.'}</div>
            </div>
            {fresh.length > 0 && <button className="btn btn--ghost" onClick={() => start(10)}><Plus size={16} /> Học thêm 10 từ mới</button>}
          </>
        )}
      </div>

      {deck && deck.length > 0 && (
        <section className="stack">
          <h2 className="h3">Chủ đề <span className="muted small">– chọn chủ đề để lấy từ mới</span></h2>
          <div className="lt-topics">
            {deck.map((t) => {
              const on = chosen.includes(t.id);
              const learned = t.words.filter(([w]) => { const c = byWord.get(w.toLowerCase()); return c && isLearned(c); }).length;
              return (
                <button key={t.id} className={`lt-topic${on ? ' is-on' : ''}`} onClick={() => toggleTopic(t.id)} aria-pressed={on}>
                  <span className="lt-topic__check">{on && <Check size={13} />}</span>
                  <span className="lt-topic__name">{t.vi}<small>{t.name}</small></span>
                  <span className="lt-topic__n">{learned}/{t.words.length}</span>
                  <span className="lt-topic__bar" style={{ width: `${(learned / t.words.length) * 100}%` }} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="stack">
        <button className="lt-listhead" onClick={() => setShowList(!showList)} aria-expanded={showList}>
          <h2 className="h3">Sổ từ của bạn <span className="muted small">({cards.length}{filter ? ` · ${BOX_NAMES[filter]}: ${shown.length}` : ''})</span></h2>
          <ChevronDown size={18} className={showList ? 'is-up' : ''} />
        </button>
        {showList && <>
          <div className="row">
            <input className="input" placeholder="Tìm từ…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn--ghost" onClick={() => setAdding(!adding)}><Plus size={16} /> Thêm từ</button>
          </div>
          {filter ? <p className="small">Đang lọc: <strong>{BOX_NAMES[filter]}</strong> <button className="btn btn--text btn--sm" onClick={() => setFilter(0)}>Bỏ lọc</button></p> : null}
          {adding && (
            <form className="card pad form-grid" onSubmit={async (e) => { e.preventDefault(); if (!form.word.trim()) return; await saveCard(newCard({ id: `v-${form.word}-${Date.now().toString(36)}`, word: form.word.trim(), pos: form.pos, meaning: form.meaning, example: form.example })); setForm({ word: '', pos: '', meaning: '', example: '' }); setAdding(false); }}>
              <input className="input" placeholder="Từ / cụm" value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} autoFocus />
              <input className="input" placeholder="Loại từ (n, v, adj…)" value={form.pos} onChange={(e) => setForm({ ...form, pos: e.target.value })} />
              <input className="input" placeholder="Nghĩa" value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} />
              <input className="input" placeholder="Câu ví dụ" value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
              <div className="row"><button className="btn btn--primary" type="submit">Lưu</button><button className="btn btn--ghost" type="button" onClick={() => setAdding(false)}>Huỷ</button></div>
            </form>
          )}
          {shown.length === 0 ? <p className="empty">{cards.length ? 'Không có từ nào khớp.' : 'Chưa có từ nào. Bấm "Ôn hôm nay" để học từ trong bộ có sẵn, hoặc bấm vào từ trong bài Reading/Listening (Luyện tập) để lưu.'}</p> : (
            <ul className="vlist card">
              {shown.map((c) => (
                <li key={c.id} className="vlist__row">
                  <div className="vlist__body">
                    <strong className="vocab__w">{c.word}</strong> {c.ipa && <span className="small muted">{c.ipa}</span>} <em className="vocab__pos">{c.pos}</em>
                    {isLearned(c) && <span className={`lt-tag lt-box--${boxOf(c)}`}>{BOX_NAMES[boxOf(c)]}</span>}
                    {edit?.id === c.id ? (
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
                      <div className="vocab__vi">{c.meaning}</div>
                      {c.example && <div className="vocab__ex">{c.example}</div>}
                      {c.note && <div className="small vocab__note">📝 {c.note}</div>}
                      {c.from && db.materials[c.from] && <div className="small muted">Từ bài: <Link to={`/${db.materials[c.from].skill}/${c.from}/practice`}>{db.materials[c.from].title}</Link></div>}
                    </>}
                    <div className="small muted">{dueText(c)}</div>
                  </div>
                  <button className="icon-btn" onClick={() => speak(c.word)} aria-label="Phát âm"><Volume2 size={16} /></button>
                  <button className="icon-btn" onClick={() => setEdit({ id: c.id, meaning: c.meaning, pos: c.pos ?? '', note: c.note ?? '' })} aria-label="Sửa"><Pencil size={16} /></button>
                  <button className="icon-btn" onClick={() => confirm(`Xoá "${c.word}" khỏi sổ từ?`) && deleteCard(c.id)} aria-label="Xoá"><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </>}
      </section>
    </div>
  );
}

/** Màn ôn: một thẻ giữa màn hình. */
function Review({ session, setSession, next, onExit }: { session: Session; setSession: (s: Session) => void; next: (r?: boolean) => void; onExit: () => void }) {
  const st = session.steps[session.i];
  const c = st.card;
  const typedOk = normAnswer(session.typed) === normAnswer(c.word);
  const say = () => ttsAvailable() && speak(c.word, { rate: 0.9 });
  // Đọc từ khi thẻ hiện mặt có chữ tiếng Anh.
  useEffect(() => { if (st.kind !== 'type') say(); }, [session.i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (st.kind === 'learn' && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) { e.preventDefault(); next(); }
      else if (st.kind === 'recall' && !session.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setSession({ ...session, shown: true }); }
      else if (st.kind === 'recall' && session.shown && (e.key === 'ArrowLeft' || e.key === '1')) next(false);
      else if (st.kind === 'recall' && session.shown && (e.key === 'ArrowRight' || e.key === '2')) next(true);
      else if (st.kind === 'type' && session.checked && e.key === 'Enter') next(typedOk);
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });
  const left = new Set(session.steps.slice(session.i).map((x) => x.card.id)).size;
  const example = c.example && st.kind === 'type' && !session.checked
    ? c.example.replace(new RegExp(c.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '_____') : c.example;
  const word = (
    <div className="lt-word">
      <strong>{c.word}</strong>
      <button className="icon-btn" onClick={say} aria-label="Phát âm"><Volume2 size={20} /></button>
    </div>
  );
  return (
    <div className="page lt lt-review" style={{ ['--skill' as string]: 'var(--primary)' }}>
      <div className="topbar">
        <button className="icon-btn" onClick={onExit} aria-label="Thoát"><X size={20} /></button>
        <div className="topbar__title"><small>Ôn từ vựng</small><strong>Còn {left} từ</strong></div>
      </div>
      <div className="bar"><div className="bar__fill" style={{ width: `${(session.i / session.steps.length) * 100}%` }} /></div>

      <div className="lt-card card">
        <div className="lt-card__tag">
          {st.kind === 'learn' ? <span className="lt-tag lt-tag--new">Từ mới</span>
            : st.repeat ? <span className="lt-tag">Nhắc lại</span>
              : <span className={`lt-tag lt-box--${boxOf(c)}`}>{BOX_NAMES[boxOf(c)]}</span>}
          {c.pos && <em className="vocab__pos">{c.pos}</em>}
        </div>

        {st.kind === 'learn' && (
          <>
            {word}
            <p className="lt-mean">{c.meaning}</p>
            {c.example && <p className="lt-ex">{c.example}</p>}
            <div className="lt-actions"><button className="btn btn--primary btn--lg" onClick={() => next()} autoFocus>Đã xem, tiếp <small>Enter</small></button></div>
          </>
        )}

        {st.kind === 'recall' && (
          <>
            {word}
            {c.example && <p className="lt-ex">{c.example}</p>}
            {session.shown ? (
              <>
                <p className="lt-mean">{c.meaning}</p>
                {c.note && <p className="small muted">📝 {c.note}</p>}
                <div className="lt-actions lt-actions--two">
                  <button className="btn lt-no" onClick={() => next(false)}><X size={18} /> Chưa nhớ <small>←</small></button>
                  <button className="btn lt-yes" onClick={() => next(true)}><Check size={18} /> Nhớ <small>→</small></button>
                </div>
              </>
            ) : (
              <>
                <p className="lt-ask">Bạn có nhớ nghĩa của từ này không?</p>
                <div className="lt-actions"><button className="btn btn--primary btn--lg" onClick={() => setSession({ ...session, shown: true })}><Eye size={18} /> Xem nghĩa <small>Space</small></button></div>
              </>
            )}
          </>
        )}

        {st.kind === 'type' && (
          <>
            <p className="lt-mean">{c.meaning}</p>
            {example && <p className="lt-ex">{example}</p>}
            <form className="lt-type" onSubmit={(e) => { e.preventDefault(); if (!session.checked) { setSession({ ...session, checked: true }); say(); } }}>
              <input className={`input input--lg${session.checked ? (typedOk ? ' is-correct' : ' is-wrong') : ''}`} autoFocus value={session.typed} disabled={session.checked}
                onChange={(e) => setSession({ ...session, typed: e.target.value })} placeholder="Gõ từ tiếng Anh…" spellCheck={false} autoComplete="off" autoCapitalize="off" />
              {!session.checked && <button className="btn btn--primary" type="submit">Kiểm tra</button>}
            </form>
            {session.checked && (
              <>
                <div className={typedOk ? 'ok-text' : 'no-text'}>{typedOk ? <><Check size={16} /> Chính xác</> : <><X size={16} /> Đáp án: <strong>{c.word}</strong></>}</div>
                <div className="lt-actions"><button className={`btn btn--lg ${typedOk ? 'lt-yes' : 'lt-no'}`} onClick={() => next(typedOk)} autoFocus>Tiếp <small>Enter</small></button></div>
              </>
            )}
          </>
        )}
      </div>
      <p className="muted small center">{st.kind === 'type' ? 'Hộp 3 trở lên: nhìn nghĩa, gõ lại từ – nhớ cả chính tả.' : st.kind === 'recall' ? 'Tự nhớ nghĩa trước, rồi bấm Xem nghĩa để so.' : 'Đọc to từ và câu ví dụ một lần.'}</p>
    </div>
  );
}
