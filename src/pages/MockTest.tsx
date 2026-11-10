// Thi thử Reading / Listening theo giao diện máy thi IELTS (ExamFrame).
// - /test/:skill/:tid/full: cả đề gốc (3 passage / 4 section), màn hướng dẫn (+ kiểm tra âm thanh) → làm bài → nộp → band.
// - /mock/:skill: chọn bài từ nhiều đề rồi thi như trên.
// - /reading/:id, /listening/:id: thi một passage / section (vào thẳng, không màn hướng dẫn).
// Listening: audio các section phát liền một lần, không dừng/tua (chỉ chỉnh âm lượng); hết audio còn 2 phút kiểm tra rồi tự nộp.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpenCheck, GraduationCap, Keyboard, PenLine, Play, RotateCcw, Shuffle } from 'lucide-react';
import type { ListeningMaterial, ReadingMaterial } from '../types';
import { addAttempt, resolveUrl, useDb } from '../db';
import { touchStreak, useSettings } from '../store';
import { stopAudio } from '../components/AudioPlayer';
import { GroupsView, isCorrect, scoreGroups, type Answers } from '../components/Questions';
import { ExamClock, ExamFrame, ExamIntro, ExamNav, ExamSheet, ExamSplit, answeredNos, focusQuestion, groupNos, qNos, useExamPrefs } from '../components/Exam';
import { HighlightBar, HlText, addHls, colorMap, removeHls, type Hl, type HlColor, type HlSel } from '../components/Highlight';
import WordPopover, { type WordSel } from '../components/WordPopover';
import { RichText } from '../components/ui';
import { paragraphs, paraLabel, shuffle } from '../lib/text';
import { fmtBand, rawToBand } from '../lib/band';
import { stopSpeak } from '../lib/tts';
import { SKILL_META } from './SkillList';
import { groupByTest, partLabel, testName } from '../lib/tests';
import { speakLines } from './ListeningTest';

type M = ReadingMaterial | ListeningMaterial;

/** Trang Thi thử ghép đề / cả đề. */
export default function MockTest() {
  const { skill, tid } = useParams<{ skill: 'reading' | 'listening'; tid?: string }>();
  const db = useDb();
  const nav = useNavigate();
  const isR = skill === 'reading';
  const pool = useMemo(() => Object.values(db.materials).filter((m) => m.skill === skill && (m as M).groups.length) as M[], [db.materials, skill]);
  const full = useMemo(() => (tid ? groupByTest(Object.values(db.materials), skill!).tests.get(tid) : undefined), [db.materials, skill, tid]);
  const [picked, setPicked] = useState<string[]>(() => full?.parts.map((x) => x.id) ?? []);
  const [started, setStarted] = useState(!!full);
  const want = full ? full.parts.length : isR ? 3 : 4;
  const back = full ? `/test/${skill}/${full.key}` : `/${skill}`;
  const name = full ? `${testName(full)} – cả đề` : `Thi thử ${SKILL_META[skill!]?.label} (${picked.length} bài)`;
  const random = () => setPicked(shuffle(pool).slice(0, want).map((x) => x.id));
  useEffect(() => { if (!full && !picked.length && pool.length) random(); }, [pool.length]); // eslint-disable-line

  if (!skill || !(skill === 'reading' || skill === 'listening')) return null;
  if (tid && !full) return <div className="page"><p className="empty">Không tìm thấy đề.</p></div>;
  if (started) return <ExamRunner skill={skill} ids={picked} name={name} back={back} intro full={!!full} />;
  const minutes = isR ? 60 : 32;
  return (
    <div className="page" style={{ ['--skill' as string]: SKILL_META[skill].color }}>
      <div className="topbar"><button className="icon-btn" onClick={() => nav(back)} aria-label="Quay lại"><ArrowLeft size={20} /></button><div className="topbar__title"><small>Thi thử · {SKILL_META[skill].label}</small><strong>{want} bài, {minutes} phút</strong></div></div>
      <p className="lead">Chọn {want} bài từ nhiều đề (hoặc bấm ngẫu nhiên). Muốn làm trọn một đề gốc thì vào {SKILL_META[skill].label} → chọn VOL → Test → <em>Thi thử cả đề</em>. Giao diện như máy thi thật, nộp một lần, chấm trên tổng số câu rồi quy về thang 40 câu → band.</p>
      <div className="row wrap"><button className="btn btn--ghost btn--sm" onClick={random}><Shuffle size={15} /> Chọn ngẫu nhiên</button><span className="small muted">Đã chọn {picked.length}/{want}</span></div>
      <ul className="items items--1">
        {pool.map((x) => { const on = picked.includes(x.id); return (
          <li key={x.id} className={`item${on ? ' item--done' : ''}`} onClick={() => setPicked((p) => (on ? p.filter((i) => i !== x.id) : p.length < want ? [...p, x.id] : p))}>
            <div className="item__no">{on ? picked.indexOf(x.id) + 1 : ''}</div>
            <div className="item__body"><div className="item__title">{x.title}</div><div className="item__sub">{x.groups.reduce((k, g) => k + g.questions.length, 0)} câu{x.skill === 'listening' && ` · Section ${(x as ListeningMaterial).section ?? '?'}`}</div></div>
          </li>); })}
      </ul>
      {pool.length < want && <p className="muted small">Chỉ có {pool.length} bài có câu hỏi – nạp thêm ở mục Tài liệu để thi thử đủ {want} bài.</p>}
      <div className="actionbar"><div className="actionbar__inner"><span className="result">{picked.length} bài · {minutes} phút</span><button className="btn btn--primary" onClick={() => setStarted(true)} disabled={!picked.length}><Play size={18} /> Bắt đầu</button></div></div>
    </div>
  );
}

