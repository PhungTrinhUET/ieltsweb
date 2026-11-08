// Thi thử: ghép nhiều bài Reading (3 bài / 60 phút) hoặc Listening (4 section / ~30 phút) thành một đề, một đồng hồ, chấm chung → band.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Pause, Play, Shuffle } from 'lucide-react';
import type { ListeningMaterial, ReadingMaterial } from '../types';
import { addAttempt, resolveUrl, useDb } from '../db';
import { touchStreak, useSettings } from '../store';
import Timer from '../components/Timer';
import AudioPlayer, { stopAudio } from '../components/AudioPlayer';
import { GroupsView, scoreGroups, type Answers } from '../components/Questions';
import { paragraphs, paraLabel, shuffle } from '../lib/text';
import { fmtBand, rawToBand } from '../lib/band';
import { SKILL_META } from './SkillList';
import { useScriptSpeaker } from './ListeningTest';

type M = ReadingMaterial | ListeningMaterial;

export default function MockTest() {
  const { skill } = useParams<{ skill: 'reading' | 'listening' }>();
  const db = useDb();
  const nav = useNavigate();
  const s = useSettings();
  const isR = skill === 'reading';
  const pool = useMemo(() => Object.values(db.materials).filter((m) => m.skill === skill && (m as M).groups.length) as M[], [db.materials, skill]);
  const [picked, setPicked] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [cur, setCur] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answers>>({});
  const [checked, setChecked] = useState(false);
  const want = isR ? 3 : 4;
  const minutes = isR ? 60 : 32;

  const sel = picked.map((id) => db.materials[id] as M).filter((x) => x && x.skill === skill);
  const m = sel[cur];
  const total = sel.reduce((n, x) => n + x.groups.reduce((k, g) => k + g.questions.length, 0), 0);
  const done = Object.values(answers).reduce((n, a) => n + Object.values(a).filter((v) => v !== null && v !== '' && !(Array.isArray(v) && !v.length)).length, 0);
  const res = checked ? sel.map((x) => scoreGroups(x.groups, answers[x.id] ?? {})) : null;
  const score = res?.reduce((n, r) => n + r.score, 0) ?? 0;
  const band = res ? rawToBand(skill!, score, total, s.module) : null;

  const submit = async () => {
    setChecked(true); stopAudio(); touchStreak();
    const rs = sel.map((x) => scoreGroups(x.groups, answers[x.id] ?? {}));
    const sc = rs.reduce((n, r) => n + r.score, 0);
    await addAttempt({ materialId: picked.join('+'), skill: skill!, title: `Thi thử ${SKILL_META[skill!].label} (${sel.length} bài)`, mode: 'test', score: sc, max: total, band: rawToBand(skill!, sc, total, s.module), detail: { parts: sel.map((x, i) => ({ id: x.id, title: x.title, ...rs[i] })) } });
    window.scrollTo({ top: 0 });
  };
  const random = () => setPicked(shuffle(pool).slice(0, want).map((x) => x.id));
  useEffect(() => { if (!picked.length && pool.length) random(); }, [pool.length]); // eslint-disable-line

  if (!skill || !(skill === 'reading' || skill === 'listening')) return null;
  if (!started) {
    return (
      <div className="page" style={{ ['--skill' as string]: SKILL_META[skill].color }}>
        <div className="topbar"><button className="icon-btn" onClick={() => nav(`/${skill}`)}><ArrowLeft size={20} /></button><div className="topbar__title"><small>Thi thử</small><strong>{SKILL_META[skill].label} – {want} bài, {minutes} phút</strong></div></div>
        <p className="lead">Chọn {want} bài (hoặc bấm ngẫu nhiên). Một đồng hồ chung, nộp một lần, chấm trên tổng {sel.reduce((n, x) => n + x.groups.reduce((k, g) => k + g.questions.length, 0), 0)} câu rồi quy về thang 40 câu → band.</p>
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
  if (!m) return null;
  return (
    <div className="page page--wide page--practice" style={{ ['--skill' as string]: SKILL_META[skill].color }}>
      <div className="topbar topbar--sticky">
        <button className="icon-btn" onClick={() => confirm('Thoát thi thử? Bài làm sẽ mất.') && nav(`/${skill}`)}><ArrowLeft size={20} /></button>
        <div className="topbar__title"><small>Thi thử {SKILL_META[skill].label} · {isR ? 'Passage' : 'Section'} {cur + 1}/{sel.length}</small><strong>{m.title}</strong></div>
        <div className="topbar__actions">{!checked && <Timer key={picked.join()} minutes={minutes} onEnd={submit} autoStart />}</div>
        <div className="topbar__progress" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      {checked && res && (
        <div className="final card">
          <div className="final__head">
            <div><strong style={{ fontSize: 28 }}>{score}/{total}</strong><div className="muted small">câu đúng</div></div>
            <div><strong style={{ fontSize: 28 }}>Band {fmtBand(band)}</strong><div className="muted small">ước tính</div></div>
          </div>
          <table className="table final__table"><tbody>{sel.map((x, i) => <tr key={x.id}><td>{x.title}</td><td>{res[i].score}/{res[i].max}</td></tr>)}</tbody></table>
        </div>
      )}
      <div className="tabs">{sel.map((x, i) => <button key={x.id} className={`tabs__btn${cur === i ? ' is-on' : ''}`} onClick={() => { setCur(i); stopAudio(); }}>{isR ? 'Passage' : 'Section'} {i + 1}</button>)}</div>
      {isR ? <ReadingPart m={m as ReadingMaterial} answers={answers[m.id] ?? {}} onChange={(no, a) => setAnswers((s) => ({ ...s, [m.id]: { ...(s[m.id] ?? {}), [no]: a } }))} checked={checked} />
        : <ListeningPart key={m.id} m={m as ListeningMaterial} answers={answers[m.id] ?? {}} onChange={(no, a) => setAnswers((s) => ({ ...s, [m.id]: { ...(s[m.id] ?? {}), [no]: a } }))} checked={checked} />}
      {!checked && (
        <div className="actionbar"><div className="actionbar__inner">
          <span className="result">{done}/{total} câu</span>
          {cur < sel.length - 1 ? <button className="btn btn--ghost" onClick={() => { setCur(cur + 1); stopAudio(); }}>{isR ? 'Passage' : 'Section'} tiếp</button> : null}
          <button className="btn btn--primary" onClick={() => confirm('Nộp toàn bộ bài thi?') && submit()}><Check size={18} /> Nộp bài</button>
        </div></div>
      )}
    </div>
  );
}

function ReadingPart({ m, answers, onChange, checked }: { m: ReadingMaterial; answers: Answers; onChange: (no: number, a: Answers[number]) => void; checked: boolean }) {
  const [tab, setTab] = useState<'passage' | 'questions'>('passage');
  const paras = paragraphs(m.passage);
  return (
    <>
      <div className="tabs tabs--mobile"><button className={`tabs__btn${tab === 'passage' ? ' is-on' : ''}`} onClick={() => setTab('passage')}>Bài đọc</button><button className={`tabs__btn${tab === 'questions' ? ' is-on' : ''}`} onClick={() => setTab('questions')}>Câu hỏi</button></div>
      <div className="split">
        <section className={`split__pane split__pane--passage${tab !== 'passage' ? ' hide-sm' : ''}`}>
          <article className="passage passage--reading"><h2>{m.title}</h2>{paras.map((p, i) => { const { label, text } = paraLabel(p); return <p key={i} className="passage__p">{label && <span className="passage__label">{label}</span>}{text}</p>; })}</article>
        </section>
        <section className={`split__pane${tab !== 'questions' ? ' hide-sm' : ''}`}><GroupsView groups={m.groups} note={m.note} answers={answers} onChange={onChange} checked={checked} /></section>
      </div>
    </>
  );
}

function ListeningPart({ m, answers, onChange, checked }: { m: ListeningMaterial; answers: Answers; onChange: (no: number, a: Answers[number]) => void; checked: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const sp = useScriptSpeaker(m);
  const once = useRef(false);
  useEffect(() => { if (m.audio) resolveUrl(m.audio).then(setSrc); }, [m.audio]);
  return (
    <>
      {m.audio ? <AudioPlayer src={src} label={m.title} /> : (
        <div className="audio">
          <button className="audio__play" onClick={() => { if (sp.line === null) { once.current = true; sp.play(); } else sp.halt(); }}>{sp.line === null ? <Play size={22} fill="currentColor" /> : <Pause size={22} fill="currentColor" />}</button>
          <div className="audio__body"><div className="audio__label">Giọng đọc máy – như thi thật, nên chỉ nghe một lần</div><div className="audio__meta"><span>{sp.line === null ? (once.current ? 'Đã phát' : 'Bấm để nghe') : `Dòng ${sp.line + 1}/${sp.lines.length}`}</span></div></div>
        </div>
      )}
      <GroupsView groups={m.groups} note={m.note} answers={answers} onChange={onChange} checked={checked} />
    </>
  );
}
