// Phiên học từ mới (A2) và phiên ôn (A3).
//   Học: nhóm 5–7 từ; các bước xen kẽ giữa các từ: giới thiệu → chọn nghĩa → chọn từ → nghe chọn → điền câu (chọn) → gõ từ.
//        Sai → bước đó quay về cuối hàng. Xong mọi bước → từ vào lịch ôn (FSRS). Hết nhóm: đoạn ngữ cảnh (AI hoặc câu thật).
//   Ôn: thẻ đến hạn, yếu nhất trước; dạng bài theo độ ổn định; FSRS tự chấm theo đúng/sai, gợi ý, thời gian.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Volume2, X } from 'lucide-react';
import { addLog, getKv, saveCard, setKv, useDb } from '../db';
import type { VocabCard } from '../types';
import { autoRating, cardState, dueCards, finishLearning, grade, isLearned, learnedToday, markKnown, startOfDay, STATE_NAMES } from '../lib/srs';
import { blankOut, cardFromDeck, enrich, type Ex, inDeck, makeEx, type PoolWord, type Step, useAllDecks, xpFor } from '../lib/vocab';
import { deckWordsOf } from '../lib/decks';
import { contextFor, type CtxSent, matAudio, srcLabel } from '../lib/context';
import { shuffle } from '../lib/text';
import { speak, ttsAvailable } from '../lib/tts';
import { aiReady, getAiConfig, touchStreak, useSettings } from '../store';
import { contextPassage, type ContextPassageData } from '../ai/assist';
import VocabEx, { type ExResult } from '../components/VocabEx';
import { Marked } from '../components/ContextList';

export const TOPIC_KEY = 'ielts:vocab-topics';
export function readTopics(): string[] | null { try { return JSON.parse(localStorage.getItem(TOPIC_KEY) ?? 'null'); } catch { return null; } }
const GROUP = 6;