/** Tên bài không kèm "VOL x Test y · Passage n –". */
export const bareTitle = (m: M) => m.title.replace(/^.*?(?:Passage|Section)\s*\d+\s*[–:-]\s*/, '');

const INTRO = {
  reading: {
    title: 'IELTS Academic Reading', time: '1 hour',
    instructions: ['Answer all the questions.', 'You can change your answers at any time during the test.'],
    info: ['There are 40 questions in this test.', 'Each question carries one mark.', 'There are three parts to the test.', 'The test clock will show you when there are 10 minutes and 5 minutes remaining.'],
  },
  listening: {
    title: 'IELTS Listening', time: 'Approximately 30 minutes',
    instructions: ['Answer all the questions.', 'You can change your answers at any time during the test.'],
    info: ['There are 40 questions in this test.', 'Each question carries one mark.', 'There are four parts to the test.', 'You will hear each part once only.', 'For each part of the test there will be time for you to look through the questions and time for you to check your answers.', 'At the end of the test you will have 2 minutes to check your answers.'],
  },
};

/** Phát audio các section nối tiếp một lần (file mp3, không có thì giọng máy đọc transcript). */
function useExamAudio(sel: ListeningMaterial[], onSection: (i: number) => void) {
  const [playing, setPlaying] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  const [blocked, setBlocked] = useState<number | null>(null);
  const stop = useRef(false);
  const el = useRef<HTMLAudioElement | null>(null);
  const prefs = useExamPrefs();
  useEffect(() => { if (el.current) el.current.volume = prefs.volume; }, [prefs.volume]);
  const playUrl = (url: string) => new Promise<'ok' | 'blocked' | 'err'>((res) => {
    const a = new Audio(url); el.current = a; a.volume = prefs.volume;
    a.onended = () => res('ok'); a.onerror = () => res('err');
    a.play().catch((e: DOMException) => res(e?.name === 'NotAllowedError' ? 'blocked' : 'err'));
  });
  const start = async (from = 0) => {
    stop.current = false; setBlocked(null);
    for (let i = from; i < sel.length; i++) {
      if (stop.current) return;
      const m = sel[i];
      setPlaying(i); onSection(i);
      if (m.audio) {
        const url = await resolveUrl(m.audio);
        const r = url ? await playUrl(url) : 'err';
        if (r === 'blocked') { setBlocked(i); setPlaying(null); return; }
      } else if (m.transcript.trim()) {
        await speakLines(m.transcript.split('\n').map((l) => l.trim()).filter(Boolean), () => stop.current);
      }
    }
    if (!stop.current) { setPlaying(null); setEnded(true); }
  };
  const halt = () => { stop.current = true; el.current?.pause(); stopSpeak(); setPlaying(null); };
  useEffect(() => () => halt(), []); // eslint-disable-line react-hooks/exhaustive-deps
  return { playing, ended, blocked, start, halt };
}

