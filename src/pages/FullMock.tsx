// Thi thử đủ 4 kỹ năng (#/mock/full): Listening → Reading → Writing liền nhau như ngày thi, rồi Speaking (ngay hoặc trong 7 ngày).
// - Bài đang làm lưu ở kv `fullmock:cur` (mỗi lần đổi + mỗi 10 giây + khi đóng trang). Mở lại → vào đúng phần đang làm,
//   đồng hồ tính theo giờ thật (phần đã hết giờ thì tự chuyển tiếp, phần sau bắt đầu từ lúc phần trước hết giờ).
// - Hết Writing → tạo MỘT bản ghi lịch sử mode 'full-mock'; Speaking xong cập nhật vào bản ghi đó.
// - ?fast=1: rút mọi thời lượng xuống vài giây (smoke test).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bot, Check, CalendarClock, Clock, Download, Headphones, Loader2, Mic, Play, Printer, Shuffle, SkipForward } from 'lucide-react';
import type { Attempt, ListeningMaterial, Material, ReadingMaterial, SpeakingMaterial, WritingMaterial } from '../types';
import { addAttempt, getKv, getState, resolveUrl, saveBlob, setKv, updateAttempt, useDb } from '../db';
import { aiReady, getAiConfig, touchStreak, useAiConfig, useSettings } from '../store';
import { GroupsView, scoreGroups, type Answers } from '../components/Questions';
import { ExamClock, ExamFrame, ExamIntro, ExamNav, ExamSplit, answeredNos, focusQuestion, groupNos, useExamPrefs } from '../components/Exam';
import { HighlightBar, HlText, addHls, colorMap, removeHls, type Hl, type HlColor, type HlSel } from '../components/Highlight';
import Recorder, { type Recording } from '../components/Recorder';
import SelfCheck from '../components/SelfCheck';
import { AiMissing } from '../components/AiGuide';
import { Collapse } from '../components/ui';
import { SpeakingGradeView, WritingGradeView } from '../components/GradeViews';
import type { WritingGrade } from '../ai/writing';
import type { SpeakingGrade } from '../ai/speaking';
import { paragraphs, paraLabel, shuffle, wordCount } from '../lib/text';
import { fmtBand, overallBand, rawToBand } from '../lib/band';
import { groupByTest, parseId, testName } from '../lib/tests';
import { speak, stopSpeak } from '../lib/tts';
import { downloadBackup } from '../lib/backup';
import { speakLines } from './ListeningTest';
import { TaskPrompt } from './Writing';
import { bareTitle } from './MockTest';
import { BlobAudio, RLPartView } from './HistoryDetail';

const KEY = 'fullmock:cur';
type Stage = 'intro' | 'listening' | 'trans-r' | 'reading' | 'trans-w' | 'writing' | 'trans-s' | 'speaking';
type Mod = 'academic' | 'general';
interface SpTurn { part: 1 | 2 | 3; question: string; answer: string; seconds?: number; audio?: string }
interface Cur {
  v: 1; fast?: boolean; module: Mod; test: string; testLabel: string;
  ids: { l: string[]; r: string[]; w: string[]; s: string };
  stage: Stage; stageAt: number; startedAt: number;
  answers: Record<string, Answers>; essays: Record<1 | 2, string>;
  /** Listening: section đang phát, vị trí (giây) và lúc ghi. */
  lis?: { sec: number; pos: number; at: number };
  /** Lúc bắt đầu 2 phút kiểm tra sau audio. */
  reviewAt?: number;
  times: Partial<Record<'l' | 'r' | 'w' | 's', number>>;
  aid?: string;
  /** Hạn làm Speaking (khi chọn "làm sau"). */
  until?: number;
  sp?: { i: number; turns: (SpTurn | null)[]; p1At?: number };
}
interface PartRes { score: number; max: number; band: number; parts: { id: string; title: string; answers: Answers; score: number; max: number; wrong: number[] }[] }
export interface FullDetail {
  v: 1; module: Mod; test: string; testLabel: string; ids: Cur['ids']; times: Cur['times'];
  l: PartRes; r: PartRes;
  w: { texts: Record<1 | 2, string>; words: Record<1 | 2, number>; grades?: Partial<Record<1 | 2, WritingGrade>>; self?: Partial<Record<1 | 2, number>>; band?: number };
  s?: { turns?: SpTurn[]; grades?: Partial<Record<1 | 2 | 3, SpeakingGrade>>; self?: number; band?: number; skipped?: boolean; until?: number };
  overall?: number;
}

const DUR = { trans: 60, reading: 3600, writing: 3600, review: 120 };
const FAST = { trans: 2, reading: 40, writing: 40, review: 3 };
const dur = (c: Cur) => (c.fast ? FAST : DUR);
const NEXT: Record<Stage, Stage> = { intro: 'listening', listening: 'trans-r', 'trans-r': 'reading', reading: 'trans-w', 'trans-w': 'writing', writing: 'trans-s', 'trans-s': 'speaking', speaking: 'speaking' };
const TIME_KEY: Partial<Record<Stage, 'l' | 'r' | 'w'>> = { listening: 'l', reading: 'r', writing: 'w' };
const round5 = (x: number) => Math.round(x * 2) / 2;

/** Hạn của phần đang làm (ms) – null nếu phần đó không tính giờ cố định. */
function deadline(c: Cur): number | null {
  const d = dur(c);
  switch (c.stage) {
    case 'listening': return c.reviewAt ? c.reviewAt + d.review * 1000 : null;
    case 'trans-r': case 'trans-w': return c.stageAt + d.trans * 1000;
    case 'reading': return c.stageAt + d.reading * 1000;
    case 'writing': return c.stageAt + d.writing * 1000;
    default: return null;
  }
}
function moveTo(c: Cur, next: Stage, at: number): Cur {
  const k = TIME_KEY[c.stage];
  const times = k ? { ...c.times, [k]: Math.round((at - c.stageAt) / 1000) } : c.times;
  return { ...c, stage: next, stageAt: at, times };
}
/** Đã quá hạn phần nào thì chuyển tiếp (phần sau bắt đầu đúng lúc phần trước hết giờ). */
function catchUp(c: Cur, now = Date.now()): Cur {
  for (let n = 0; n < 8; n++) {
    const dl = deadline(c);
    if (dl == null || now < dl) return c;
    c = moveTo(c, NEXT[c.stage], dl);
  }
  return c;
}

