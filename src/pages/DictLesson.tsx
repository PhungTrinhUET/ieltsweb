// Một bài nghe-chép (B4/B5/B7) kiểu DailyDictation.
//   - Tự phát câu; Nghe lại (Ctrl), Nghe chậm 0.75×, tự nghe lại 1–3 lần, "Nghe rộng hơn ±1 s".
//   - Kiểm tra (Enter) KHÔNG khoá ô gõ: từ đúng xanh, gần đúng cam, sai/thiếu thành ô ▢ theo số chữ; sửa rồi kiểm tra lại; 100% tự sang câu.
//   - Gợi ý (Tab) mở từ kế tiếp; Xem đáp án mở cả câu; Ctrl+←/→ câu trước/sau.
//   - Người mới (mặc định ở cấp 1–2): khung chữ cái đầu, chế độ "Chỉ điền từ khoá", bấm từ để tra & lưu.
//   - Tiến độ lưu IndexedDB (kv `dict:<bài>`), mở lại tiếp tục; xong thì tổng kết + ghi Lịch sử.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Eye, Lightbulb, Mic, Play, RefreshCw, Repeat, Snail, Turtle, Wand2 } from 'lucide-react';
import { addAttempt, addLog, getKv, resolveUrl, setKv, useDb } from '../db';
import { touchStreak, updateSettings, useSettings } from '../store';
import { speak, stopSpeak } from '../lib/tts';
import { fmtTime, isKeyword } from '../lib/text';
import { bare, check, displayWords, findLesson, frame, LEVEL_NAMES, type CheckResult, type DSentence, type Lesson, lessonsOf, type WordMark } from '../lib/dictation';
import WordPopover, { Clickable, type WordSel } from '../components/WordPopover';
import { stopAudio } from '../components/AudioPlayer';
import { SKILL_META } from './SkillList';
import { fromDictation } from '../lib/bridge';

/** Kết quả một câu. */
export interface SentRes { score: number; hint: number; shown: boolean; plays: number; logged?: boolean }
/** Tiến độ một bài – kv `dict:<lessonId>`. */
export interface DictProgress {
  i: number;
  typed: string[];
  res: (SentRes | null)[];
  /** Thứ tự câu đang luyện (luyện lại câu sai = một phần). */
  order?: number[];
  plays: number;
  hints: number;
  ms: number;
  startedAt: number;
  updatedAt: number;
  done?: boolean;
  /** Bài cấp 1 sinh ngẫu nhiên: giữ lại câu để mở lại thấy đúng bộ cũ. */
  sents?: DSentence[];
  title?: string;
  level?: number;
}
export const progressKey = (id: string) => `dict:${id}`;
export const getProgress = (id: string) => getKv<DictProgress>(progressKey(id));
export const lessonScore = (p: DictProgress) => { const r = p.res.filter(Boolean) as SentRes[]; return r.length ? r.reduce((a, x) => a + (x.shown ? 0 : x.score), 0) / r.length : 0; };
const PAD = 0.3;

