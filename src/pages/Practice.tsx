// Chế độ LUYỆN TẬP cho Reading / Listening (khác chế độ Thi thử):
// không bấm giờ, bấm từ để tra nghĩa tiếng Việt và lưu vào vốn từ, dịch từng đoạn/câu,
// kiểm tra từng câu và xem giải thích ngay, ghi chú riêng cho bài.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Eraser, Eye, EyeOff, Languages, Loader2, Pause, Play, RotateCcw, StickyNote, Timer, Volume2 } from 'lucide-react';
import type { ListeningMaterial, ReadingMaterial } from '../types';
import { addAttempt, getState, resolveUrl, saveNote, useDb } from '../db';
import { rawToBand } from '../lib/band';
import { getSettings, setLastOpen, touchStreak } from '../store';
import { GroupsView, isCorrect, scoreGroups, type Answers } from '../components/Questions';
import { ExamFrame, ExamNav, ExamSplit, answeredNos, focusQuestion, groupNos, qNos } from '../components/Exam';
import AudioPlayer, { stopAudio } from '../components/AudioPlayer';
import WordPopover, { type WordSel } from '../components/WordPopover';
import { HighlightBar, HlText, colorMap, useHighlights } from '../components/Highlight';
import { paragraphs, paraLabel, sentences } from '../lib/text';
import { ttsAvailable } from '../lib/tts';
import { translateText } from '../lib/freeTranslate';
import { SKILL_META } from './SkillList';
import { partLabel, saveMode, testOf } from '../lib/tests';
import { useScriptSpeaker } from './ListeningTest';
import { bareTitle } from './MockTest';

type Tr = Record<number, string | 'busy'>;