// ---------- Ghép đề ----------
export function fullTests(materials: Record<string, Material>) {
  const all = Object.values(materials);
  const L = groupByTest(all, 'listening').tests, R = groupByTest(all, 'reading').tests;
  const out: { key: string; vol: number; test: number; l: string[]; r: string[] }[] = [];
  for (const [k, t] of L) {
    const r = R.get(k);
    const l = t.parts.filter((m) => (m as ListeningMaterial).groups.length);
    const rp = r?.parts.filter((m) => (m as ReadingMaterial).groups.length) ?? [];
    if (l.length >= 4 && rp.length >= 3) out.push({ key: k, vol: t.vol, test: t.test, l: l.slice(0, 4).map((m) => m.id), r: rp.slice(0, 3).map((m) => m.id) });
  }
  return out.sort((a, b) => a.vol - b.vol || a.test - b.test);
}
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
function assemble(materials: Record<string, Material>, key: string, module: Mod, fast: boolean): Cur | null {
  const tests = fullTests(materials);
  const t = key === 'random' ? pick(tests) : tests.find((x) => x.key === key);
  if (!t) return null;
  const ws = Object.values(materials).filter((m) => m.skill === 'writing') as WritingMaterial[];
  const own = (task: 1 | 2) => ws.find((m) => parseId(m.id)?.key === t.key && m.task === task);
  const bank = (task: 1 | 2, mod: Mod) => ws.filter((m) => m.task === task && (m.module ?? 'academic') === mod);
  const w1 = module === 'general' ? pick(bank(1, 'general')) : own(1) ?? pick(bank(1, 'academic'));
  const w2 = own(2) ?? pick(bank(2, 'academic'));
  const sp = Object.values(materials).filter((m) => m.skill === 'speaking' && (m as SpeakingMaterial).part1?.length && (m as SpeakingMaterial).part2 && (m as SpeakingMaterial).part3?.questions.length);
  const s = pick(shuffle(sp));
  if (!w1 || !w2 || !s) return null;
  const now = Date.now();
  return {
    v: 1, fast: fast || undefined, module, test: t.key, testLabel: testName(t), ids: { l: t.l, r: t.r, w: [w1.id, w2.id], s: s.id },
    stage: 'intro', stageAt: now, startedAt: now, answers: {}, essays: { 1: '', 2: '' }, times: {},
  };
}

function scorePart(ids: string[], materials: Record<string, Material>, answers: Cur['answers'], skill: 'listening' | 'reading'): PartRes {
  const parts = ids.map((id) => {
    const m = materials[id] as ReadingMaterial | ListeningMaterial | undefined;
    const a = answers[id] ?? {};
    const r = m ? scoreGroups(m.groups, a) : { score: 0, max: 0, wrong: [] };
    return { id, title: m?.title ?? id, answers: a, ...r };
  });
  const score = parts.reduce((n, p) => n + p.score, 0), max = parts.reduce((n, p) => n + p.max, 0);
  // Reading GT dùng đề Academic → quy band theo bảng Academic.
  return { score, max, band: rawToBand(skill, score, max || 40, 'academic'), parts };
}
function overallOf(d: FullDetail) {
  const bs = [d.l?.band, d.r?.band, d.w?.band, d.s?.band];
  return bs.every((b) => typeof b === 'number' && b > 0) ? overallBand(bs as number[]) : undefined;
}