/** Kho phương án nhiễu: bộ đang học nếu có ≥ 4 từ (nhiễu cùng chủ đề), không thì mọi bộ + vốn từ. */
function usePool(deck = ''): PoolWord[] {
  const db = useDb();
  const decks = useAllDecks();
  return useMemo(() => {
    const m = new Map<string, PoolWord>();
    const d = deck ? decks?.find((x) => x.id === deck) : undefined;
    if (d) {
      for (const w of deckWordsOf(d)) if (w.vi) m.set(w.word.toLowerCase(), { word: w.word, pos: w.pos, meaning: w.vi });
      for (const c of Object.values(db.vocab)) if (c.kind !== 'sentence' && c.meaning && inDeck(c, deck)) m.set(c.word.toLowerCase(), { word: c.word, pos: c.pos, meaning: c.meaning });
      if (m.size >= 4) return [...m.values()];
      m.clear();
    }
    for (const x of decks ?? []) for (const w of x.words) m.set(w.word.toLowerCase(), { word: w.word, pos: w.pos, meaning: w.vi });
    for (const c of Object.values(db.vocab)) if (c.kind !== 'sentence' && c.meaning) m.set(c.word.toLowerCase(), { word: c.word, pos: c.pos, meaning: c.meaning });
    return [...m.values()];
  }, [decks, db.vocab, deck]);
}
/** Câu thật cho mỗi thẻ (tải trước để bài điền câu / chép câu có câu mới). */
function useContexts(cards: VocabCard[] | null) {
  const db = useDb();
  const [ctx, setCtx] = useState<Record<string, CtxSent[]> | null>(null);
  useEffect(() => {
    if (!cards) return;
    let on = true;
    Promise.all(cards.map((c) => (c.kind === 'sentence' ? Promise.resolve([]) : contextFor(c.word, db.materials, 3)).then((r) => [c.id, r] as const)))
      .then((r) => on && setCtx(Object.fromEntries(r)));
    return () => { on = false; };
  }, [cards?.map((c) => c.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return ctx;
}

function Shell({ title, sub, progress, onExit, children }: { title: string; sub: string; progress: number; onExit: () => void; children: React.ReactNode }) {
  return (
    <div className="page lt lt-review" style={{ ['--skill' as string]: 'var(--primary)' }}>
      <div className="topbar">
        <button className="icon-btn" onClick={onExit} aria-label="Thoát"><X size={20} /></button>
        <div className="topbar__title"><small>{sub}</small><strong>{title}</strong></div>
      </div>
      <div className="bar"><div className="bar__fill" style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
      {children}
    </div>
  );
}

function Summary({ title, lines, children }: { title: string; lines: React.ReactNode[]; children?: React.ReactNode }) {
  return (
    <div className="lt-done card pad" data-testid="vx-summary">
      <strong>{title}</strong>
      {lines.map((l, i) => <span key={i}>{l}</span>)}
      {children}
    </div>
  );
}

// =====================================================================================
// A2. Học từ mới
// =====================================================================================
type Item = { id: string; step: Step; ex: Ex };

export function VocabLearn() {
  const db = useDb();
  const s = useSettings();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const deckParam = sp.get('deck') ?? '';
  const more = sp.has('more');
  const decks = useAllDecks();
  const pool = usePool(deckParam);

  // Chọn nhóm từ một lần khi đủ dữ liệu.
  const [group, setGroup] = useState<VocabCard[] | null>(null);
  useEffect(() => {
    if (group || !decks || !db.ready) return;
    const cards = Object.values(db.vocab).filter((c) => c.kind !== 'sentence');
    const left = more ? GROUP : Math.max(0, s.newCardsPerDay - learnedToday(cards));
    const byWord = new Map(cards.map((c) => [c.word.toLowerCase(), c]));
    const ok = (c: VocabCard) => !deckParam || inDeck(c, deckParam);
    const doing = cards.filter((c) => !isLearned(c) && c.stage && ok(c));
    const own = cards.filter((c) => !isLearned(c) && !c.stage && !!c.meaning && ok(c)).sort((a, b) => a.addedAt - b.addedAt);
    const chosen = readTopics();
    const fromDeck = decks.filter((d) => (deckParam ? d.id === deckParam : d.kind === 'topic' && (!chosen || chosen.includes(d.id.slice(5)))))
      .flatMap((d) => (deckParam ? deckWordsOf(d) : d.words).filter((w) => !byWord.has(w.word.toLowerCase())).map((w) => cardFromDeck(w, d.id)));
    const wordOf = new Map(decks.flatMap((d) => d.words.map((w) => [w.word.toLowerCase(), [w, d.id] as const])));
    const pick = [...doing, ...own, ...fromDeck].slice(0, Math.min(GROUP, left || 0))
      .map((c) => { const e = wordOf.get(c.word.toLowerCase()); return e ? enrich(c, e[0], deckParam || undefined) : c; });
    setGroup(pick);
  }, [decks, db.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useContexts(group);
  const steps = useMemo<Step[]>(() => {
    const on = s.exercises;
    return (['intro', 'meaning', 'word', 'listen', 'fill', 'type'] as Step[]).filter((x) => x === 'intro' || (on[x as keyof typeof on] ?? true))
      .filter((x) => x !== 'listen' || ttsAvailable());
  }, [s.exercises]);

  const sentenceFor = (c: VocabCard) => (c.example && blankOut(c.example, c.word) ? c.example : ctx?.[c.id]?.find((x) => blankOut(x.text, c.word))?.text);
  const build = (c: VocabCard, step: Step): Ex => makeEx(step, c, pool, { sentence: step === 'fill' ? sentenceFor(c) : undefined, choose: true, mode: ttsAvailable() && c.id.charCodeAt(c.id.length - 1) % 2 ? 'audio' : 'meaning' });

  const [queue, setQueue] = useState<Item[] | null>(null);
  const [pos, setPos] = useState(0);
  const cardsRef = useRef<Record<string, VocabCard>>({});
  const prog = useRef<Record<string, { done: number; miss: number }>>({});
  const [phase, setPhase] = useState<'steps' | 'context' | 'done'>('steps');
  const stats = useRef({ xp: 0, ok: 0, total: 0, known: 0 });

  useEffect(() => {
    if (!group || !ctx || queue) return;
    for (const c of group) { cardsRef.current[c.id] = c; prog.current[c.id] = { done: 0, miss: 0 }; }
    const q: Item[] = [];
    // Từ đang học dở: bắt đầu lại từ đầu (đơn giản, chắc chắn).
    steps.forEach((st) => { for (const c of st === 'intro' ? group : shuffle(group)) q.push({ id: c.id, step: st, ex: build(c, st) }); });
    setQueue(q);
    if (group.length) touchStreak();
  }, [group, ctx]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (c: VocabCard) => { cardsRef.current[c.id] = c; await saveCard(c); };
  const onDone = async (r: ExResult) => {
    if (!queue) return;
    const it = queue[pos];
    const c = cardsRef.current[it.id];
    const p = prog.current[it.id];
    const xp = xpFor(r.ok, it.step);
    stats.current.xp += xp; stats.current.total++; if (r.ok) stats.current.ok++;
    addLog({ cardId: c.id, kind: it.step === 'intro' ? 'learn' : it.step, ok: r.ok, ms: r.ms, hint: r.hint, xp });
    let q = queue;
    if (r.ok) {
      p.done++;
      if (p.done >= steps.length) await save(finishLearning({ ...c, stage: undefined }, p.miss));
      else await save({ ...c, stage: p.done });
    } else {
      p.miss++;
      q = [...queue, { ...it, ex: build(c, it.step) }]; // làm lại đúng bước đó ở cuối hàng
      setQueue(q);
    }
    next(q);
  };
  const next = (q: Item[]) => {
    const n = pos + 1;
    if (n >= q.length) { setPhase('context'); window.scrollTo(0, 0); } else setPos(n);
  };
  const know = async () => {
    if (!queue) return;
    const it = queue[pos];
    const c = markKnown(cardsRef.current[it.id]);
    await save({ ...c, stage: undefined });
    stats.current.known++;
    addLog({ cardId: c.id, kind: 'skip', ok: true, rating: 4, xp: 1 });
    prog.current[it.id].done = steps.length;
    const q = [...queue.slice(0, pos + 1), ...queue.slice(pos + 1).filter((x) => x.id !== it.id)];
    setQueue(q); next(q);
  };

  const exit = () => nav('/vocab');
  if (!group || (group.length && !queue)) return <div className="page"><p className="muted">Đang chuẩn bị nhóm từ…</p></div>;
  if (!group.length) return (
    <div className="page lt"><Summary title="Không còn từ mới" lines={[more || deckParam ? 'Bộ này đã học hết từ.' : `Hôm nay đã học đủ ${s.newCardsPerDay} từ mới (đổi trong Cài đặt).`]}>
      <div className="row"><Link className="btn btn--primary" to="/vocab">Về Từ vựng</Link>{!more && <Link className="btn btn--ghost" to={`/vocab/learn?more=1${deckParam ? `&deck=${encodeURIComponent(deckParam)}` : ''}`}>Học thêm {GROUP} từ</Link>}</div>
    </Summary></div>
  );

  if (phase === 'context') return (
    <Shell title="Đoạn ngữ cảnh" sub="Học từ mới · bước cuối" progress={1} onExit={exit}>
      <ContextPassage cards={group.map((c) => cardsRef.current[c.id] ?? c)} onDone={(ok) => { if (ok != null) stats.current.xp += ok * 2; setPhase('done'); }} />
    </Shell>
  );
  if (phase === 'done') return (
    <div className="page lt">
      <Summary title={`Xong nhóm ${group.length} từ 🎉`} lines={[
        `${stats.current.ok}/${stats.current.total} lượt đúng · +${stats.current.xp} XP${stats.current.known ? ` · ${stats.current.known} từ đã biết` : ''}`,
        'Các từ đã vào "Ôn tập"; app sẽ nhắc ôn đúng lúc sắp quên.',
      ]}>
        <ul className="lt-learned">{group.map((c) => <li key={c.id}><strong>{c.word}</strong> – {c.meaning} <span className={`lt-tag st--${cardState(cardsRef.current[c.id] ?? c)}`}>{STATE_NAMES[cardState(cardsRef.current[c.id] ?? c)]}</span></li>)}</ul>
        <div className="row">
          <button className="btn btn--primary" onClick={() => location.reload()}>Học nhóm tiếp</button>
          <Link className="btn btn--ghost" to="/vocab">Về Từ vựng</Link>
        </div>
      </Summary>
    </div>
  );

  const it = queue![pos];
  const left = new Set(queue!.slice(pos).map((x) => x.id)).size;
  return (
    <Shell title={`Còn ${left}/${group.length} từ`} sub="Học từ mới" progress={pos / queue!.length} onExit={exit}>
      <VocabEx key={`${pos}-${it.id}-${it.step}`} ex={it.ex} onDone={onDone} onKnow={it.step === 'intro' ? undefined : know}
        label={<span className="lt-tag lt-tag--new">{it.step === 'intro' ? 'Từ mới' : `Bước ${steps.indexOf(it.step) + 1}/${steps.length}`}</span>} />
      {it.step === 'intro' && <button className="btn btn--text btn--sm lt-know" onClick={know}>Tôi biết từ này – bỏ qua</button>}
    </Shell>
  );
}

// =====================================================================================
// A3. Ôn tập
// =====================================================================================
type RItem = { id: string; ex: Ex; repeat?: boolean };

function reviewStep(c: VocabCard, on: Record<string, boolean>): Step {
  if (c.kind === 'sentence') return 'dictate';
  const S = c.stability ?? 0;
  const tts = ttsAvailable();
  const opts: Step[] = S < 3 ? ['meaning', 'word'] : S <= 21 ? ['fill', 'listen'] : ['type', 'type', 'fill', 'dictate'];
  const ok = opts.filter((x) => (on[x] ?? true) && (tts || (x !== 'listen' && x !== 'dictate')));
  return ok.length ? ok[Math.floor(Math.random() * ok.length)] : 'meaning';
}

export function VocabReview() {
  const db = useDb();
  const s = useSettings();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const deckParam = sp.get('deck') ?? '';
  const pool = usePool(deckParam);
  const [list, setList] = useState<VocabCard[] | null>(null);
  useEffect(() => {
    if (list || !db.ready) return;
    const cards = Object.values(db.vocab).filter((c) => !deckParam || inDeck(c, deckParam));
    const done = db.logs.filter((l) => l.rating && l.at >= startOfDay()).length;
    let due = dueCards(cards);
    // "Ôn bộ này" khi bộ chưa có thẻ đến hạn: ôn sớm các thẻ yếu nhất của bộ.
    if (!due.length && deckParam) due = dueCards(cards, Date.now() + 3650 * 864e5);
    setList(due.slice(0, deckParam ? 20 : Math.max(0, s.reviewLimit - done)));
  }, [db.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const ctx = useContexts(list);

  const build = (c: VocabCard, step = reviewStep(c, s.exercises)): Ex => {
    const cs = ctx?.[c.id] ?? [];
    if (step === 'dictate') {
      if (c.kind === 'sentence') return makeEx('dictate', c, pool, { sentence: c.word, clip: c.context?.audio && c.context.start != null ? { audio: c.context.audio, start: c.context.start, end: c.context.end ?? c.context.start + 5 } : undefined });
      const real = cs.find((x) => x.start != null && matAudio(db.materials[x.mid]));
      return real ? makeEx('dictate', c, pool, { sentence: real.text, clip: { audio: matAudio(db.materials[real.mid])!, start: real.start!, end: real.end! } })
        : c.example ? makeEx('dictate', c, pool, { sentence: c.example }) : makeEx('type', c, pool, { mode: 'audio' });
    }
    if (step === 'fill') {
      // Ổn định cao: câu mới (câu thật trong đề), không dùng lại câu ví dụ.
      const S = c.stability ?? 0;
      const fresh = cs.map((x) => x.text).filter((t) => t !== c.example && blankOut(t, c.word));
      const sent = S > 21 ? fresh[0] ?? c.example : (c.example && blankOut(c.example, c.word) ? c.example : fresh[0]);
      return makeEx('fill', c, pool, { sentence: sent, choose: false });
    }
    if (step === 'type') return makeEx('type', c, pool, { mode: ttsAvailable() && Math.random() < 0.5 ? 'audio' : 'meaning' });
    return makeEx(step, c, pool);
  };

  const [queue, setQueue] = useState<RItem[] | null>(null);
  const [pos, setPos] = useState(0);
  const graded = useRef(new Set<string>());
  const stats = useRef({ xp: 0, right: 0, first: 0, wrong: [] as string[] });
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!list || !ctx || queue) return;
    setQueue(list.map((c) => ({ id: c.id, ex: build(c) })));
    if (list.length) touchStreak();
  }, [list, ctx]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = (q: RItem[]) => { if (pos + 1 >= q.length) { setDone(true); window.scrollTo(0, 0); } else setPos(pos + 1); };
  const onDone = async (r: ExResult) => {
    const it = queue![pos];
    const c = db.vocab[it.id] ?? it.ex.card;
    let q = queue!;
    const xp = xpFor(r.ok, it.ex.step);
    stats.current.xp += xp;
    if (!it.repeat && !graded.current.has(c.id)) {
      graded.current.add(c.id);
      stats.current.first++; if (r.ok) stats.current.right++; else stats.current.wrong.push(c.word);
      const rating = autoRating({ ok: r.ok, hint: r.hint, near: r.near, ms: r.ms, typing: r.typing });
      await saveCard(grade(c, rating));
      addLog({ cardId: c.id, kind: it.ex.step === 'intro' ? 'learn' : it.ex.step, ok: r.ok, score: r.score, ms: r.ms, hint: r.hint, rating, stab: c.stability, xp });
    } else addLog({ cardId: c.id, kind: it.ex.step === 'intro' ? 'learn' : it.ex.step, ok: r.ok, ms: r.ms, hint: r.hint, xp });
    // Sai → hỏi lại cuối phiên (dạng dễ hơn, không chấm lại).
    if (!r.ok) { q = [...queue!, { id: c.id, repeat: true, ex: build(c, c.kind === 'sentence' ? 'dictate' : 'word') }]; setQueue(q); }
    next(q);
  };
  const know = async () => {
    const it = queue![pos];
    const c = db.vocab[it.id] ?? it.ex.card;
    if (!graded.current.has(c.id)) { graded.current.add(c.id); stats.current.first++; stats.current.right++; await saveCard(markKnown(c)); addLog({ cardId: c.id, kind: 'skip', ok: true, rating: 4, stab: c.stability, xp: 1 }); }
    next(queue!);
  };

  const exit = () => nav('/vocab');
  if (!list || (list.length && !queue)) return <div className="page"><p className="muted">Đang chuẩn bị…</p></div>;
  if (!list.length) return (
    <div className="page lt"><Summary title="Không có từ đến hạn ôn ✓" lines={['Quay lại sau, hoặc học thêm từ mới.']}>
      <div className="row"><Link className="btn btn--primary" to="/vocab/learn">Học từ mới</Link><Link className="btn btn--ghost" to="/vocab">Về Từ vựng</Link></div>
    </Summary></div>
  );
  if (done) {
    const st = stats.current;
    return (
      <div className="page lt">
        <Summary title="Xong buổi ôn 🎉" lines={[`Nhớ ngay ${st.right}/${st.first} thẻ · +${st.xp} XP`, ...(st.wrong.length ? [`Cần chú ý: ${st.wrong.slice(0, 12).join(', ')}`] : [])]}>
          <div className="row"><Link className="btn btn--primary" to="/vocab">Về Từ vựng</Link><Link className="btn btn--ghost" to="/vocab/learn">Học từ mới</Link></div>
        </Summary>
      </div>
    );
  }
  const it = queue![pos];
  const c = it.ex.card;
  const left = new Set(queue!.slice(pos).map((x) => x.id)).size;
  return (
    <Shell title={`Còn ${left} thẻ`} sub={deckParam ? 'Ôn bộ từ' : 'Ôn tập'} progress={pos / queue!.length} onExit={exit}>
      <VocabEx key={`${pos}-${it.id}`} ex={it.ex} onDone={onDone} onKnow={it.repeat ? undefined : know}
        label={it.repeat ? <span className="lt-tag">Nhắc lại</span> : c.kind === 'sentence' ? <span className="lt-tag st--learning">Câu hay sai</span> : <span className={`lt-tag st--${cardState(c)}`}>{STATE_NAMES[cardState(c)]}</span>} />
    </Shell>
  );
}

// =====================================================================================
// A4. Đoạn ngữ cảnh cuối nhóm: AI (đoạn 120–180 từ + câu hỏi, lưu lại) hoặc điền từ vào 3–5 câu thật.
// =====================================================================================
export function ContextPassage({ cards, onDone, gradeCards }: { cards: VocabCard[]; onDone: (correct?: number) => void; gradeCards?: boolean }) {
  const db = useDb();
  const ai = aiReady(getAiConfig());
  // AI: thêm vài từ đang học/ôn tập để đủ 6–10 từ.
  const words = useMemo(() => {
    const extra = Object.values(db.vocab).filter((c) => c.kind !== 'sentence' && isLearned(c) && !cards.some((x) => x.id === c.id) && (c.stability ?? 0) < 21)
      .sort((a, b) => (b.lastReview ?? 0) - (a.lastReview ?? 0)).slice(0, Math.max(0, 6 - cards.length));
    return [...cards, ...extra].slice(0, 10);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const key = `ctxp:${words.map((c) => c.word.toLowerCase()).sort().join('|')}`;
  const [data, setData] = useState<ContextPassageData | null>(() => (getKv(key) as ContextPassageData | undefined) ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<'ai' | 'gap'>(ai || data ? 'ai' : 'gap');

  const gen = async () => {
    setBusy(true); setErr('');
    try { const d = await contextPassage(words.map((c) => ({ word: c.word, meaning: c.meaning })), getAiConfig()); await setKv(key, d); setData(d); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <div className="stack" data-testid="ctx-passage">
      {ai && <div className="tabs"><button className={`tabs__btn${mode === 'ai' ? ' is-on' : ''}`} onClick={() => setMode('ai')}>Đoạn văn AI</button><button className={`tabs__btn${mode === 'gap' ? ' is-on' : ''}`} onClick={() => setMode('gap')}>Câu thật trong đề</button></div>}
      {mode === 'ai' ? (
        data ? <AiPassage d={data} onDone={onDone} /> : (
          <div className="card pad stack">
            <p>Tạo một đoạn văn ngắn dùng {words.length} từ: <strong>{words.map((c) => c.word).join(', ')}</strong>, kèm câu hỏi. Đoạn được lưu lại, không tạo lại.</p>
            {err && <p className="no-text small">{err}</p>}
            <div className="row"><button className="btn btn--primary" onClick={gen} disabled={busy}><Sparkles size={16} /> {busy ? 'Đang tạo…' : 'Tạo đoạn văn'}</button><button className="btn btn--ghost" onClick={() => onDone()}>Bỏ qua</button></div>
          </div>
        )
      ) : <GapFill cards={cards} onDone={onDone} gradeCards={gradeCards} />}
    </div>
  );
}

function AiPassage({ d, onDone }: { d: ContextPassageData; onDone: (n?: number) => void }) {
  const [ans, setAns] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const plain = d.passage.replace(/\*\*/g, '');
  const right = d.questions.filter((q, i) => ans[i] === q.answer).length;
  return (
    <div className="card pad stack ctx-ai">
      <div className="row"><h2 className="h3">{d.title}</h2>{ttsAvailable() && <button className="icon-btn" onClick={() => speak(plain, { voice: 'en-GB' })} aria-label="Đọc đoạn văn"><Volume2 size={18} /></button>}</div>
      <p className="ctx-ai__text">{d.passage.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))}</p>
      <ol className="ctx-ai__qs">
        {d.questions.map((q, i) => (
          <li key={i}>
            <p>{q.q}</p>
            <div className="lt-opts lt-opts--sm">
              {q.options.map((o, j) => <button key={j} disabled={checked} className={`lt-opt${checked ? (j === q.answer ? ' is-right' : ans[i] === j ? ' is-wrong' : ' is-dim') : ans[i] === j ? ' is-on' : ''}`} onClick={() => setAns({ ...ans, [i]: j })}><kbd>{'ABCD'[j]}</kbd><span>{o}</span></button>)}
            </div>
            {checked && <p className="small muted">{q.explain}</p>}
          </li>
        ))}
      </ol>
      {checked ? <><p><strong>{right}/{d.questions.length}</strong> câu đúng</p><button className="btn btn--primary" onClick={() => onDone(right)}>Xong</button></>
        : <button className="btn btn--primary" onClick={() => { setChecked(true); addLog({ kind: 'context', ok: right === d.questions.length, score: right / d.questions.length, xp: right * 2 }); }} disabled={Object.keys(ans).length < d.questions.length}>Kiểm tra</button>}
    </div>
  );
}

function GapFill({ cards, onDone, gradeCards }: { cards: VocabCard[]; onDone: (n?: number) => void; gradeCards?: boolean }) {
  const db = useDb();
  const [items, setItems] = useState<{ c: VocabCard; text: string; form: string; mid?: string }[] | null>(null);
  useEffect(() => {
    let on = true;
    Promise.all(cards.map(async (c) => {
      const real = (await contextFor(c.word, db.materials, 3)).map((x) => ({ x, b: blankOut(x.text, c.word) })).find((y) => y.b);
      if (real) return { c, text: real.b!.text, form: real.b!.form, mid: real.x.mid };
      const ex = c.example ? blankOut(c.example, c.word) : null;
      return ex ? { c, text: ex.text, form: ex.form } : null;
    })).then((r) => {
      if (!on) return;
      const all = r.filter(Boolean) as NonNullable<(typeof r)[number]>[];
      // ưu tiên câu thật; 3–5 câu
      setItems(shuffle([...all.filter((x) => x.mid), ...all.filter((x) => !x.mid)].slice(0, 5)));
    });
    return () => { on = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [ans, setAns] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  if (!items) return <p className="muted">Đang tìm câu…</p>;
  if (items.length < 2) return <div className="card pad"><p>Chưa đủ câu thật cho nhóm từ này.</p><button className="btn btn--primary" onClick={() => onDone()}>Xong</button></div>;
  const bank = shuffle(items.map((x) => x.c.word));
  const right = items.filter((x, i) => (ans[i] ?? '').toLowerCase() === x.c.word.toLowerCase()).length;
  return (
    <div className="card pad stack ctx-gap">
      <p className="small muted">Chọn từ phù hợp cho mỗi chỗ trống ({items.some((x) => x.mid) ? 'câu lấy từ đề thật' : 'câu ví dụ'}). Từ trong câu có thể ở dạng khác.</p>
      <ol className="ctx-gap__list">
        {items.map((x, i) => {
          const ok = checked && (ans[i] ?? '').toLowerCase() === x.c.word.toLowerCase();
          return (
            <li key={i}>
              <p>{x.text.split('_____').map((p, j) => (j ? <span key={j}><select className={`input input--sm ctx-gap__sel${checked ? (ok ? ' is-correct' : ' is-wrong') : ''}`} value={ans[i] ?? ''} disabled={checked} onChange={(e) => setAns({ ...ans, [i]: e.target.value })} aria-label={`Chỗ trống ${i + 1}`}>
                <option value="">…</option>{[...new Set(bank)].map((w) => <option key={w} value={w}>{w}</option>)}</select>{p}</span> : <span key={j}>{p}</span>))}</p>
              {checked && <p className="small">{ok ? '✓' : <>✗ <Marked text={x.form} word={x.c.word} /></>}{x.mid && <> · <span className="muted">{srcLabel(x.mid)}</span></>}</p>}
            </li>
          );
        })}
      </ol>
      {checked ? <><p><strong>{right}/{items.length}</strong> câu đúng</p><button className="btn btn--primary" onClick={() => onDone(right)}>Xong</button></>
        : <button className="btn btn--primary" data-testid="gap-check" onClick={async () => {
          setChecked(true); addLog({ kind: 'context', ok: right === items.length, score: right / items.length, xp: right * 2 });
          // Luyện theo ngữ cảnh của một bộ: kết quả từng câu cập nhật tiến độ ôn của thẻ (đúng → Good, sai → Again).
          if (gradeCards) for (const [i, x] of items.entries()) {
            const c = db.vocab[x.c.id];
            if (!c || !isLearned(c)) continue;
            const ok = (ans[i] ?? '').toLowerCase() === x.c.word.toLowerCase();
            await saveCard(grade(c, ok ? 3 : 1));
            addLog({ cardId: c.id, kind: 'context', ok, rating: ok ? 3 : 1, stab: c.stability, xp: 0 });
          }
        }}>Kiểm tra</button>}
    </div>
  );
}

// =====================================================================================
// Đoạn ngữ cảnh riêng (mục cuối của kế hoạch "Hôm nay"): dùng 6–8 từ học gần nhất.
// =====================================================================================
export function VocabContext() {
  const db = useDb();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const deck = sp.get('deck') ?? '';
  const decks = useAllDecks();
  const dname = deck ? decks?.find((d) => d.id === deck)?.name : undefined;
  const [done, setDone] = useState<number | null>(null);
  // Theo bộ: 8–10 từ của bộ đã học (yếu nhất trước); không thì 8 từ học gần nhất.
  const cards = useMemo(() => {
    const all = Object.values(db.vocab).filter((c) => c.kind !== 'sentence' && isLearned(c) && c.meaning && (!deck || inDeck(c, deck)));
    return deck ? all.sort((a, b) => (a.stability ?? 0) - (b.stability ?? 0)).slice(0, 10)
      : all.sort((a, b) => (b.lastReview ?? b.learnedAt ?? 0) - (a.lastReview ?? a.learnedAt ?? 0)).slice(0, 8);
  }, [db.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = deck ? `/vocab/deck/${encodeURIComponent(deck)}` : '/';
  const exit = () => nav(back);
  if (!db.ready) return null;
  if (cards.length < 3) return (
    <Shell title="Luyện theo ngữ cảnh" sub={dname ?? 'Từ vựng'} progress={0} onExit={exit}>
      <p className="empty">Cần ít nhất 3 từ đã học{deck ? ' trong bộ này' : ''}. <Link to={`/vocab/learn?more=1${deck ? `&deck=${encodeURIComponent(deck)}` : ''}`}>Học từ mới</Link> trước nhé.</p>
    </Shell>
  );
  return (
    <Shell title="Luyện theo ngữ cảnh" sub={dname ? `${dname} · ${cards.length} từ` : `${cards.length} từ học gần đây`} progress={done == null ? 0 : 1} onExit={exit}>
      {done == null
        ? <ContextPassage cards={cards} gradeCards={!!deck} onDone={(ok) => { touchStreak(); setDone(ok ?? 0); }} />
        : <Summary title="Xong đoạn ngữ cảnh 🎉" lines={[`+${done * 2} XP`]}><div className="row"><Link className="btn btn--primary" to={back}>{deck ? 'Về bộ từ' : 'Về Trang chủ'}</Link><Link className="btn btn--ghost" to="/stats">Thống kê</Link></div></Summary>}
    </Shell>
  );
}