export default function Practice() {
  const { id } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const m = db.materials[id!] as ReadingMaterial | ListeningMaterial | undefined;
  const isL = m?.skill === 'listening';
  const [answers, setAnswers] = useState<Answers>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [all, setAll] = useState(false);
  const [sel, setSel] = useState<WordSel | null>(null);
  const [tr, setTr] = useState<Tr>({});
  const [showAllVi, setShowAllVi] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'text' | 'questions'>(isL ? 'questions' : 'text');
  const [showScript, setShowScript] = useState(false);
  const [note, setNote] = useState(db.notes[id!]?.text ?? '');
  const [src, setSrc] = useState<string | null>(null);
  const [curNo, setCurNo] = useState<number | null>(null);
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const noteTimer = useRef(0);
  const openedAt = useRef(Date.now());
  const hl = useHighlights(id);
  const sp = useScriptSpeaker(isL ? (m as ListeningMaterial) : undefined);
  // Các phần cùng đề (Passage 1–3 / Section 1–4) để chuyển qua lại khi luyện cả đề.
  const test = useMemo(() => (id ? testOf(db.materials, id) : undefined), [db.materials, id]);
  const multi = test && test.parts.length > 1 ? test : undefined;
  const idx = multi ? multi.parts.findIndex((x) => x.id === id) : -1;
  const next = multi && idx >= 0 ? multi.parts[idx + 1] : undefined;

  useEffect(() => {
    touchStreak();
    if (m) saveMode(m.skill, 'practice');
    if (m) setLastOpen(m.id, `/${m.skill}/${m.id}/practice`, 'practice');
    setAnswers({}); setRevealed({}); setAll(false); setTr({}); setShowScript(false); setCurNo(null); setFlags(new Set()); setNote(db.notes[id!]?.text ?? ''); openedAt.current = Date.now();
    if (isL && (m as ListeningMaterial).audio) resolveUrl((m as ListeningMaterial).audio!).then(setSrc); else setSrc(null);
    window.scrollTo(0, 0);
    return () => stopAudio();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const text = m ? (isL ? (m as ListeningMaterial).transcript : (m as ReadingMaterial).passage) : '';
  const paras = useMemo(() => (isL ? text.split('\n').map((l) => l.trim()).filter(Boolean) : paragraphs(text)), [text, isL]);
  if (!m) return <div className="page"><p className="empty">Không tìm thấy bài.</p></div>;

  const meta = SKILL_META[m.skill];
  const stored = m.translation ?? [];
  const total = m.groups.reduce((n, g) => n + g.questions.length, 0);
  const done = Object.values(answers).filter((a) => a !== null && a !== '' && !(Array.isArray(a) && !a.length)).length;
  const checkedNos = all ? m.groups.flatMap((g) => g.questions.map((q) => q.no)) : Object.keys(revealed).map(Number);
  const res = scoreGroups(m.groups.map((g) => ({ ...g, questions: g.questions.filter((q) => checkedNos.includes(q.no)) })), answers);
  const hasScript = isL && !!text.trim();
  const listenAudio = isL && !!(m as ListeningMaterial).audio;

  const translatePara = async (i: number) => {
    if (stored[i] || tr[i]) { setTr((t) => { const n = { ...t }; if (n[i] && n[i] !== 'busy') delete n[i]; else n[i] = stored[i]; return n; }); return; }
    setTr((t) => ({ ...t, [i]: 'busy' })); setErr('');
    try {
      const body = paraLabel(paras[i]).text.replace(/^\[\d+:\d\d\]\s*/, '').replace(/^[^:]{1,30}:\s*/, isL ? '' : '$&');
      const vi = await translateText(body);
      setTr((t) => ({ ...t, [i]: vi }));
    } catch (e) { setTr((t) => { const n = { ...t }; delete n[i]; return n; }); setErr(e instanceof Error ? e.message : String(e)); }
  };
  const viOf = (i: number) => (tr[i] && tr[i] !== 'busy' ? tr[i] : showAllVi ? stored[i] : undefined);
  const onNote = (t: string) => {
    setNote(t);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => saveNote({ materialId: m.id, text: t, highlights: getState().notes[m.id]?.highlights ?? [], updatedAt: Date.now() }), 600);
  };
  const reset = () => { setAnswers({}); setRevealed({}); setAll(false); };
  /** Kiểm tra tất cả → lưu một lượt "Luyện tập" (không tính vào band trang chủ). */
  const checkAll = () => {
    setAll(true);
    const r = scoreGroups(m.groups, answers);
    addAttempt({ materialId: m.id, skill: m.skill, title: m.title, mode: 'practice', score: r.score, max: r.max, band: rawToBand(m.skill, r.score, r.max, (m as ReadingMaterial).module ?? getSettings().module),
      detail: { answers, wrong: r.wrong, minutes: Math.max(1, Math.round((Date.now() - openedAt.current) / 60000)) } });
  };

  const textPane = (
    <article className={`passage ${isL ? 'passage--script' : 'passage--reading'} passage--practice`}>
      {!isL && <h2>{bareTitle(m)}</h2>}
      {paras.map((p, i) => {
        const { label, text: t } = paraLabel(p);
        const sm = isL ? t.match(/^([A-Z][A-Za-z .']{0,24}):\s*/) : null;
        const ts = isL ? t.match(/^\[(\d+:\d\d)\]\s*/) : null;
        let body = t;
        let speaker = '';
        if (isL) {
          body = body.replace(/^\[\d+:\d\d\]\s*/, '');
          const s2 = body.match(/^([^:]{1,30}):\s*/);
          if (s2) { speaker = s2[1]; body = body.slice(s2[0].length); }
        } else if (sm) { speaker = sm[1]; body = t.slice(sm[0].length); }
        body = body.replace(/\s+/g, ' ').trim();
        const map = colorMap(body, hl.list);
        let cur = 0;
        const vi = viOf(i);
        return (
          <div key={i} className={`pp${sp.line === i ? ' is-reading' : ''}`}>
            <div className="pp__en">
              {label && <span className="passage__label">{label}</span>}
              {ts && <span className="pp__ts">{ts[1]}</span>}
              {speaker && <strong className="pp__speaker">{speaker}:</strong>}{' '}
              {sentences(body).map((s, si) => {
                const off = body.indexOf(s, cur); cur = off + s.length;
                return <span key={si}><HlText text={s} map={map} offset={off} onWord={setSel} />{' '}</span>;
              })}
              <button className={`pp__tr${vi ? ' is-on' : ''}`} onClick={() => translatePara(i)} title={vi ? 'Ẩn bản dịch' : 'Dịch đoạn này'} aria-label="Dịch đoạn">
                {tr[i] === 'busy' ? <Loader2 size={13} className="spin" /> : <Languages size={13} />}
              </button>
            </div>
            {vi && <p className="pp__vi">{vi}</p>}
          </div>
        );
      })}
    </article>
  );

  const questionsPane = (
    <>
      <GroupsView groups={m.groups} note={m.note} answers={answers} onChange={(no, a) => setAnswers((s) => ({ ...s, [no]: a }))} checked={all}
        revealed={revealed} onReveal={(no) => setRevealed((r) => ({ ...r, [no]: true }))} />
      <section className="xnotes">
        <strong><StickyNote size={15} /> Ghi chú của bạn</strong>
        <textarea rows={4} value={note} onChange={(e) => onNote(e.target.value)} placeholder="Ý chính từng đoạn, cấu trúc hay, bẫy đã mắc… (tự lưu)" />
      </section>
    </>
  );

  // Khung máy thi: Part theo đề gốc, số câu ở thanh dưới; công cụ luyện tập trên thanh trên.
  const nos = groupNos(m.groups);
  const range = nos.length ? `${nos[0]}–${nos[nos.length - 1]}` : '';
  const parts = multi ? multi.parts.map((x) => ({ label: `Part ${partNum(x)}`, nos: x.id === m.id ? nos : groupNos((x as ReadingMaterial).groups ?? []), href: `#/${x.skill}/${x.id}/practice` })) : [{ label: `Part ${partNum(m)}`, nos }];
  const curPart = multi ? Math.max(0, idx) : 0;
  const answered = parts.map((_, i) => (i === curPart ? answeredNos(m.groups, answers) : new Set<number>()));
  const results = checkedNos.length ? new Map(m.groups.flatMap((g) => g.questions.filter((q) => checkedNos.includes(q.no)).flatMap((q) => qNos(q).map((n) => [n, isCorrect(q, answers[q.no] ?? null)] as const)))) : undefined;
  const trackFocus = (e: React.SyntheticEvent) => { const q = (e.target as HTMLElement).closest?.('[id^="q-"]'); if (q) setCurNo(+q.id.slice(2)); };
  const exitTo = test ? `/test/${m.skill}/${test.key}` : `/${m.skill}`;
  const tools = (
    <>
      {stored.length > 0 && (!isL || hasScript) && <button className={`xtool${showAllVi ? ' is-on' : ''}`} onClick={() => setShowAllVi(!showAllVi)} title="Hiện bản dịch tiếng Việt cả bài"><Languages size={15} /> <span>Dịch cả bài</span></button>}
      {hasScript && <button className={`xtool${showScript ? ' is-on' : ''}`} onClick={() => setShowScript(!showScript)} title="Nên nghe và làm trước, sau đó mở transcript để dò lại và học từ">{showScript ? <EyeOff size={15} /> : <Eye size={15} />} <span>Transcript</span></button>}
      {hl.list.length > 0 && <button className="xtool" onClick={hl.clear} title="Xoá hết highlight"><Eraser size={15} /> <span>{hl.list.length}</span></button>}
      {(all || checkedNos.length > 0) && <button className="xtool" onClick={reset} title="Làm lại"><RotateCcw size={15} /> <span>Làm lại</span></button>}
      <Link to={`/${m.skill}/${m.id}`} className="xtool mode-switch" title="Thi thử bài này: bấm giờ, nộp một lần"><Timer size={15} /> <span>Thi thử</span></Link>
    </>
  );
  const status = <span className="xhead__status">Luyện tập · {done}/{total} câu{checkedNos.length > 0 && <> · đúng <strong>{res.score}/{res.max}</strong></>}</span>;
  const qPane = (
    <div onFocusCapture={trackFocus} onClickCapture={trackFocus}>
      <p className="small xtip">Không tính giờ. <b>Bấm vào một từ</b> để tra nghĩa · <b>bôi đen</b> để highlight · <Languages size={12} /> cuối {isL ? 'lượt lời' : 'đoạn'} để dịch · <em>Kiểm tra câu này</em> (câu điền: <Eye size={12} />) để xem đáp án và giải thích.</p>
      {err && <p className="no-text small">{err}</p>}
      {questionsPane}
    </div>
  );
  const audioBox = isL && (
    <div className="xpractice-audio">
      {listenAudio ? <AudioPlayer src={src} label={m.title} /> : hasScript ? (
        <div className="audio">
          <button className="audio__play" onClick={() => (sp.line === null ? sp.play() : sp.halt())} disabled={!ttsAvailable()} aria-label="Phát">{sp.line === null ? <Play size={22} fill="currentColor" /> : <Pause size={22} fill="currentColor" />}</button>
          <div className="audio__body">
            <div className="audio__label">Giọng đọc máy (chưa có file audio)</div>
            <div className="audio__meta"><span>{sp.line === null ? `${sp.lines.length} lượt lời` : `Đang đọc dòng ${sp.line + 1}/${sp.lines.length}`}</span></div>
          </div>
          <Volume2 size={18} className="muted" />
        </div>
      ) : <div className="banner"><span>Đề này chưa có audio và bộ đề gốc không có transcript, nên chỉ luyện được phần câu hỏi (đáp án theo key gốc).</span></div>}
    </div>
  );

  return (
    <ExamFrame onExit={() => nav(exitTo)} status={status} tools={tools}
      banner={{ title: parts[curPart].label, text: isL ? `Listen and answer questions ${range}.` : `Read the text and answer questions ${range}.` }}
      footer={<ExamNav parts={parts} cur={curPart} curNo={curNo} answered={answered} flagged={flags} results={results}
        onPart={(i) => multi && nav(`/${multi.parts[i].skill}/${multi.parts[i].id}/practice`)}
        onGo={(no, pi) => { if (pi !== curPart && multi) nav(`/${multi.parts[pi].skill}/${multi.parts[pi].id}/practice`); else { setCurNo(no); focusQuestion(no); } }}
        onFlag={(no) => setFlags((f) => { const x = new Set(f); if (x.has(no)) x.delete(no); else x.add(no); return x; })}
        onSubmit={all ? (next ? () => nav(`/${next.skill}/${next.id}/practice`) : undefined) : checkAll}
        submitLabel={all ? (next ? `Sang ${partLabel(next)}` : 'Đã kiểm tra') : 'Kiểm tra tất cả'} />}>
      {isL ? (
        <>
          {audioBox}
          {showScript && hasScript ? <ExamSplit left={textPane} right={qPane} labels={['Transcript', `Câu hỏi (${done}/${total})`]} storeKey="ielts:practice-split" /> : <div className="xsingle">{qPane}</div>}
        </>
      ) : <ExamSplit left={textPane} right={qPane} labels={['Passage', `Questions (${done}/${total})`]} storeKey="ielts:practice-split" />}
      <HighlightBar scopeClass="passage" onAdd={hl.add} onRemove={hl.remove} />
      {sel && <WordPopover sel={sel} vocab={m.vocab} from={m.id} onClose={() => setSel(null)} />}
    </ExamFrame>
  );
}

/** Số Part theo đề gốc: Passage 2 / Section 3 → 2 / 3. */
function partNum(x: { skill: string; id: string; section?: number } & object) {
  if (x.skill === 'listening' && 'section' in x && x.section) return x.section;
  return +(partLabel(x as Parameters<typeof partLabel>[0]).match(/\d+/)?.[0] ?? 1);
}