/** Một bài thi trong khung máy thi. `ids`: các passage / section theo thứ tự. */
export function ExamRunner({ skill, ids, name, back, intro, full }: {
  skill: 'reading' | 'listening'; ids: string[]; name: string; back: string;
  /** Có màn hướng dẫn trước (cả đề / ghép đề). Một bài lẻ thì vào thẳng. */
  intro?: boolean; full?: boolean;
}) {
  const db = useDb();
  const nav = useNavigate();
  const s = useSettings();
  const isR = skill === 'reading';
  const sel = useMemo(() => ids.map((id) => db.materials[id] as M).filter((x) => x && x.skill === skill), [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  const single = sel.length === 1;
  const [phase, setPhase] = useState<'intro' | 'test'>(intro ? 'intro' : 'test');
  const [cur, setCur] = useState(0);
  const [curNo, setCurNo] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answers>>({});
  const [flags, setFlags] = useState<Record<string, Set<number>>>({});
  const [checked, setChecked] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [review, setReview] = useState(false); // Listening: 2 phút kiểm tra sau audio
  const [hls, setHls] = useState<Record<string, Hl[]>>({});
  const [word, setWord] = useState<WordSel | null>(null);
  const [showScript, setShowScript] = useState(false);
  const startedAt = useRef(Date.now());
  const curRef = useRef(cur); curRef.current = cur;
  const audio = useExamAudio(isR ? [] : (sel as ListeningMaterial[]), (i) => { if (curRef.current === i - 1 || i === 0) { setCur(i); setCurNo(null); } });

  const m = sel[cur];
  const total = sel.reduce((n, x) => n + x.groups.reduce((k, g) => k + g.questions.length, 0), 0);
  const res = checked ? sel.map((x) => scoreGroups(x.groups, answers[x.id] ?? {})) : null;
  const score = res?.reduce((n, r) => n + r.score, 0) ?? 0;
  const band = res ? rawToBand(skill, score, total, s.module) : null;
  const minutes = isR ? (single ? (sel[0] as ReadingMaterial).minutes ?? 20 : 60) : 32;

  // Listening: hết audio → 2 phút kiểm tra.
  useEffect(() => { if (audio.ended && !checked) setReview(true); }, [audio.ended]); // eslint-disable-line react-hooks/exhaustive-deps
  // Bắt đầu phát khi vào phần làm bài.
  useEffect(() => { if (phase === 'test' && !isR && !checked) audio.start(); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (checked) return;
    setChecked(true); setSheet(true); audio.halt(); stopAudio(); touchStreak();
    const rs = sel.map((x) => scoreGroups(x.groups, answers[x.id] ?? {}));
    const sc = rs.reduce((n, r) => n + r.score, 0);
    if (single) {
      const x = sel[0];
      await addAttempt({ materialId: x.id, skill, title: x.title, mode: 'test', score: sc, max: total, band: rawToBand(skill, sc, total, (x as ReadingMaterial).module ?? s.module), detail: { answers: answers[x.id] ?? {}, minutes: Math.round((Date.now() - startedAt.current) / 60000), wrong: rs[0].wrong } });
    } else {
      await addAttempt({ materialId: ids.join('+'), skill, title: `${SKILL_META[skill].label} · ${name}`, mode: 'test', score: sc, max: total, band: rawToBand(skill, sc, total, s.module), detail: { minutes: Math.round((Date.now() - startedAt.current) / 60000), parts: sel.map((x, i) => ({ id: x.id, title: x.title, answers: answers[x.id] ?? {}, ...rs[i] })) } });
    }
  };
  const exit = () => { if (checked || phase === 'intro' || confirm('Thoát bài thi? Bài làm sẽ mất.')) { audio.halt(); nav(back); } };

  if (!m) return null;
  if (phase === 'intro') {
    const t = INTRO[skill];
    return <ExamIntro {...t} time={isR ? (sel.length === 3 ? t.time : `${minutes} minutes`) : t.time}
      info={sel.length === (isR ? 3 : 4) ? t.info : [`There are ${total} questions in this test.`, ...t.info.slice(1).filter((x) => !/parts to the test/.test(x))]}
      sound={!isR} onExit={exit} onStart={() => { startedAt.current = Date.now(); setPhase('test'); }} />;
  }

  const parts = sel.map((x) => ({ label: `Part ${single ? partNo(x) : sel.indexOf(x) + 1}`, nos: groupNos(x.groups) }));
  const answered = sel.map((x) => answeredNos(x.groups, answers[x.id] ?? {}));
  const flagged = flags[m.id] ?? new Set<number>();
  const results = checked ? new Map(m.groups.flatMap((g) => g.questions.flatMap((q) => qNos(q).map((n) => [n, isCorrect(q, (answers[m.id] ?? {})[q.no] ?? null)] as const)))) : undefined;
  const nos = parts[cur].nos;
  const range = nos.length ? `${nos[0]}–${nos[nos.length - 1]}` : '';
  const go = (no: number, pi: number) => { if (pi !== cur) setCur(pi); setCurNo(no); window.setTimeout(() => focusQuestion(no), pi !== cur ? 60 : 0); };
  const onChange = (no: number, a: Answers[number]) => setAnswers((st) => ({ ...st, [m.id]: { ...(st[m.id] ?? {}), [no]: a } }));
  const trackFocus = (e: React.SyntheticEvent) => { const q = (e.target as HTMLElement).closest?.('[id^="q-"]'); if (q) setCurNo(+q.id.slice(2)); };

  const status = checked
    ? <span className="xhead__status">{score}/{total} · Band {fmtBand(band)}</span>
    : isR ? <ExamClock key="r" seconds={minutes * 60} onEnd={submit} />
      : review ? <><span className="xhead__status">Check your answers</span><ExamClock key="rv" seconds={120} onEnd={submit} /></>
        : <>{audio.blocked !== null ? <button className="xbtn-solid" onClick={() => audio.start(audio.blocked!)}><Play size={15} /> Play audio</button>
          : <span className="xhead__status">{audio.playing !== null ? `Part ${audio.playing + 1} · audio is playing` : 'Audio'}</span>}<ExamClock key="l" seconds={minutes * 60} /></>;

  const practiceHref = `/${skill}/${m.id}/practice`;
  const tools = (full || single || checked) ? (
    <Link to={practiceHref} className="xbtn xbtn--text mode-switch" title="Chuyển sang Luyện tập: không tính giờ, xem đáp án từng câu"
      onClick={(e) => { if (!checked && Object.keys(answers).length && !confirm('Chuyển sang Luyện tập? Bài thi đang làm sẽ không được lưu.')) e.preventDefault(); else audio.halt(); }}>
      <GraduationCap size={16} /> <span>Luyện tập</span>
    </Link>
  ) : null;

  const qs = <div onFocusCapture={trackFocus} onClickCapture={trackFocus}><GroupsView groups={m.groups} note={m.note} answers={answers[m.id] ?? {}} onChange={onChange} checked={checked} /></div>;
  const list = hls[m.id] ?? [];
  const passage = isR ? (
    <article className="passage passage--reading xpassage">
      <h2>{bareTitle(m)}</h2>
      {paragraphs((m as ReadingMaterial).passage).map((p, i) => {
        const { label, text } = paraLabel(p);
        return <p key={i} className="passage__p">{label && <span className="passage__label">{label}</span>}<span><HlText text={text} map={colorMap(text, list, String(i))} onWord={checked ? setWord : undefined} para={String(i)} /></span></p>;
      })}
    </article>
  ) : null;
  const addHl = (sel: HlSel[], color: HlColor) => setHls((h) => ({ ...h, [m.id]: addHls(h[m.id] ?? [], sel, color) }));
  const rmHl = (sel: HlSel[]) => setHls((h) => ({ ...h, [m.id]: removeHls(h[m.id] ?? [], sel) }));
  const lm = m as ListeningMaterial;

  return (
    <ExamFrame onExit={exit} status={status} tools={tools} volume={!isR}
      banner={{ title: parts[cur].label, text: isR ? `Read the text and answer questions ${range}.` : `Listen and answer questions ${range}.` }}
      footer={<ExamNav parts={parts} cur={cur} curNo={curNo} answered={answered} flagged={flagged} results={results}
        onPart={(i) => { setCur(i); setCurNo(null); }} onGo={go}
        onFlag={(no) => setFlags((f) => { const x = new Set(f[m.id] ?? []); if (x.has(no)) x.delete(no); else x.add(no); return { ...f, [m.id]: x }; })}
        onSubmit={checked ? () => setSheet(true) : () => confirm('Nộp bài? Sau khi nộp không sửa được câu trả lời.') && submit()} submitLabel={checked ? 'Xem kết quả' : 'Nộp bài'} />}>
      {isR ? <ExamSplit left={passage} right={qs} labels={['Passage', 'Questions']} /> : (
        <div className="xsingle">
          {checked && showScript && lm.transcript.trim() && <div className="rich rich--transcript"><RichText text={lm.transcript} /></div>}
          {qs}
        </div>
      )}
      {isR && <HighlightBar scopeClass="xpassage" onAdd={addHl} onRemove={rmHl} />}
      {word && <WordPopover sel={word} vocab={(m as ReadingMaterial).vocab} from={m.id} onClose={() => setWord(null)} />}
      {checked && sheet && res && (
        <ExamSheet onClose={() => setSheet(false)}>
          <div className="final">
            <h2>Kết quả</h2>
            <div className="final__head">
              <div><strong className="final__big">{score}/{total}</strong><div className="muted small">câu đúng</div></div>
              <div><strong className="final__big">Band {fmtBand(band)}</strong><div className="muted small">ước tính{total !== 40 ? ` (quy ${total} câu → 40)` : ''}</div></div>
            </div>
            {sel.length > 1 && <table className="table final__table"><tbody>{sel.map((x, i) => <tr key={x.id}><td>{full ? partLabel(x) : x.title}</td><td>{res[i].score}/{res[i].max}</td></tr>)}</tbody></table>}
            <p className="small muted">Đóng bảng này để xem lại từng câu: số câu ở thanh dưới tô xanh (đúng) / đỏ (sai), có giải thích.{isR ? ' Bấm vào từ trong bài để tra nghĩa.' : ''}</p>
            <div className="row wrap">
              <button className="btn btn--primary btn--sm" onClick={() => setSheet(false)}>Xem lại bài làm</button>
              <Link to={practiceHref} className="btn btn--ghost btn--sm"><GraduationCap size={15} /> Luyện tập {single ? 'bài này' : partLabel(m)}</Link>
              {!isR && single && lm.transcript.trim() && <>
                <Link to={`/listening/${m.id}/dictation`} className="btn btn--ghost btn--sm"><Keyboard size={15} /> Nghe & chép</Link>
                <Link to={`/listening/${m.id}/gapfill`} className="btn btn--ghost btn--sm"><PenLine size={15} /> Điền từ transcript</Link>
                <Link to={`/listening/${m.id}/study`} className="btn btn--ghost btn--sm"><BookOpenCheck size={15} /> Học transcript</Link>
              </>}
              {!isR && lm.transcript.trim() && <button className="btn btn--text btn--sm" onClick={() => { setShowScript(!showScript); setSheet(false); }}>{showScript ? 'Ẩn transcript' : 'Xem transcript'}</button>}
              <button className="btn btn--text btn--sm" onClick={() => nav(0)}><RotateCcw size={15} /> Làm lại</button>
            </div>
          </div>
        </ExamSheet>
      )}
    </ExamFrame>
  );
}

/** Số Part theo đề gốc (Passage 2 → Part 2) khi thi một bài lẻ. */
function partNo(m: M) {
  if (m.skill === 'listening') return m.section ?? 1;
  return +(partLabel(m).match(/\d+/)?.[0] ?? 1);
}