/** Phát một đoạn audio [s, e) bằng thẻ <audio> riêng (tự chủ tốc độ, biết lúc phát xong). */
function useClip(url?: string) {
  const el = useRef<HTMLAudioElement | null>(null);
  const token = useRef(0);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { let on = true; if (url) resolveUrl(url).then((u) => on && setSrc(u)); return () => { on = false; }; }, [url]);
  useEffect(() => {
    if (!src) return;
    const a = new Audio(src); a.preload = 'auto'; el.current = a;
    return () => { a.pause(); token.current++; el.current = null; };
  }, [src]);
  const play = (s: number, e: number, rate: number) => new Promise<void>((resolve) => {
    const a = el.current; if (!a) return resolve();
    stopAudio();
    const my = ++token.current;
    const go = () => {
      a.currentTime = Math.max(0, s); a.playbackRate = rate;
      a.play().catch(() => resolve());
      const tick = () => {
        if (my !== token.current) return resolve();
        if (a.paused || a.ended || a.currentTime >= e) { if (my === token.current) a.pause(); return resolve(); }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
  });
  const stop = () => { token.current++; el.current?.pause(); };
  return { ready: !!src, play, stop, el };
}

/** Câu → các từ khoá cần gõ (chế độ "Chỉ điền từ khoá"): 1–3 từ nội dung dài nhất, số/tên riêng ưu tiên. */
function keywordIdx(text: string) {
  const w = displayWords(text);
  const score = (x: string) => { const b = bare(x); return /\d/.test(b) ? 100 : isKeyword(b) ? b.length + (/^[A-Z]/.test(b) ? 3 : 0) : -1; };
  const cand = w.map((x, k) => [k, score(x)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const n = Math.max(1, Math.min(3, Math.round(w.length / 5)));
  return cand.slice(0, n).map(([k]) => k).sort((a, b) => a - b);
}

export default function DictLesson() {
  const { lid = '' } = useParams();
  const id = decodeURIComponent(lid);
  const db = useDb();
  const [ver, setVer] = useState(0);
  const saved = getProgress(id);
  const lesson = useMemo<Lesson | undefined>(() => {
    const l = findLesson(db.materials, id);
    if (l && id.startsWith('gen:') && saved?.sents?.length) return { ...l, sentences: saved.sents };
    return l;
  }, [id, db.materials, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!lesson) return <div className="page"><p className="empty">Không tìm thấy bài nghe-chép. <Link to="/dictation">Về danh sách</Link></p></div>;
  return <Runner key={`${id}:${ver}`} lesson={lesson} onNew={() => { setKv(progressKey(id), undefined); setVer((v) => v + 1); }} />;
}

/** Route cũ `#/listening/:id/dictation` → bài tương ứng (bài đang dở, hoặc bài đầu chưa xong). */
export function DictRedirect() {
  const { id = '' } = useParams();
  const db = useDb();
  const m = db.materials[id];
  if (!m) return <Navigate to="/dictation" replace />;
  const ls = lessonsOf(m).filter((l) => l.level >= 3);
  const pick = ls.find((l) => { const p = getProgress(l.id); return p && !p.done; }) ?? ls.find((l) => !getProgress(l.id)?.done) ?? ls[0];
  return <Navigate to={pick ? `/dictation/${encodeURIComponent(pick.id)}` : '/dictation'} replace />;
}

function fresh(lesson: Lesson): DictProgress {
  const n = lesson.sentences.length;
  return { i: 0, typed: new Array(n).fill(''), res: new Array(n).fill(null), plays: 0, hints: 0, ms: 0, startedAt: Date.now(), updatedAt: Date.now(), title: `${lesson.title}${lesson.part ? ` · ${lesson.part}` : ''}`, level: lesson.level, sents: lesson.id.startsWith('gen:') ? lesson.sentences : undefined };
}

function Runner({ lesson, onNew }: { lesson: Lesson; onNew: () => void }) {
  const nav = useNavigate();
  const s = useSettings();
  const db = useDb();
  const S = lesson.sentences;
  const [P, setP] = useState<DictProgress>(() => {
    const p = getProgress(lesson.id);
    return p && p.res.length === S.length ? p : fresh(lesson);
  });
  const [checked, setChecked] = useState<CheckResult | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [showAns, setShowAns] = useState(false);
  const [sentPlays, setSentPlays] = useState(0);
  const [wide, setWide] = useState(false);
  const [slow, setSlow] = useState(false);
  const [support, setSupport] = useState(s.dictSupport && lesson.level <= 2);
  const [kwMode, setKwMode] = useState(false);
  const [sel, setSel] = useState<WordSel | null>(null);
  const [shadow, setShadow] = useState<number | null>(null); // shadowing cả đoạn: câu đang phát
  const input = useRef<HTMLTextAreaElement>(null);
  const clip = useClip(lesson.audio);
  const sentStart = useRef(Date.now());
  const advanceT = useRef<number>(0);
  const order = P.order ?? S.map((_, k) => k);
  const pos = Math.max(0, order.indexOf(P.i));
  const u = S[P.i];
  const typed = P.typed[P.i] ?? '';
  const kws = useMemo(() => (u ? keywordIdx(u.text) : []), [u]);
  const target = kwMode ? kws.map((k) => displayWords(u.text)[k]).join(' ') : u?.text ?? '';
  const isGen = lesson.level === 1;
  const rate = isGen ? (slow ? Math.min(s.dictRate, 0.7) : s.dictRate) : slow ? 0.75 : 1;

  // lưu tiến độ (gộp ghi)
  const saveT = useRef<number>(0);
  const commit = (next: DictProgress) => {
    setP(next);
    clearTimeout(saveT.current);
    saveT.current = window.setTimeout(() => { setKv(progressKey(lesson.id), { ...next, updatedAt: Date.now() }); setKv('dict:last', lesson.id); }, 250);
  };
  useEffect(() => () => { clearTimeout(saveT.current); clearTimeout(advanceT.current); clip.stop(); stopSpeak(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playOnce = async (k = P.i) => {
    const x = S[k]; if (!x) return;
    if (lesson.audio && x.start != null && x.end != null) {
      const d = wide ? 1 : 0;
      await clip.play(x.start - PAD - d, x.end + PAD + d, rate);
    } else await speak(x.say ?? x.text, { rate, voice: 'en-GB' });
  };
  const playing = useRef(0);
  const play = async () => {
    const my = ++playing.current;
    setSentPlays((n) => n + 1);
    commit({ ...P, plays: P.plays + 1 });
    await playOnce();
    for (let r = 0; r < s.dictAutoReplay && my === playing.current; r++) {
      await new Promise((ok) => setTimeout(ok, 700));
      if (my !== playing.current) return;
      await playOnce();
    }
  };
  const stopPlay = () => { playing.current++; clip.stop(); stopSpeak(); };

  // vào câu mới → reset & tự phát
  useEffect(() => {
    if (P.done) return;
    setChecked(null); setShowAns(false); setSentPlays(0); sentStart.current = Date.now();
    const t = setTimeout(() => { play(); input.current?.focus(); }, lesson.audio && !clip.ready ? 700 : 250);
    return () => clearTimeout(t);
  }, [P.i, P.done, kwMode, clip.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const setTyped = (v: string) => { const t = [...P.typed]; t[P.i] = v; commit({ ...P, typed: t }); };
  const elapsed = () => Math.min(5 * 60_000, Date.now() - sentStart.current);

  const doCheck = () => {
    if (!u || P.done) return;
    const r = check(target, typed);
    setChecked(r);
    touchStreak();
    const prev = P.res[P.i];
    const res = [...P.res];
    res[P.i] = { score: r.score, hint: prev?.hint ?? 0, shown: (prev?.shown ?? false) || showAns, plays: sentPlays, logged: prev?.logged };
    const next = { ...P, res };
    commit(next);
    if (r.score >= 1) { clearTimeout(advanceT.current); advanceT.current = window.setTimeout(() => go(1, next), 900); }
  };
  /** Ghi nhật ký câu (một lần) khi rời câu. */
  const logSent = (p: DictProgress, k: number) => {
    const r = p.res[k];
    if (!r || r.logged) return p;
    addLog({ kind: 'dictation', ok: !r.shown && r.score >= 0.9, score: r.shown ? 0 : r.score, hint: r.hint > 0 || r.shown, ms: elapsed(), xp: r.shown ? 0 : r.score >= 0.9 ? 2 : 1 });
    fromDictation(lesson, S[k], p.typed[k] ?? '', r).then((w) => w.length && setAdded((x) => [...new Set([...x, ...w])])).catch(() => {});
    const res = [...p.res]; res[k] = { ...r, logged: true };
    return { ...p, res };
  };
  const go = async (d: number, base = P) => {
    clearTimeout(advanceT.current);
    stopPlay();
    let p = logSent({ ...base, ms: base.ms + elapsed() }, base.i);
    const np = pos + d;
    if (np < 0) return;
    if (np >= order.length) { await finish(p); return; }
    p = { ...p, i: order[np] };
    commit(p);
  };
  const finish = async (p: DictProgress) => {
    const done = { ...p, done: true };
    commit(done);
    const score = lessonScore(done);
    const wrong = done.res.map((r, k) => (!r || r.shown || r.score < 0.9 ? k : -1)).filter((k) => k >= 0);
    await addAttempt({ materialId: lesson.materialId ?? lesson.id, skill: 'listening', title: `Nghe-chép · ${done.title ?? lesson.title}`, mode: 'dictation', score: Math.round(score * 100), max: 100, detail: { lesson: lesson.id, level: lesson.level, sentences: S.length, wrong, plays: done.plays, hints: done.hints, ms: done.ms } });
  };
  const hint = () => {
    if (!u) return;
    // mở từ kế tiếp: giữ phần đã đúng liền từ đầu + thêm một từ
    const r = check(target, typed);
    const w = displayWords(target);
    let k = 0; while (k < w.length && r.marks[k] === 'ok') k++;
    if (k >= w.length) return;
    const t = [...P.typed]; t[P.i] = `${w.slice(0, k + 1).join(' ')} `;
    const res = [...P.res]; const prev = res[P.i];
    res[P.i] = { score: prev?.score ?? 0, hint: (prev?.hint ?? 0) + 1, shown: prev?.shown ?? false, plays: sentPlays, logged: prev?.logged };
    commit({ ...P, typed: t, hints: P.hints + 1, res });
    setChecked(null);
    requestAnimationFrame(() => { const el = input.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  };
  const reveal = () => {
    setShowAns(true);
    const res = [...P.res]; const prev = res[P.i];
    res[P.i] = { score: prev?.score ?? 0, hint: prev?.hint ?? 0, shown: true, plays: sentPlays, logged: prev?.logged };
    commit({ ...P, res });
  };

  // phím tắt: Enter kiểm tra · Ctrl (nhấn-thả) nghe lại · Tab gợi ý · Ctrl+←/→ câu trước/sau
  const ctrlTap = useRef(false);
  useEffect(() => {
    if (P.done) return;
    const down = (e: KeyboardEvent) => {
      if (sel) return;
      if (e.key === 'Control') { ctrlTap.current = true; return; }
      ctrlTap.current = false;
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); doCheck(); }
      else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); hint(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); play(); }
    };
    const up = (e: KeyboardEvent) => { if (e.key === 'Control' && ctrlTap.current) { ctrlTap.current = false; play(); } };
    document.addEventListener('keydown', down); document.addEventListener('keyup', up);
    return () => { document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); };
  });

  const restart = (only?: number[]) => {
    stopPlay();
    const base = only ? { ...P } : fresh(lesson);
    if (only) {
      const res = [...P.res], t = [...P.typed];
      for (const k of only) { res[k] = null; t[k] = ''; }
      Object.assign(base, { res, typed: t, order: only, i: only[0], done: false, startedAt: Date.now() });
    }
    commit(base);
  };

  const done = P.res.filter(Boolean) as SentRes[];
  const avg = done.length ? done.reduce((a, r) => a + (r.shown ? 0 : r.score), 0) / done.length : null;
  const back = lesson.materialId ? `/dictation?m=${lesson.materialId}` : '/dictation';
  const style = { ['--skill' as string]: SKILL_META.listening.color };

  if (P.done) return <Summary lesson={lesson} P={P} added={added} onNew={onNew} onRetry={restart} onShadow={setShadow} shadow={shadow} clip={clip} back={back} attempts={db.attempts} />;
  if (!u) return null;

  const words = displayWords(u.text);
  const kwSet = new Set(kws);
  const marksFor = (k: number): WordMark | undefined => {
    if (!checked) return undefined;
    if (!kwMode) return checked.marks[k];
    const j = kws.indexOf(k);
    return j < 0 ? undefined : checked.marks[j];
  };
  const box = (w: string) => <span className="dl-box" aria-label={`${bare(w).length} chữ`}>{bare(w).replace(/./g, '▢')}</span>;
  const score = P.res[P.i];

  return (
    <div className="page page--practice dl" style={style}>
      <div className="topbar topbar--sticky">
        <button className="icon-btn" onClick={() => nav(back)} aria-label="Quay lại"><ArrowLeft size={20} /></button>
        <div className="topbar__title"><small>Nghe-chép · cấp {lesson.level} {LEVEL_NAMES[lesson.level]} · câu {pos + 1}/{order.length}</small><strong>{lesson.title}{lesson.part && !isGen ? ` · ${lesson.part}` : ''}</strong></div>
        <div className="topbar__actions"><span className="badge badge--ok" data-testid="dl-acc">Đúng {avg == null ? '—' : `${Math.round(avg * 100)}%`}</span></div>
        <div className="topbar__progress" style={{ width: `${(pos / order.length) * 100}%` }} />
      </div>

      <div className="dl-card card">
        <div className="dl-play">
          <button className="dl-play__big" onClick={play} aria-label="Nghe lại" title="Nghe lại (Ctrl)"><Play size={30} fill="currentColor" /></button>
          <div className="dl-play__meta">
            <div className="small muted">{u.speaker && !isGen ? <strong>{u.speaker} · </strong> : null}<span data-testid="dl-plays">Đã nghe {sentPlays} lần</span> · {words.length} từ{!lesson.audio && !isGen ? ' · giọng máy' : ''}</div>
            <div className="dl-play__opts">
              <button className={`chip${slow ? ' is-on' : ''}`} onClick={() => setSlow(!slow)} title="Phát 0.75×"><Turtle size={14} /> Nghe chậm</button>
              {lesson.audio && <button className={`chip${wide ? ' is-on' : ''}`} onClick={() => setWide(!wide)} title="Mốc câu lệch? Phát rộng thêm 1 giây mỗi đầu">Nghe rộng hơn ±1 s</button>}
              <button className="chip" onClick={() => updateSettings({ dictAutoReplay: (s.dictAutoReplay + 1) % 4 })} title="Tự nghe lại sau mỗi lần phát"><Repeat size={14} /> Tự lặp {s.dictAutoReplay ? `${s.dictAutoReplay}×` : 'tắt'}</button>
            </div>
          </div>
        </div>
        {isGen && lesson.part && <p className="small muted">{lesson.part}</p>}

        {(support || kwMode) && (
          <div className="dl-frame" aria-label="Khung câu">
            {kwMode
              ? words.map((w, k) => <span key={k}>{kwSet.has(k) ? <span className="dl-blank">{support ? frame(w) : bare(w).replace(/./g, '_')}</span> : w} </span>)
              : <span className="mono">{frame(u.text)}</span>}
          </div>
        )}
        {showAns && <p className="dict__hint dict__hint--full" data-testid="dl-answer"><Clickable text={u.text} onWord={setSel} /></p>}

        <textarea ref={input} className={`textarea dl-input${checked ? (checked.score >= 1 ? ' is-correct' : checked.score >= 0.6 ? ' is-mid' : ' is-wrong') : ''}`} rows={2}
          value={typed} onChange={(e) => setTyped(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off"
          placeholder={kwMode ? 'Gõ các từ còn trống, cách nhau bằng dấu cách…' : 'Gõ những gì bạn nghe được…'} aria-label="Bản chép" />

        {checked && (
          <div className="dl-result" data-testid="dl-result">
            <div className={checked.score >= 0.9 ? 'ok-text' : checked.score >= 0.6 ? 'mid-text' : 'no-text'}><strong>{Math.round(checked.score * 100)}%</strong>{checked.score >= 1 ? ' – chính xác!' : ' – sửa chỗ sai rồi kiểm tra lại (Enter)'}</div>
            <p className="dl-marked">
              {words.map((w, k) => {
                const mk = marksFor(k);
                if (mk === undefined) return <span key={k} className="dl-w">{w} </span>;
                if (mk === 'ok') return <span key={k} className="dl-w dl-w--ok">{w} </span>;
                if (mk === 'near') return <span key={k} className="dl-w dl-w--near" title="gần đúng – sai một chữ cái">{w} </span>;
                return <span key={k} className="dl-w dl-w--miss">{showAns ? w : box(w)} </span>;
              })}
            </p>
          </div>
        )}
        {score?.hint ? <p className="small muted">Đã dùng gợi ý {score.hint} lần</p> : null}
      </div>

      <div className="dl-tools">
        <button className={`chip${support ? ' is-on' : ''}`} onClick={() => setSupport(!support)} title="Hiện chữ cái đầu mỗi từ"><Wand2 size={14} /> Khung chữ cái đầu</button>
        <button className={`chip${kwMode ? ' is-on' : ''}`} onClick={() => { setKwMode(!kwMode); setChecked(null); }} title="Chỉ cần gõ 1–3 từ khoá">Chỉ điền từ khoá</button>
        {!showAns && <button className="chip" onClick={reveal}><Eye size={14} /> Xem đáp án</button>}
        {showAns && <span className="small muted">Bấm vào từ để tra & lưu</span>}
      </div>
      <p className="muted small dl-keys">Phím tắt: <kbd>Enter</kbd> kiểm tra · <kbd>Ctrl</kbd> nghe lại · <kbd>Tab</kbd> gợi ý một từ · <kbd>Ctrl</kbd>+<kbd>←</kbd>/<kbd>→</kbd> câu trước/sau</p>
      <div className="dict__dots">{order.map((k, j) => { const r = P.res[k]; return <span key={k} className={`dot-s${r ? (!r.shown && r.score >= 0.9 ? ' is-ok' : ' is-no') : ''}${k === P.i ? ' is-cur' : ''}`} onClick={() => go(j - pos)} />; })}</div>

      <div className="dl-bar">
        <button className="btn btn--ghost dl-bar__nav" onClick={() => go(-1)} disabled={pos === 0} aria-label="Câu trước"><ChevronLeft size={20} /></button>
        <button className="btn btn--ghost" onClick={play}><RefreshCw size={16} /> Nghe lại</button>
        <button className="btn btn--ghost" onClick={hint}><Lightbulb size={16} /> Gợi ý</button>
        <button className="btn btn--primary" onClick={doCheck}><Check size={18} /> Kiểm tra</button>
        <button className="btn btn--ghost dl-bar__nav" onClick={() => go(1)} aria-label={pos + 1 >= order.length ? 'Hoàn thành' : 'Câu sau'}>{pos + 1 >= order.length ? <Check size={20} /> : <ChevronRight size={20} />}</button>
      </div>
      {sel && <WordPopover sel={sel} from={lesson.materialId} onClose={() => setSel(null)} />}
    </div>
  );
}

function Summary({ lesson, P, added, onNew, onRetry, onShadow, shadow, clip, back, attempts }: {
  lesson: Lesson; P: DictProgress; onNew: () => void; onRetry: (only?: number[]) => void; onShadow: (k: number | null) => void; shadow: number | null;
  clip: ReturnType<typeof useClip>; back: string; attempts: ReturnType<typeof useDb>['attempts']; added: string[];
}) {
  const nav = useNavigate();
  const S = lesson.sentences;
  const order = P.order ?? S.map((_, k) => k);
  const score = lessonScore(P);
  const wrong = order.filter((k) => { const r = P.res[k]; return !r || r.shown || r.score < 0.9; });
  // gợi ý lên cấp: 3 bài liền ở cấp này ≥ 90%
  const recent = attempts.filter((a) => a.mode === 'dictation' && (a.detail as { level?: number } | undefined)?.level === lesson.level).sort((a, b) => b.at - a.at).slice(0, 3);
  const levelUp = lesson.level < 4 && recent.length >= 3 && recent.every((a) => (a.score ?? 0) >= 90);
  const stopRef = useRef(0);
  const shadowAll = async () => {
    const my = ++stopRef.current;
    for (const k of order) {
      if (my !== stopRef.current) return;
      onShadow(k);
      const x = S[k];
      if (lesson.audio && x.start != null && x.end != null) await clip.play(x.start - PAD, x.end + PAD, 1);
      else await speak(x.say ?? x.text, { voice: 'en-GB' });
      await new Promise((ok) => setTimeout(ok, 1500 + x.text.length * 40)); // khoảng lặng để nhại theo
    }
    onShadow(null);
  };
  const stopShadow = () => { stopRef.current++; clip.stop(); stopSpeak(); onShadow(null); };
  useEffect(() => () => { stopRef.current++; }, []);
  return (
    <div className="page dl dl-sum" style={{ ['--skill' as string]: SKILL_META.listening.color }}>
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(back)} aria-label="Quay lại"><ArrowLeft size={20} /></button>
        <div className="topbar__title"><small>Tổng kết nghe-chép</small><strong>{lesson.title}{lesson.part && lesson.level > 1 ? ` · ${lesson.part}` : ''}</strong></div>
      </div>
      <div className="dl-stats card" data-testid="dl-summary">
        <div><strong>{Math.round(score * 100)}%</strong><span>đúng</span></div>
        <div><strong>{fmtTime(P.ms / 1000)}</strong><span>thời gian</span></div>
        <div><strong>{P.plays}</strong><span>lượt nghe</span></div>
        <div><strong>{P.hints}</strong><span>gợi ý</span></div>
      </div>
      {levelUp && <p className="dl-levelup card">🎉 Ba bài liền ≥ 90% ở cấp {lesson.level}. Thử <Link to={`/dictation?level=${lesson.level + 1}`}>cấp {lesson.level + 1} – {LEVEL_NAMES[lesson.level + 1]}</Link>?</p>}
      <div className="row wrap">
        {wrong.length > 0 && <button className="btn btn--primary" onClick={() => onRetry(wrong)}><RefreshCw size={16} /> Luyện lại {wrong.length} câu sai</button>}
        {shadow == null ? <button className="btn btn--ghost" onClick={shadowAll}><Mic size={16} /> Shadowing cả đoạn</button> : <button className="btn btn--ghost" onClick={stopShadow}><Snail size={16} /> Dừng shadowing</button>}
        <button className="btn btn--ghost" onClick={() => onRetry()}><Repeat size={16} /> {lesson.level === 1 ? 'Làm lại bộ này' : 'Làm lại cả bài'}</button>
        {lesson.level === 1 && <button className="btn btn--ghost" onClick={onNew}><RefreshCw size={16} /> Bộ số mới</button>}
        <button className="btn btn--text" onClick={() => nav(back)}>Bài khác <ArrowRight size={16} /></button>
      </div>
      {(added.length > 0 || (wrong.length > 0 && lesson.level > 1)) && (
        <p className="dl-saved card small" data-testid="dl-saved">
          {wrong.length > 0 && lesson.level > 1 && <>{wrong.length} câu chưa đạt đã thành thẻ <strong>Câu hay sai</strong> để ôn trong Từ vựng. </>}
          {added.length > 0 && <>Đã thêm vào vốn từ: <strong>{added.join(', ')}</strong>. </>}
          <Link to="/vocab">Mở Từ vựng →</Link>
        </p>
      )}
      {shadow != null && <p className="small muted">Nghe từng câu rồi nói lại theo trong khoảng lặng, bắt chước ngữ điệu và nối âm.</p>}
      <h3 className="section-title">{wrong.length ? `Câu chưa đạt (${wrong.length})` : 'Tất cả các câu đều đạt ≥ 90% 👏'}</h3>
      <ol className="dl-list">
        {order.map((k) => {
          const r = P.res[k];
          const bad = wrong.includes(k);
          if (!bad && shadow == null) return null;
          const c = check(S[k].text, P.typed[k] ?? '');
          return (
            <li key={k} className={`${shadow === k ? 'is-cur' : ''}${bad ? ' is-bad' : ''}`}>
              <p className="dl-marked">{displayWords(S[k].text).map((w, j) => <span key={j} className={`dl-w${bad ? ` dl-w--${c.marks[j]}` : ''}`}>{w} </span>)}</p>
              {bad && <p className="small muted">Bạn gõ: “{P.typed[k] || '—'}” · {r?.shown ? 'đã xem đáp án' : `${Math.round((r?.score ?? 0) * 100)}%`}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