// ---------- Trang chính ----------
export default function FullMock() {
  const db = useDb();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const fastQ = sp.get('fast') === '1';
  const [cur, setCur] = useState<Cur | null>(() => {
    const c = getKv<Cur | null>(KEY);
    if (!c || c.v !== 1) return null;
    if (c.stage === 'trans-s' && c.until && c.until < Date.now()) return null;
    return catchUp(c);
  });
  const ref = useRef(cur); ref.current = cur;
  const save = () => { const c = ref.current; if (c && c.stage !== 'intro') setKv(KEY, c); };
  // Lưu: mỗi lần đổi (gộp 600 ms), mỗi 10 giây, khi đóng trang.
  useEffect(() => { if (!cur || cur.stage === 'intro') return; const t = window.setTimeout(save, 600); return () => window.clearTimeout(t); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = window.setInterval(save, 10_000);
    window.addEventListener('pagehide', save);
    return () => { window.clearInterval(id); window.removeEventListener('pagehide', save); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (getKv(KEY) && !cur) setKv(KEY, null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (next: Stage, at = Date.now()) => setCur((c) => (c ? catchUp(moveTo(c, next, at)) : c));
  const patch = (p: Partial<Cur>) => setCur((c) => (c ? { ...c, ...p } : c));

  // Hết Writing → tạo bản ghi lịch sử (một lần).
  const creating = useRef(false);
  useEffect(() => {
    if (!cur || cur.stage !== 'trans-s' || cur.aid || creating.current) return;
    creating.current = true;
    const c = cur;
    const ms = getState().materials;
    const words = { 1: wordCount(c.essays[1]), 2: wordCount(c.essays[2]) };
    const detail: FullDetail = {
      v: 1, module: c.module, test: c.test, testLabel: c.testLabel, ids: c.ids, times: c.times,
      l: scorePart(c.ids.l, ms, c.answers, 'listening'), r: scorePart(c.ids.r, ms, c.answers, 'reading'),
      w: { texts: c.essays, words },
    };
    touchStreak();
    addAttempt({ materialId: c.test, skill: 'listening', title: `Thi thử 4 kỹ năng · ${c.testLabel}`, mode: 'full-mock', detail })
      .then((a) => { setCur((x) => (x ? { ...x, aid: a.id } : x)); ref.current = ref.current && { ...ref.current, aid: a.id }; save(); })
      .finally(() => { creating.current = false; });
  }, [cur?.stage, cur?.aid]); // eslint-disable-line react-hooks/exhaustive-deps

  const abandon = async () => {
    if (!confirm('Huỷ bài thi này? Phần đã làm sẽ mất (trừ bản ghi đã lưu sau Writing).')) return;
    stopSpeak(); await setKv(KEY, null); setCur(null);
  };
  const leave = () => { save(); nav('/'); };
  const exit = () => { if (confirm('Thoát? Bài thi được lưu, mở lại "Thi thử 4 kỹ năng" để làm tiếp – đồng hồ vẫn chạy.')) leave(); };

  if (!db.ready) return null;
  if (!cur) return <StartPage onStart={(c) => setCur(c)} fast={fastQ} />;
  const ms = db.materials;
  const tools = <button className="xtool" onClick={abandon} title="Huỷ bài thi này">Huỷ bài</button>;

  switch (cur.stage) {
    case 'intro': {
      return <ExamIntro title="IELTS Listening" time="Approximately 30 minutes" sound onExit={() => setCur(null)}
        instructions={['Answer all the questions.', 'You can change your answers at any time during the test.', 'Reading and Writing follow immediately after Listening, without a break.']}
        info={['There are 40 questions in this test.', 'There are four parts to the test.', 'You will hear each part once only.', 'At the end of the test you will have 2 minutes to check your answers.']}
        onStart={() => setCur((c) => (c ? { ...c, stage: 'listening', stageAt: Date.now(), startedAt: Date.now() } : c))} />;
    }
    case 'listening': case 'reading':
      return <QStage key={cur.stage} cur={cur} materials={ms} tools={tools} onExit={exit}
        setAnswer={(id, no, a) => setCur((c) => (c ? { ...c, answers: { ...c.answers, [id]: { ...(c.answers[id] ?? {}), [no]: a } } } : c))}
        onLis={(lis) => patch({ lis })} onReview={(at) => setCur((c) => (c ? catchUp({ ...c, reviewAt: at }) : c))}
        onDone={(at) => go(cur.stage === 'listening' ? 'trans-r' : 'trans-w', at)} />;
    case 'trans-r': case 'trans-w':
      return <Transition key={cur.stage} cur={cur} tools={tools} onExit={exit} onStart={() => go(NEXT[cur.stage])} />;
    case 'writing':
      return <WritingStage cur={cur} materials={ms} tools={tools} onExit={exit}
        onText={(task, v) => setCur((c) => (c ? { ...c, essays: { ...c.essays, [task]: v } } : c))} onDone={(at) => go('trans-s', at)} />;
    case 'trans-s':
      return <SpeakTransition cur={cur} onExit={() => { save(); nav(cur.aid ? `/history/${cur.aid}` : '/'); }}
        onStart={() => setCur((c) => (c ? { ...c, stage: 'speaking', stageAt: Date.now(), sp: c.sp ?? { i: 0, turns: [] } } : c))}
        onLater={async () => {
          if (!cur.aid) return;
          const until = Date.now() + 7 * 864e5;
          const c = { ...cur, until };
          ref.current = c; setCur(c); await setKv(KEY, c);
          await patchDetail(cur.aid, (d) => ({ ...d, s: { ...d.s, skipped: true, until } }));
          nav(`/history/${cur.aid}`);
        }} />;
    case 'speaking':
      return <SpeakingStage cur={cur} m={ms[cur.ids.s] as SpeakingMaterial} tools={tools} onExit={exit}
        onTurn={(spx) => patch({ sp: spx })}
        onDone={async (turns) => {
          const c = ref.current!;
          const secs = Math.round((Date.now() - c.stageAt) / 1000);
          if (c.aid) await patchDetail(c.aid, (d) => ({ ...d, times: { ...d.times, s: secs }, s: { turns } }));
          await setKv(KEY, null);
          const aid = c.aid;
          setCur(null);
          nav(aid ? `/history/${aid}` : '/history');
        }} />;
  }
}

/** Sửa detail của bản ghi (đọc bản mới nhất), tính lại overall + band của bản ghi. */
async function patchDetail(aid: string, f: (d: FullDetail) => FullDetail) {
  const a = getState().attempts.find((x) => x.id === aid);
  if (!a) return;
  const d = f(a.detail as FullDetail);
  const overall = overallOf(d);
  await updateAttempt(aid, { detail: { ...d, overall }, band: overall });
}

// ---------- Màn bắt đầu ----------
function StartPage({ onStart, fast }: { onStart: (c: Cur) => void; fast: boolean }) {
  const db = useDb();
  const nav = useNavigate();
  const st = useSettings();
  const [module, setModule] = useState<Mod>(st.module === 'general' ? 'general' : 'academic');
  const [key, setKey] = useState('random');
  const [err, setErr] = useState('');
  const tests = useMemo(() => fullTests(db.materials), [db.materials]);
  const vols = [...new Set(tests.map((t) => t.vol))];
  const start = () => {
    const c = assemble(db.materials, key, module, fast);
    if (!c) return setErr('Không ghép được đề (thiếu bài Listening/Reading/Writing/Speaking).');
    onStart(c);
  };
  return (
    <div className="page fm-start" style={{ ['--skill' as string]: 'var(--primary)' }}>
      <div className="topbar"><button className="icon-btn" onClick={() => nav(-1)} aria-label="Quay lại"><ArrowLeft size={20} /></button><div className="topbar__title"><small>Thi thử</small><strong>Đủ 4 kỹ năng</strong></div></div>
      <p className="lead">Làm như ngày thi thật: Listening → Reading → Writing liền nhau, không nghỉ; Speaking làm ngay sau đó hoặc trong 7 ngày. Khoảng 2 giờ 40 phút + Speaking 11–14 phút.</p>
      <section className="card pad stack">
        <h2 className="h3">1. Hình thức</h2>
        <div className="seg" role="radiogroup">
          {(['academic', 'general'] as Mod[]).map((x) => <button key={x} role="radio" aria-checked={module === x} className={`seg__btn${module === x ? ' is-selected' : ''}`} onClick={() => setModule(x)}>{x === 'academic' ? 'Academic' : 'General Training'}</button>)}
        </div>
        {module === 'general' && <p className="small muted">Kho chưa có đề Reading GT → phần Reading dùng đề Academic (quy band theo bảng Academic). Writing Task 1 là viết thư.</p>}
        <h2 className="h3">2. Đề</h2>
        <div className="row wrap">
          <select className="select" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Chọn đề" data-testid="fm-test">
            <option value="random">Ngẫu nhiên ({tests.length} đề)</option>
            {vols.map((v) => <optgroup key={v} label={`VOL ${v}`}>{tests.filter((t) => t.vol === v).map((t) => <option key={t.key} value={t.key}>VOL {t.vol} · Test {t.test}</option>)}</optgroup>)}
          </select>
          {key !== 'random' && <button className="btn btn--text btn--sm" onClick={() => setKey('random')}><Shuffle size={15} /> Ngẫu nhiên</button>}
        </div>
        <p className="small muted">Listening + Reading cùng một đề gốc. Writing lấy Task 1/2 của đề đó, đề nào thiếu thì lấy ngẫu nhiên từ kho Writing. Speaking: một bộ đề dự đoán.</p>
      </section>
      <section className="card pad stack">
        <h2 className="h3">Thứ tự và thời gian</h2>
        <table className="table fm-plan"><tbody>
          <tr><td><Headphones size={15} /> Listening</td><td>~30 phút + 2 phút kiểm tra</td><td className="small muted">Audio phát một lần, không dừng/tua</td></tr>
          <tr><td>Reading</td><td>60 phút</td><td className="small muted">3 passage, 40 câu</td></tr>
          <tr><td>Writing</td><td>60 phút</td><td className="small muted">Task 1 (~20′) + Task 2 (~40′), chuyển task ở thanh dưới</td></tr>
          <tr><td><Mic size={15} /> Speaking</td><td>11–14 phút</td><td className="small muted">Giám khảo đọc câu hỏi, bạn ghi âm</td></tr>
        </tbody></table>
      </section>
      <section className="card pad stack">
        <h2 className="h3">Quy định phòng thi</h2>
        <ul className="small fm-rules">
          <li>Không có từ điển, gợi ý, dịch hay AI trong lúc thi; không tạm dừng.</li>
          <li>Hết giờ phần nào tự chuyển phần đó; màn chuyển tiếp chờ tối đa 60 giây.</li>
          <li>Nộp sớm được (có hỏi lại). Đã sang phần sau thì không quay lại phần trước.</li>
          <li>Bài được lưu liên tục: lỡ tắt trình duyệt thì mở lại trang này để làm tiếp, đồng hồ tính theo giờ thật.</li>
          <li>Đeo tai nghe, tìm chỗ yên tĩnh, cho phép micro khi làm Speaking.</li>
        </ul>
        {err && <p className="no-text small">{err}</p>}
      </section>
      <div className="actionbar"><div className="actionbar__inner"><span className="result"><Clock size={15} /> ~2 giờ 40 phút</span><button className="btn btn--primary" onClick={start} disabled={!tests.length} data-testid="fm-start"><Play size={18} /> Bắt đầu</button></div></div>
    </div>
  );
}

// ---------- Listening / Reading ----------
function QStage({ cur, materials, tools, onExit, setAnswer, onLis, onReview, onDone }: {
  cur: Cur; materials: Record<string, Material>; tools: React.ReactNode; onExit: () => void;
  setAnswer: (id: string, no: number, a: Answers[number]) => void;
  onLis: (l: Cur['lis']) => void; onReview: (at: number) => void; onDone: (at: number) => void;
}) {
  const isR = cur.stage === 'reading';
  const sel = (isR ? cur.ids.r : cur.ids.l).map((id) => materials[id] as ReadingMaterial | ListeningMaterial).filter(Boolean);
  const [p, setP] = useState(isR ? 0 : cur.lis?.sec ?? 0);
  const [curNo, setCurNo] = useState<number | null>(null);
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [hls, setHls] = useState<Record<string, Hl[]>>({});
  const d = dur(cur);
  // Giây còn lại tính một lần khi mở phần (đồng hồ tự đếm từ lúc mount).
  const [left] = useState(() => (isR ? Math.max(0, (cur.stageAt + d.reading * 1000 - Date.now()) / 1000) : 0));
  const reviewLeft = cur.reviewAt ? Math.max(0, (cur.reviewAt + d.review * 1000 - Date.now()) / 1000) : 0;
  const audio = useMockAudio(isR ? [] : (sel as ListeningMaterial[]), !!cur.fast, (i) => { setP(i); setCurNo(null); }, (over) => onReview(Date.now() - over * 1000), onLis);
  useEffect(() => { if (!isR && !cur.reviewAt) { const l = cur.lis; audio.start(l?.sec ?? 0, l ? l.pos + (Date.now() - l.at) / 1000 : 0); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const m = sel[p];
  if (!m) return null;
  const parts = sel.map((x, i) => ({ label: `Part ${i + 1}`, nos: groupNos(x.groups) }));
  const answered = sel.map((x) => answeredNos(x.groups, cur.answers[x.id] ?? {}));
  const nos = parts[p].nos;
  const range = nos.length ? `${nos[0]}–${nos[nos.length - 1]}` : '';
  const goNo = (no: number, pi: number) => { if (pi !== p) setP(pi); setCurNo(no); window.setTimeout(() => focusQuestion(no), pi !== p ? 60 : 0); };
  const trackFocus = (e: React.SyntheticEvent) => { const q = (e.target as HTMLElement).closest?.('[id^="q-"]'); if (q) setCurNo(+q.id.slice(2)); };
  const finish = () => { audio.halt(); onDone(Date.now()); };
  const qs = <div onFocusCapture={trackFocus} onClickCapture={trackFocus}><GroupsView groups={m.groups} note={m.note} answers={cur.answers[m.id] ?? {}} onChange={(no, a) => setAnswer(m.id, no, a)} checked={false} /></div>;
  const list = hls[m.id] ?? [];
  const status = isR ? <ExamClock key="r" seconds={left} onEnd={() => onDone(cur.stageAt + d.reading * 1000)} />
    : cur.reviewAt ? <><span className="xhead__status">Check your answers</span><ExamClock key="rv" seconds={reviewLeft} onEnd={() => onDone(cur.reviewAt! + d.review * 1000)} /></>
      : audio.blocked !== null ? <button className="xbtn-solid" onClick={audio.resume}><Play size={15} /> Play audio</button>
        : <span className="xhead__status" data-testid="fm-lstatus">{audio.playing !== null ? `Part ${audio.playing + 1} · audio is playing` : 'Audio'}</span>;
  return (
    <ExamFrame onExit={onExit} status={status} tools={tools} volume={!isR}
      banner={{ title: `${isR ? 'Reading' : 'Listening'} · Part ${p + 1}`, text: isR ? `Read the text and answer questions ${range}.` : `Listen and answer questions ${range}.` }}
      footer={<ExamNav parts={parts} cur={p} curNo={curNo} answered={answered} flagged={flags}
        onPart={(i) => { setP(i); setCurNo(null); }} onGo={goNo}
        onFlag={(no) => setFlags((f) => { const x = new Set(f); if (x.has(no)) x.delete(no); else x.add(no); return x; })}
        onSubmit={() => confirm(isR ? 'Nộp Reading và sang Writing? Không quay lại được.' : 'Nộp Listening và sang Reading? Không quay lại được.') && finish()}
        submitLabel={isR ? 'Nộp Reading' : 'Nộp Listening'} />}>
      <div data-testid={`fm-${cur.stage}`} className="fm-stage">
        {isR ? <ExamSplit left={(
          <article className="passage passage--reading xpassage">
            <h2>{bareTitle(m)}</h2>
            {paragraphs((m as ReadingMaterial).passage).map((x, i) => { const { label, text } = paraLabel(x); return <p key={i} className="passage__p">{label && <span className="passage__label">{label}</span>}<span><HlText text={text} map={colorMap(text, list, String(i))} para={String(i)} /></span></p>; })}
          </article>
        )} right={qs} labels={['Passage', 'Questions']} /> : <div className="xsingle">{qs}</div>}
      </div>
      {isR && <HighlightBar scopeClass="xpassage" onAdd={(sel: HlSel[], color: HlColor) => setHls((h) => ({ ...h, [m.id]: addHls(h[m.id] ?? [], sel, color) }))}
        onRemove={(sel: HlSel[]) => setHls((h) => ({ ...h, [m.id]: removeHls(h[m.id] ?? [], sel) }))} />}
    </ExamFrame>
  );
}

/** Phát 4 section nối tiếp một lần, tiếp tục được từ (section, giây). Hết → onEnd(số giây đã trễ). */
function useMockAudio(sel: ListeningMaterial[], fast: boolean, onSection: (i: number) => void, onEnd: (over: number) => void, onPos: (l: Cur['lis']) => void) {
  const [playing, setPlaying] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<number | null>(null);
  const stop = useRef(false);
  const el = useRef<HTMLAudioElement | null>(null);
  const at = useRef({ sec: 0, pos: 0, t: Date.now() });
  const prefs = useExamPrefs();
  useEffect(() => { if (el.current) el.current.volume = prefs.volume; }, [prefs.volume]);
  // Ghi vị trí mỗi 3 giây (để mở lại thì phát tiếp đúng chỗ).
  useEffect(() => {
    const id = window.setInterval(() => { if (playing !== null) onPos({ sec: playing, pos: el.current ? el.current.currentTime : at.current.pos + (Date.now() - at.current.t) / 1000, at: Date.now() }); }, 3000);
    return () => window.clearInterval(id);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const playUrl = (url: string, offset: number) => new Promise<'ok' | 'blocked' | 'err' | { over: number }>((res) => {
    const a = new Audio(url); el.current = a; a.volume = prefs.volume;
    a.onended = () => res('ok'); a.onerror = () => res('err');
    const go = () => a.play().catch((e: DOMException) => res(e?.name === 'NotAllowedError' ? 'blocked' : 'err'));
    if (offset > 1) a.addEventListener('loadedmetadata', () => {
      if (isFinite(a.duration) && offset >= a.duration - 0.5) return res({ over: offset - a.duration });
      a.currentTime = offset; go();
    }, { once: true });
    else go();
  });
  const start = async (from = 0, offset = 0) => {
    stop.current = false; setBlocked(null);
    let over = 0;
    for (let i = from; i < sel.length; i++) {
      if (stop.current) return;
      const m = sel[i];
      const off = i === from ? offset : over;
      over = 0;
      setPlaying(i); onSection(i); at.current = { sec: i, pos: off, t: Date.now() }; el.current = null;
      onPos({ sec: i, pos: off, at: Date.now() });
      if (fast) { await new Promise((r) => window.setTimeout(r, 700)); continue; }
      if (m.audio) {
        const url = await resolveUrl(m.audio);
        const r = url ? await playUrl(url, off) : 'err';
        if (r === 'blocked') { setBlocked(i); setPlaying(null); at.current = { sec: i, pos: off, t: Date.now() }; return; }
        if (typeof r === 'object') over = r.over;
      } else if (m.transcript.trim()) {
        await speakLines(m.transcript.split('\n').map((l) => l.trim()).filter(Boolean), () => stop.current);
      }
    }
    if (!stop.current) { setPlaying(null); el.current = null; onEnd(over); }
  };
  /** Bị chặn tự phát (mở lại trang) → bấm Play: phát tiếp theo giờ thật. */
  const resume = () => { const b = at.current; start(b.sec, b.pos + (Date.now() - b.t) / 1000); };
  const halt = () => { stop.current = true; el.current?.pause(); stopSpeak(); setPlaying(null); };
  useEffect(() => () => halt(), []); // eslint-disable-line react-hooks/exhaustive-deps
  return { playing, blocked, start, resume, halt };
}

// ---------- Màn chuyển phần ----------
function Transition({ cur, tools, onExit, onStart }: { cur: Cur; tools: React.ReactNode; onExit: () => void; onStart: () => void }) {
  const d = dur(cur);
  const [left] = useState(() => Math.max(0, (cur.stageAt + d.trans * 1000 - Date.now()) / 1000));
  const next = cur.stage === 'trans-r' ? 'Reading' : 'Writing';
  const info = cur.stage === 'trans-r'
    ? ['3 passages, 40 questions.', '60 minutes. There is no extra time to transfer answers.']
    : ['Task 1 and Task 2.', '60 minutes in total – spend about 20 minutes on Task 1 and 40 minutes on Task 2.', 'Switch between tasks with the buttons at the bottom of the screen.'];
  return (
    <ExamFrame onExit={onExit} tools={tools} status={<ExamClock key={cur.stage} seconds={left} onEnd={onStart} />}>
      <div className="xintro fm-trans" data-testid="fm-trans">
        <p className="small muted">{cur.stage === 'trans-r' ? 'Listening đã xong.' : 'Reading đã xong.'}</p>
        <h1>Phần tiếp theo: {next}</h1>
        <section className="xintro__box"><ul>{info.map((x) => <li key={x}>{x}</li>)}</ul></section>
        <p className="small">Đồng hồ {next} bắt đầu khi bạn bấm nút, hoặc tự bắt đầu sau 60 giây.</p>
        <button className="xbtn-solid xbtn-solid--big" onClick={onStart}>Bắt đầu {next}</button>
      </div>
    </ExamFrame>
  );
}

// ---------- Writing ----------
function WritingStage({ cur, materials, tools, onExit, onText, onDone }: {
  cur: Cur; materials: Record<string, Material>; tools: React.ReactNode; onExit: () => void;
  onText: (task: 1 | 2, v: string) => void; onDone: (at: number) => void;
}) {
  const [task, setTask] = useState<1 | 2>(1);
  const [imgs, setImgs] = useState<Record<number, string | null>>({});
  const ws = cur.ids.w.map((id) => materials[id] as WritingMaterial);
  const d = dur(cur);
  const [left] = useState(() => Math.max(0, (cur.stageAt + d.writing * 1000 - Date.now()) / 1000));
  useEffect(() => { ws.forEach((m, i) => { if (m?.image) resolveUrl(m.image).then((u) => setImgs((x) => ({ ...x, [i + 1]: u }))); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const m = ws[task - 1];
  if (!m) return null;
  const n = (t: 1 | 2) => wordCount(cur.essays[t]);
  const min = task === 1 ? 150 : 250;
  return (
    <ExamFrame onExit={onExit} tools={tools}
      status={<ExamClock key="w" seconds={left} onEnd={() => onDone(cur.stageAt + d.writing * 1000)} />}
      banner={{ title: `Writing · Part ${task}`, text: `You should spend about ${task === 1 ? 20 : 40} minutes on this task. Write at least ${min} words.` }}
      footer={(
        <footer className="xnav">
          <div className="xnav__parts">
            {([1, 2] as const).map((t) => t === task
              ? <div key={t} className="xnav__part is-on" aria-current="step"><strong>Part {t}</strong> <span>{n(t)} words</span></div>
              : <button key={t} className="xnav__part" onClick={() => setTask(t)} data-testid={`fm-task${t}`}><strong>Part {t}</strong> <span>{n(t)} words</span></button>)}
          </div>
          <div className="xnav__right">
            <button className="xnav__submit" onClick={() => confirm(`Nộp Writing? (Task 1: ${n(1)} từ, Task 2: ${n(2)} từ)`) && onDone(Date.now())} aria-label="Nộp Writing" title="Nộp Writing"><Check size={22} /></button>
          </div>
        </footer>
      )}>
      <div data-testid="fm-writing" className="fm-stage">
        <ExamSplit key={task} left={<div className="xprompt"><TaskPrompt m={m} img={imgs[task] ?? null} /></div>}
          right={(
            <div className="xwrite">
              <textarea className="wbox__input" value={cur.essays[task]} onChange={(e) => onText(task, e.target.value)} aria-label={`Bài viết Task ${task}`} spellCheck={false} data-testid="fm-essay" />
              <div className="xwrite__count">Words: {n(task)}{n(task) < min && <span className="muted"> (tối thiểu {min})</span>}</div>
            </div>
          )} labels={['Task', `Answer (${n(task)})`]} storeKey="ielts:writing-split" />
      </div>
    </ExamFrame>
  );
}

// ---------- Speaking ----------
interface SpQ { part: 1 | 2 | 3; kind: 'q' | 'prep' | 'talk'; text: string; max: number }
function speakingPlan(m: SpeakingMaterial): SpQ[] {
  const p1 = (m.part1 ?? []).flatMap((t) => t.questions).slice(0, 9).map((q): SpQ => ({ part: 1, kind: 'q', text: q, max: 40 }));
  const p2 = m.part2 ? [
    { part: 2, kind: 'prep', text: m.part2.cue, max: 60 } as SpQ,
    { part: 2, kind: 'talk', text: m.part2.cue, max: 120 } as SpQ,
    ...(m.part2.followUp ?? []).slice(0, 2).map((q): SpQ => ({ part: 2, kind: 'q', text: q, max: 40 })),
  ] : [];
  const p3 = (m.part3?.questions ?? []).slice(0, 6).map((q): SpQ => ({ part: 3, kind: 'q', text: q, max: 60 }));
  return [...p1, ...p2, ...p3];
}

function SpeakTransition({ cur, onExit, onStart, onLater }: { cur: Cur; onExit: () => void; onStart: () => void; onLater: () => void }) {
  return (
    <ExamFrame onExit={onExit} exitLabel="Đóng" status={<span className="xhead__status">Speaking</span>}>
      <div className="xintro fm-trans" data-testid="fm-trans-s">
        <p className="small muted">Listening, Reading và Writing đã xong{cur.aid ? ' – đã lưu vào Lịch sử' : '…'}.</p>
        <h1>Phần tiếp theo: Speaking</h1>
        <section className="xintro__box"><ul>
          <li>Part 1 (4–5 phút): câu hỏi ngắn về bản thân, mỗi câu ~30 giây.</li>
          <li>Part 2 (3–4 phút): 1 phút chuẩn bị (ghi chú), nói tối đa 2 phút theo cue card.</li>
          <li>Part 3 (4–5 phút): thảo luận sâu hơn về chủ đề Part 2.</li>
          <li>Giám khảo (giọng máy) đọc câu hỏi, máy tự ghi âm. Nói xong bấm <b>Câu tiếp</b>. Trình duyệt sẽ hỏi quyền micro.</li>
        </ul></section>
        {cur.until && <p className="small"><CalendarClock size={14} /> Hạn làm Speaking: {new Date(cur.until).toLocaleDateString('vi-VN')}</p>}
        <div className="row wrap">
          <button className="xbtn-solid xbtn-solid--big" onClick={onStart} disabled={!cur.aid} data-testid="fm-speak-now"><Mic size={18} /> Bắt đầu Speaking</button>
          <button className="xbtn" onClick={onLater} disabled={!cur.aid} data-testid="fm-speak-later">Làm sau (trong 7 ngày)</button>
        </div>
      </div>
    </ExamFrame>
  );
}

function SpeakingStage({ cur, m, tools, onExit, onTurn, onDone }: {
  cur: Cur; m: SpeakingMaterial | undefined; tools: React.ReactNode; onExit: () => void;
  onTurn: (sp: NonNullable<Cur['sp']>) => void; onDone: (turns: SpTurn[]) => void;
}) {
  const plan = useMemo(() => (m ? speakingPlan(m) : []), [m]);
  const sp = cur.sp ?? { i: 0, turns: [] };
  const i = sp.i;
  const q = plan[i];
  const fast = !!cur.fast;
  const [ready, setReady] = useState(false); // giám khảo đọc xong câu hỏi
  const [typed, setTyped] = useState('');
  const [notes, setNotes] = useState('');
  const spRef = useRef(sp); spRef.current = sp;
  const finished = useRef(false);

  const record = (k: number, patch: Partial<SpTurn>) => {
    const cur0 = spRef.current;
    const turns = [...cur0.turns];
    const base: SpTurn = turns[k] ?? { part: plan[k].part, question: plan[k].kind === 'talk' ? `[Cue card] ${plan[k].text}` : plan[k].text, answer: '' };
    turns[k] = { ...base, ...patch, answer: patch.answer?.trim() ? patch.answer : base.answer };
    const nx = { ...cur0, turns };
    spRef.current = nx; onTurn(nx);
  };
  const next = (from = i) => {
    if (spRef.current.i !== from) return;
    if (plan[from]?.kind !== 'prep') record(from, typed.trim() ? { answer: typed } : {});
    let k = from + 1;
    // Part 1 tối đa 5 phút → sang Part 2.
    const p1At = spRef.current.p1At ?? Date.now();
    if (plan[k]?.part === 1 && Date.now() - p1At > (fast ? 30 : 300) * 1000) while (plan[k]?.part === 1) k++;
    const nx = { ...spRef.current, i: k, p1At };
    spRef.current = nx; onTurn(nx);
    setTyped(''); setReady(false);
  };
  // Giám khảo đọc câu hỏi (có giới hạn thời gian phòng TTS treo), rồi mới ghi âm.
  useEffect(() => {
    if (!q) return;
    let alive = true;
    if (!spRef.current.p1At) { const nx = { ...spRef.current, p1At: Date.now() }; spRef.current = nx; onTurn(nx); }
    const text = q.kind === 'prep' ? 'Now, I am going to give you a topic and I would like you to talk about it for one to two minutes. You have one minute to think about what you are going to say. You can make some notes if you wish.'
      : q.kind === 'talk' ? 'All right. Remember you have one to two minutes for this. Please start speaking now.' : q.text;
    const said = fast ? Promise.resolve() : Promise.race([speak(text, { voice: 'en-GB', rate: 0.95 }), new Promise<void>((r) => window.setTimeout(r, 20000))]);
    said.then(() => { if (alive) setReady(true); });
    return () => { alive = false; stopSpeak(); };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  // Hết thời gian câu → tự sang câu sau (Recorder cũng tự dừng ở maxSeconds).
  useEffect(() => {
    if (!q || !ready) return;
    const t = window.setTimeout(() => next(i), ((fast ? 1 : q.max) + (fast || q.kind === 'prep' ? 0 : 2)) * 1000);
    return () => window.clearTimeout(t);
  }, [ready, i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (q || finished.current) return;
    finished.current = true;
    onDone(spRef.current.turns.filter((t): t is SpTurn => !!t));
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m) return <ExamFrame onExit={onExit}><p className="xintro">Không tìm thấy bộ đề Speaking.</p></ExamFrame>;
  if (!q) return <ExamFrame onExit={onExit}><div className="xintro"><Loader2 className="spin" /> Đang lưu…</div></ExamFrame>;
  const onRec = async (k: number, r: Recording) => {
    let audio: string | undefined;
    try { audio = await saveBlob(r.blob); } catch { /* hết chỗ */ }
    record(k, { answer: r.transcript, seconds: r.seconds, audio });
    if (spRef.current.i === k && q.kind !== 'prep') next(k);
  };
  const p1n = plan.filter((x) => x.part === 1).length;
  const label = q.part === 1 ? `Part 1 · Question ${i + 1}/${p1n}` : q.part === 2 ? (q.kind === 'prep' ? 'Part 2 · Preparation' : q.kind === 'talk' ? 'Part 2 · Long turn' : 'Part 2 · Follow-up') : `Part 3 · Question ${i - plan.findIndex((x) => x.part === 3) + 1}`;
  return (
    <ExamFrame onExit={onExit} tools={tools}
      status={ready ? <ExamClock key={`s${i}`} seconds={fast ? 1 : q.max} /> : <span className="xhead__status">Examiner is speaking…</span>}
      banner={{ title: `Speaking · Part ${q.part}`, text: label }}
      footer={(
        <footer className="xnav">
          <div className="xnav__parts">{([1, 2, 3] as const).map((p) => <div key={p} className={`xnav__part${q.part === p ? ' is-on' : ''}`}><strong>Part {p}</strong></div>)}</div>
          <div className="xnav__right">
            <button className="xbtn-solid" onClick={() => next(i)} data-testid="fm-snext"><SkipForward size={16} /> {q.kind === 'prep' ? 'Nói luôn' : 'Câu tiếp'}</button>
          </div>
        </footer>
      )}>
      <div className="fm-speak" data-testid="fm-speaking">
        {q.part === 2 && (q.kind === 'prep' || q.kind === 'talk') && m.part2 ? (
          <div className="cue card">
            <span className="badge">Part 2 · Cue card</span>
            <h2 className="cue__title">{m.part2.cue}</h2>
            <p>You should say:</p>
            <ul className="cue__points">{m.part2.points.map((x, k) => <li key={k}>{x}</li>)}</ul>
            <textarea className="textarea" rows={4} placeholder="Ghi chú (từ khoá, ý chính)…" value={notes} onChange={(e) => setNotes(e.target.value)} readOnly={q.kind === 'talk'} />
          </div>
        ) : <p className="fm-speak__q">{ready ? q.text : <span className="muted">Listen to the examiner…</span>}</p>}
        {ready && q.kind !== 'prep' && (
          <div className="stack">
            {!fast && <Recorder key={i} autoStart maxSeconds={q.max} onDone={(r) => onRec(i, r)} label="Ghi âm câu trả lời" />}
            <textarea className="textarea" rows={2} placeholder="Không ghi âm được? Gõ câu trả lời vào đây." value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Gõ câu trả lời" />
          </div>
        )}
        {q.kind === 'prep' && ready && <p className="small muted">1 phút chuẩn bị – hết giờ sẽ tự chuyển sang phần nói.</p>}
      </div>
    </ExamFrame>
  );
}

// ---------- Kết quả (trang Lịch sử) ----------
export function FullMockResult({ a }: { a: Attempt }) {
  const db = useDb();
  const cfg = useAiConfig();
  const d = a.detail as FullDetail;
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const tried = useRef(false);
  const ms = db.materials;
  const ws = d.ids.w.map((id) => ms[id] as WritingMaterial | undefined);
  const pend = getKv<Cur | null>(KEY);
  const canSpeak = pend && pend.aid === a.id && pend.stage === 'trans-s' && (!pend.until || pend.until > Date.now());
  const turns = d.s?.turns ?? [];

  const gradeAI = async () => {
    setErr('');
    try {
      if (!d.w.grades?.[1] || !d.w.grades?.[2]) {
        setBusy('Đang chấm Writing…');
        const { gradeWriting } = await import('../ai/writing');
        const gs = await Promise.all(([1, 2] as const).map((t) => (ws[t - 1] && wordCount(d.w.texts[t]) >= 30 ? gradeWriting(ws[t - 1]!, d.w.texts[t], getAiConfig(), t === 1 ? 20 : 40) : Promise.resolve(undefined))));
        await patchDetail(a.id, (x) => {
          const grades = { ...x.w.grades, ...(gs[0] && { 1: gs[0] }), ...(gs[1] && { 2: gs[1] }) };
          const b1 = grades[1]?.overall ?? 0, b2 = grades[2]?.overall ?? 0;
          return { ...x, w: { ...x.w, grades, band: grades[1] || grades[2] ? round5((b1 + 2 * b2) / 3) : x.w.band } };
        });
      }
      const sm = ms[d.ids.s] as SpeakingMaterial | undefined;
      if (turns.some((t) => t.answer.trim()) && !d.s?.grades) {
        setBusy('Đang chấm Speaking…');
        const { gradeSpeaking } = await import('../ai/speaking');
        const grades: Partial<Record<1 | 2 | 3, SpeakingGrade>> = {};
        for (const p of [1, 2, 3] as const) {
          const ts = turns.filter((t) => t.part === p && t.answer.trim());
          if (ts.length) grades[p] = await gradeSpeaking(p, sm?.topic ?? sm?.title ?? 'IELTS Speaking', ts.map((t) => ({ question: t.question, answer: t.answer, seconds: t.seconds })), getAiConfig());
        }
        const os = Object.values(grades).map((g) => g!.overall);
        await patchDetail(a.id, (x) => ({ ...x, s: { ...x.s, grades, band: os.length ? round5(os.reduce((s, b) => s + b, 0) / os.length) : x.s?.band } }));
      }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  };
  useEffect(() => {
    if (tried.current || !aiReady(cfg)) return;
    const needW = !d.w.grades && wordCount(d.w.texts[1] + ' ' + d.w.texts[2]) >= 30;
    const needS = turns.some((t) => t.answer.trim()) && !d.s?.grades;
    if (needW || needS) { tried.current = true; gradeAI(); }
  }, [a.id, turns.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selfW = (t: 1 | 2, b: number) => patchDetail(a.id, (x) => {
    const self = { ...x.w.self, [t]: b };
    const band = x.w.grades ? x.w.band : self[1] != null && self[2] != null ? round5((self[1] + 2 * self[2]) / 3) : undefined;
    return { ...x, w: { ...x.w, self, band } };
  });
  const selfS = (b: number) => patchDetail(a.id, (x) => ({ ...x, s: { ...x.s, self: b, band: x.s?.grades ? x.s.band : b } }));

  const tiles: [string, string, number | undefined, string][] = [
    ['l', 'Listening', d.l.band, `${d.l.score}/${d.l.max} câu`],
    ['r', 'Reading', d.r.band, `${d.r.score}/${d.r.max} câu${d.module === 'general' ? ' · đề Academic' : ''}`],
    ['w', 'Writing', d.w.band, d.w.grades ? 'AI chấm (ước tính)' : d.w.band ? 'tự chấm' : 'chưa chấm'],
    ['s', 'Speaking', d.s?.band, d.s?.grades ? 'AI chấm (ước tính)' : d.s?.band ? 'tự chấm' : d.s?.skipped || !turns.length ? 'chưa làm' : 'chưa chấm'],
  ];
  const fmtT = (s?: number) => (s == null ? '–' : s < 60 ? `${s} giây` : `${Math.round(s / 60)} phút`);
  return (
    <div className="stack fm-result" data-testid="fm-result">
      <section className="card pad">
        <div className="fm-bands">
          {tiles.map(([k, label, b, sub]) => <div key={k} className="fm-band"><span className="small muted">{label}</span><strong data-testid={`fm-band-${k}`}>{fmtBand(b)}</strong><small className="muted">{sub}</small></div>)}
          <div className="fm-band fm-band--all"><span className="small">Overall</span><strong data-testid="fm-overall">{fmtBand(d.overall)}</strong><small>{d.overall ? 'trung bình 4 kỹ năng' : 'cần đủ 4 band'}</small></div>
        </div>
        <p className="small muted">{d.module === 'general' ? 'General Training' : 'Academic'} · Writing = (Task 1 + 2 × Task 2) / 3, làm tròn 0.5. Band Writing/Speaking chỉ là ước tính.</p>
        <table className="table fm-times"><tbody><tr><td>Listening</td><td>{fmtT(d.times.l)}</td><td>Reading</td><td>{fmtT(d.times.r)}</td></tr><tr><td>Writing</td><td>{fmtT(d.times.w)}</td><td>Speaking</td><td>{fmtT(d.times.s)}</td></tr></tbody></table>
        <div className="row wrap no-print">
          <button className="btn btn--ghost btn--sm" onClick={() => window.print()}><Printer size={15} /> In kết quả</button>
          {aiReady(cfg) && <button className="btn btn--ghost btn--sm" onClick={gradeAI} disabled={!!busy}>{busy ? <><Loader2 size={15} className="spin" /> {busy}</> : <><Bot size={15} /> Chấm bằng AI</>}</button>}
          {canSpeak && <Link to="/mock/full" className="btn btn--primary btn--sm" data-testid="fm-do-speak"><Mic size={15} /> Làm Speaking{pend?.until ? ` (hạn ${new Date(pend.until).toLocaleDateString('vi-VN')})` : ''}</Link>}
        </div>
        {err && <p className="no-text small">{err}</p>}
        {!aiReady(cfg) && <div className="no-print"><AiMissing /></div>}
      </section>
      <section className="card pad row wrap no-print fm-backup">
        <span className="small">Bài thi chỉ lưu trong trình duyệt này. Tải file sao lưu để không mất.</span>
        <button className="btn btn--ghost btn--sm" onClick={() => downloadBackup()}><Download size={15} /> Sao lưu ngay</button>
      </section>

      <h2 className="h3">Listening</h2>
      {d.l.parts.map((p) => <RLPartView key={p.id} p={p} m={ms[p.id] as ListeningMaterial | undefined} multi />)}
      <h2 className="h3">Reading</h2>
      {d.r.parts.map((p) => <RLPartView key={p.id} p={p} m={ms[p.id] as ReadingMaterial | undefined} multi />)}

      <h2 className="h3">Writing</h2>
      {([1, 2] as const).map((t) => {
        const wm = ws[t - 1];
        const g = d.w.grades?.[t];
        return (
          <section key={t} className="card pad stack">
            <div className="row-between"><h3 className="h3">Task {t}</h3><span className="tag">{d.w.words[t]} từ{g ? ` · band ${fmtBand(g.overall)}` : d.w.self?.[t] != null ? ` · tự chấm ${fmtBand(d.w.self[t])}` : ''}</span></div>
            {wm && <Collapse title="Đề bài"><TaskPrompt m={wm} img={null} /></Collapse>}
            {d.w.texts[t].trim() ? <div className="hd-essay">{d.w.texts[t].split(/\n+/).map((x, k) => <p key={k}>{x}</p>)}</div> : <p className="muted small">(bỏ trống)</p>}
            {g ? <WritingGradeView grade={g} text={d.w.texts[t]} task={t} from={wm?.id ?? ''} title="Kết quả AI chấm" />
              : <div className="no-print" data-testid={`fm-self-w${t}`}><SelfCheck kind="writing" task={t} onBand={(b) => selfW(t, b)} /></div>}
          </section>
        );
      })}

      <h2 className="h3">Speaking</h2>
      {turns.length ? (
        <section className="card pad stack">
          {([1, 2, 3] as const).map((p) => {
            const ts = turns.filter((t) => t.part === p);
            if (!ts.length) return null;
            const g = d.s?.grades?.[p];
            return (
              <div key={p} className="stack">
                <h3 className="h3">Part {p}{g ? ` · band ${fmtBand(g.overall)}` : ''}</h3>
                <ol className="hd-turns">{ts.map((t, k) => (
                  <li key={k} className="hd-turn"><strong>{t.question}</strong>{t.audio && <BlobAudio src={t.audio} />}
                    {t.answer.trim() ? <p className="hd-turn__tr">{t.answer}</p> : <p className="small muted">(không có transcript)</p>}</li>
                ))}</ol>
                {g && <SpeakingGradeView g={g} part={p} from={d.ids.s} />}
              </div>
            );
          })}
          {!d.s?.grades && <div className="no-print" data-testid="fm-self-s"><SelfCheck kind="speaking" onBand={selfS} extra="Nghe lại bản ghi của bạn để chấm." /></div>}
        </section>
      ) : <p className="banner">{canSpeak ? 'Chưa làm Speaking – bấm "Làm Speaking" ở trên (trong 7 ngày).' : 'Không có phần Speaking.'}</p>}
    </div>
  );
}
