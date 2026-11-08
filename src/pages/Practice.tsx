// Chế độ LUYỆN TẬP cho Reading / Listening (khác chế độ Thi thử):
// không bấm giờ, bấm từ để tra nghĩa tiếng Việt và lưu sổ từ, dịch từng đoạn/câu,
// kiểm tra từng câu và xem giải thích ngay, ghi chú riêng cho bài.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Eye, EyeOff, Languages, Loader2, Pause, Play, RotateCcw, StickyNote, Volume2 } from 'lucide-react';
import type { ListeningMaterial, ReadingMaterial } from '../types';
import { getState, resolveUrl, saveNote, useDb } from '../db';
import { setLastOpen, touchStreak } from '../store';
import { GroupsView, scoreGroups, type Answers } from '../components/Questions';
import AudioPlayer, { stopAudio } from '../components/AudioPlayer';
import WordPopover, { type WordSel } from '../components/WordPopover';
import { HighlightBar, HlText, colorMap, useHighlights } from '../components/Highlight';
import { paragraphs, paraLabel, sentences } from '../lib/text';
import { ttsAvailable } from '../lib/tts';
import { translateText } from '../lib/freeTranslate';
import { SKILL_META } from './SkillList';
import { useScriptSpeaker } from './ListeningTest';

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
  const noteTimer = useRef(0);
  const hl = useHighlights(id);
  const sp = useScriptSpeaker(isL ? (m as ListeningMaterial) : undefined);

  useEffect(() => {
    touchStreak();
    if (m) setLastOpen(m.id, `/${m.skill}/${m.id}/practice`, 'practice');
    setAnswers({}); setRevealed({}); setAll(false); setTr({}); setShowScript(false); setNote(db.notes[id!]?.text ?? '');
    if (isL && (m as ListeningMaterial).audio) resolveUrl((m as ListeningMaterial).audio!).then(setSrc); else setSrc(null);
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

  const textPane = (
    <article className={`passage ${isL ? 'passage--script' : 'passage--reading'} passage--practice`}>
      {!isL && <h2>{m.title}</h2>}
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
      <section className="card pad">
        <h3 className="h3"><StickyNote size={16} /> Ghi chú của bạn</h3>
        <textarea className="textarea" rows={4} value={note} onChange={(e) => onNote(e.target.value)} placeholder="Ý chính từng đoạn, cấu trúc hay, bẫy đã mắc… (tự lưu)" />
      </section>
    </>
  );

  return (
    <div className="page page--wide page--practice" style={{ ['--skill' as string]: meta.color }}>
      <div className="topbar topbar--sticky">
        <button className="icon-btn" onClick={() => nav(`/${m.skill}`)} aria-label="Quay lại"><ArrowLeft size={20} /></button>
        <div className="topbar__title"><small>Luyện tập · {meta.label}{isL ? ` · Section ${(m as ListeningMaterial).section ?? '?'}` : ''}</small><strong>{m.title}</strong></div>
        <div className="topbar__actions">
          {stored.length > 0 && (!isL || hasScript) && <button className={`btn btn--sm ${showAllVi ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setShowAllVi(!showAllVi)}><Languages size={15} /> Dịch cả bài</button>}
        </div>
        <div className="topbar__progress" style={{ width: `${(done / total) * 100}%` }} />
      </div>

      <p className="muted small practice-tip">
        Không tính giờ. <strong>Bấm vào một từ</strong> để xem nghĩa tiếng Việt, phiên âm và lưu vào sổ từ ·
        <strong> bôi đen</strong> một đoạn để highlight (5 màu) ·
        bấm <Languages size={12} /> cuối mỗi {isL ? 'lượt lời' : 'đoạn'} để dịch · làm câu nào bấm <em>Kiểm tra câu này</em> để xem đáp án và giải thích ngay.
      </p>
      {hl.list.length > 0 && <p className="small"><button className="btn btn--text btn--sm" onClick={hl.clear}>Xoá hết highlight ({hl.list.length})</button></p>}
      {err && <p className="no-text small">{err}</p>}

      {isL && (
        listenAudio ? <AudioPlayer src={src} label={m.title} /> : hasScript ? (
          <div className="audio">
            <button className="audio__play" onClick={() => (sp.line === null ? sp.play() : sp.halt())} disabled={!ttsAvailable()} aria-label="Phát">{sp.line === null ? <Play size={22} fill="currentColor" /> : <Pause size={22} fill="currentColor" />}</button>
            <div className="audio__body">
              <div className="audio__label">Giọng đọc máy (chưa có file audio)</div>
              <div className="audio__meta"><span>{sp.line === null ? `${sp.lines.length} lượt lời` : `Đang đọc dòng ${sp.line + 1}/${sp.lines.length}`}</span></div>
            </div>
            <Volume2 size={18} className="muted" />
          </div>
        ) : <div className="banner"><span>Đề này chưa có audio và bộ đề gốc không có transcript, nên chỉ luyện được phần câu hỏi (đáp án theo key gốc).</span></div>
      )}

      {isL ? (
        <>
          {hasScript && (
            <div className="row wrap">
              <button className="btn btn--ghost btn--sm" onClick={() => setShowScript(!showScript)}>{showScript ? <><EyeOff size={15} /> Ẩn transcript</> : <><Eye size={15} /> Hiện transcript</>}</button>
              <span className="small muted">Nên nghe và làm trước, sau đó mở transcript để dò lại và học từ.</span>
            </div>
          )}
          {showScript && hasScript ? (
            <>
              <div className="tabs tabs--mobile">
                <button className={`tabs__btn${tab === 'text' ? ' is-on' : ''}`} onClick={() => setTab('text')}>Transcript</button>
                <button className={`tabs__btn${tab === 'questions' ? ' is-on' : ''}`} onClick={() => setTab('questions')}>Câu hỏi ({done}/{total})</button>
              </div>
              <div className="split">
                <section className={`split__pane split__pane--passage${tab !== 'text' ? ' hide-sm' : ''}`}>{textPane}</section>
                <section className={`split__pane split__pane--questions${tab !== 'questions' ? ' hide-sm' : ''}`}>{questionsPane}</section>
              </div>
            </>
          ) : questionsPane}
        </>
      ) : (
        <>
          <div className="tabs tabs--mobile">
            <button className={`tabs__btn${tab === 'text' ? ' is-on' : ''}`} onClick={() => setTab('text')}>Bài đọc</button>
            <button className={`tabs__btn${tab === 'questions' ? ' is-on' : ''}`} onClick={() => setTab('questions')}>Câu hỏi ({done}/{total})</button>
          </div>
          <div className="split">
            <section className={`split__pane split__pane--passage${tab !== 'text' ? ' hide-sm' : ''}`}>{textPane}</section>
            <section className={`split__pane split__pane--questions${tab !== 'questions' ? ' hide-sm' : ''}`}>{questionsPane}</section>
          </div>
        </>
      )}

      <div className="actionbar"><div className="actionbar__inner">
        <span className="result">{done}/{total} đã làm{checkedNos.length > 0 && <> · đúng <strong>{res.score}/{res.max}</strong> câu đã kiểm tra</>}</span>
        {all || checkedNos.length > 0 ? <button className="btn btn--ghost" onClick={reset}><RotateCcw size={16} /> Làm lại</button> : null}
        {!all && <button className="btn btn--primary" onClick={() => setAll(true)}><Check size={18} /> Kiểm tra tất cả</button>}
      </div></div>
      <HighlightBar scopeClass="passage" onAdd={hl.add} onRemove={hl.remove} />
      {sel && <WordPopover sel={sel} vocab={m.vocab} from={m.id} onClose={() => setSel(null)} />}
    </div>
  );
}
