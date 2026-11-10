// Speaking: Part 1 / 2 / 3 – máy đọc câu hỏi, ghi âm + nhận dạng giọng nói, nghe lại, so với mẫu, AI chấm theo band descriptors.
import { useEffect, useState } from 'react';
import Timer from '../components/Timer';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, FileCheck2, Loader2, Sparkles, Timer as TimerIcon, Volume2 } from 'lucide-react';
import type { SpeakingMaterial } from '../types';
import { addAttempt, getState, saveBlob, updateAttempt, useDb } from '../db';
import { AiMissing } from '../components/AiGuide';
import { aiReady, getAiConfig, setLastOpen, touchStreak, useAiConfig } from '../store';
import SelfCheck from '../components/SelfCheck';
import Recorder, { speechRecognitionAvailable, type Recording } from '../components/Recorder';
import { speak, stopSpeak } from '../lib/tts';
import { Collapse } from '../components/ui';
import { SpeakingGradeView } from '../components/GradeViews';
import type { SpeakingGrade, SpeakingTurn } from '../ai/speaking';
import { DeckSelect, SaveWordBtn, useDeckChoice } from '../components/DeckPicker';
import { SKILL_META } from './SkillList';

type Part = 1 | 2 | 3;
interface Turn { question: string; rec?: Recording; transcript: string; sample?: string }

export default function Speaking() {
  const { id } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const [deck, setDeck] = useDeckChoice(id);
  const m = db.materials[id!] as SpeakingMaterial | undefined;
  const [part, setPart] = useState<Part>(m?.part1?.length ? 1 : m?.part2 ? 2 : 3);
  const [turns, setTurns] = useState<Record<Part, Turn[]>>({ 1: [], 2: [], 3: [] });
  const [grade, setGrade] = useState<Record<Part, SpeakingGrade | null>>({ 1: null, 2: null, 3: null });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  /** Part 2: null → 'prep' (1 phút chuẩn bị) → 'talk' (2 phút nói) → 'done'. */
  const [phase, setPhase] = useState<null | 'prep' | 'talk' | 'done'>(null);
  const [notes, setNotes] = useState('');
  const [pron, setPron] = useState(0);
  /** Part đã nộp → id bản ghi lịch sử (để AI chấm sau đó cập nhật cùng bản ghi). */
  const [handed, setHanded] = useState<Partial<Record<Part, string>>>({});
  const cfg = useAiConfig();

  useEffect(() => {
    if (!m) return;
    setLastOpen(m.id, `/speaking/${m.id}`, 'practice');
    const p1 = (m.part1 ?? []).flatMap((t) => t.questions.map((q, i) => ({ question: q, transcript: '', sample: t.samples?.[i] })));
    const p2 = m.part2 ? [{ question: `${m.part2.cue} You should say: ${m.part2.points.join('; ')}.`, transcript: '', sample: m.part2.sample }, ...(m.part2.followUp ?? []).map((q) => ({ question: q, transcript: '' }))] : [];
    const p3 = (m.part3?.questions ?? []).map((q, i) => ({ question: q, transcript: '', sample: m.part3?.samples?.[i] }));
    setTurns({ 1: p1, 2: p2, 3: p3 });
    setGrade({ 1: null, 2: null, 3: null });
    setPhase(null); setNotes(''); setHanded({}); setErr('');
    touchStreak();
    return () => { stopSpeak(); };
  }, [id]); // eslint-disable-line

  if (!m) return <div className="page"><p className="empty">Không tìm thấy bài.</p></div>;
  const list = turns[part];
  const update = (i: number, patch: Partial<Turn>) => setTurns((t) => ({ ...t, [part]: t[part].map((x, k) => (k === i ? { ...x, ...patch } : x)) }));
  const doGrade = async () => {
    const answered: SpeakingTurn[] = list.filter((t) => t.transcript.trim()).map((t) => ({ question: t.question, answer: t.transcript, seconds: t.rec?.seconds }));
    if (!answered.length) return setErr('Chưa có câu trả lời nào (ghi âm hoặc gõ transcript).');
    setBusy(true); setErr('');
    try {
      const { gradeSpeaking } = await import('../ai/speaking');
      const g = await gradeSpeaking(part, m.topic ?? m.title, answered, getAiConfig(), pron || undefined);
      setGrade((x) => ({ ...x, [part]: g }));
      const h = handed[part];
      // Giữ bản ghi âm: đã nộp → lấy lại khoá blob đã lưu; chưa nộp → lưu blob bây giờ.
      const prev = h ? ((getState().attempts.find((a) => a.id === h)?.detail as { turns?: { question: string; audio?: string }[] } | undefined)?.turns ?? []) : [];
      const withAudio = [];
      for (const t of list.filter((x) => x.transcript.trim())) {
        let audio = prev.find((p) => p.question === t.question)?.audio;
        if (!audio && t.rec?.blob) { try { audio = await saveBlob(t.rec.blob); } catch { /* hết chỗ */ } }
        withAudio.push({ question: t.question, answer: t.transcript, seconds: t.rec?.seconds, audio });
      }
      if (h) await updateAttempt(h, { mode: 'ai', band: g.overall, detail: { part, turns: withAudio, grade: g } });
      else await addAttempt({ materialId: m.id, skill: 'speaking', title: `${m.title} – Part ${part}`, mode: 'ai', band: g.overall, detail: { part, turns: withAudio, grade: g } });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const handIn = async () => {
    const done = list.filter((t) => t.rec || t.transcript.trim());
    if (!done.length) return setErr('Chưa có câu trả lời nào (ghi âm hoặc gõ câu trả lời).');
    setErr('');
    const saved = [];
    for (const t of done) {
      let audio: string | undefined;
      if (t.rec?.blob) { try { audio = await saveBlob(t.rec.blob); } catch { /* hết chỗ lưu → bỏ qua bản ghi */ } }
      saved.push({ question: t.question, answer: t.transcript, seconds: t.rec?.seconds, audio });
    }
    const a = await addAttempt({ materialId: m.id, skill: 'speaking', title: `${m.title} – Part ${part}`, mode: 'self', score: done.length, max: list.length, detail: { part, turns: saved } });
    setHanded((x) => ({ ...x, [part]: a.id }));
    window.setTimeout(() => document.getElementById('self-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const g = grade[part];
  const handedId = handed[part];
  const parts: Part[] = ([1, 2, 3] as Part[]).filter((p) => (p === 1 ? m.part1?.length : p === 2 ? m.part2 : m.part3));

  return (
    <div className="page page--practice" style={{ ['--skill' as string]: SKILL_META.speaking.color }}>
      <div className="topbar topbar--sticky">
        <button className="icon-btn" onClick={() => nav('/speaking')} aria-label="Quay lại"><ArrowLeft size={20} /></button>
        <div className="topbar__title"><small>Speaking</small><strong>{m.title}</strong></div>
      </div>
      <div className="tabs">
        {parts.map((p) => <button key={p} className={`tabs__btn${part === p ? ' is-on' : ''}`} onClick={() => setPart(p)}>Part {p}{grade[p] && ` · ${grade[p]!.overall}`}</button>)}
        {m.vocab?.length ? <button className={`tabs__btn${part === 0 as unknown as Part ? ' is-on' : ''}`} onClick={() => setPart(0 as Part)}>Từ vựng</button> : null}
      </div>

      {(part as number) === 0 && (
        <div className="stack"><DeckSelect from={m.id} value={deck} onChange={setDeck} /><ul className="vlist card">{m.vocab!.map((v, i) => (
          <li key={i} className="vlist__row"><div className="vlist__body"><strong className="vocab__w">{v[0]}</strong> <em className="vocab__pos">{v[1]}</em><div className="vocab__vi">{v[2]}</div>{v[3] && <div className="vocab__ex">{v[3]}</div>}</div>
            <SaveWordBtn deck={deck} f={{ word: v[0], pos: v[1], meaning: v[2], example: v[3], from: m.id }} /></li>))}</ul></div>
      )}

      {part === 2 && m.part2 && (
        <div className="cue card">
          <div className="cue__head"><span className="badge">Part 2 · Cue card</span>
            <div className="row">
              {phase === null && <button className="btn btn--ghost btn--sm" onClick={() => setPhase('prep')}><TimerIcon size={15} /> Chuẩn bị 1 phút</button>}
              {phase === 'prep' && <><Timer key="prep" minutes={1} label="Chuẩn bị" warnAt={10} autoStart onEnd={() => setPhase('talk')} /><button className="btn btn--text btn--sm" onClick={() => setPhase('talk')}>Nói luôn</button></>}
              {phase === 'talk' && <Timer key="talk" minutes={2} label="Nói" warnAt={15} autoStart onEnd={() => setPhase('done')} />}
              {phase === 'done' && <><span className="timer is-out">Hết 2 phút</span><button className="btn btn--text btn--sm" onClick={() => setPhase('prep')}>Làm lại</button></>}
            </div>
          </div>
          <h2 className="cue__title">{m.part2.cue}</h2>
          <p>You should say:</p>
          <ul className="cue__points">{m.part2.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
          <textarea className="textarea" rows={3} placeholder="Ghi chú nhanh trong 1 phút chuẩn bị (từ khoá, ý chính)…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}
      {part === 1 && <p className="muted small">Part 1 (4–5 phút): trả lời 2–4 câu mỗi câu hỏi, mở rộng bằng lý do / ví dụ. Bấm 🔊 để nghe giám khảo đọc câu hỏi, rồi ghi âm.</p>}
      {part === 3 && <p className="muted small">Part 3 (4–5 phút): câu hỏi trừu tượng, cần quan điểm + lý do + ví dụ + mặt khác. Dùng cấu trúc: "It depends on… / On the one hand… / The main reason is…".</p>}
      {!speechRecognitionAvailable() && <div className="banner"><Bot size={18} /><span>Trình duyệt này không có nhận dạng giọng nói (hãy dùng Chrome/Edge). Bạn vẫn ghi âm được; để AI chấm, gõ lại transcript vào ô bên dưới mỗi câu.</span></div>}

      <div className="turns">
        {list.map((t, i) => (
          <TurnView key={`${part}-${i}`} t={t} i={i} part={part} showSample={!!handedId} onRec={(r) => update(i, { rec: r, transcript: r.transcript || t.transcript })} onTranscript={(v) => update(i, { transcript: v })} fb={g?.perQuestion.find((q) => q.question === t.question) ?? (g ? g.perQuestion[list.filter((x) => x.transcript.trim()).indexOf(t)] : undefined)} />
        ))}
      </div>

      {(part as number) !== 0 && (
        <section className="card pad">
          <div className="row wrap">
            <button className="btn btn--primary btn--grow" onClick={handIn} disabled={!!handedId}><FileCheck2 size={16} /> {handedId ? `Đã nộp Part ${part}` : `Nộp bài Part ${part}`}</button>
            {aiReady(cfg) && <button className="btn btn--ghost btn--grow" onClick={doGrade} disabled={busy}>{busy ? <><Loader2 size={16} className="spin" /> Đang chấm…</> : <><Bot size={16} /> Chấm bằng AI ({list.filter((t) => t.transcript.trim()).length} câu)</>}</button>}
          </div>
          {aiReady(cfg) && (
            <label className="small muted">Tự đánh giá phát âm cho AI (tuỳ chọn):{' '}
              <select className="select" value={pron} onChange={(e) => setPron(+e.target.value)}><option value={0}>Không chấm</option>{[5, 5.5, 6, 6.5, 7, 7.5, 8].map((b) => <option key={b} value={b}>{b}</option>)}</select>
            </label>
          )}
          {!aiReady(cfg) && <><p className="small muted">Nộp bài để lưu bản ghi / câu trả lời vào Lịch sử, mở bài mẫu từng câu và tự chấm.</p><AiMissing /></>}
          {err && <p className="no-text small">{err}</p>}
        </section>
      )}
      {handedId && (part as number) !== 0 && <div id="self-result"><SelfCheck key={handedId} kind="speaking" attemptId={handedId} extra="Nghe lại bản ghi của bạn rồi so với bài mẫu dưới mỗi câu." /></div>}

      {g && <SpeakingGradeView g={g} part={part} from={m.id} />}
    </div>
  );
}

function TurnView({ t, i, part, onRec, onTranscript, fb, showSample }: { t: Turn; i: number; part: Part; showSample?: boolean; onRec: (r: Recording) => void; onTranscript: (v: string) => void; fb?: SpeakingGrade['perQuestion'][number] }) {
  const [edit, setEdit] = useState(false);
  return (
    <div className="turn card">
      <div className="turn__q">
        <span className="turn__no">{part === 2 && i === 0 ? '2' : `${part}.${i + 1}`}</span>
        <p>{part === 2 && i === 0 ? 'Nói 1–2 phút theo cue card' : t.question}</p>
        {!(part === 2 && i === 0) && <button className="icon-btn" onClick={() => speak(t.question, { voice: 'en-GB', rate: 0.95 })} aria-label="Nghe câu hỏi"><Volume2 size={18} /></button>}
      </div>
      <Recorder onDone={onRec} maxSeconds={part === 2 && i === 0 ? 120 : 60} label={part === 2 && i === 0 ? 'Ghi âm bài nói 2 phút' : 'Ghi âm câu trả lời (tối đa 1 phút)'} />
      {t.rec && (
        <div className="turn__rec">
          <audio src={t.rec.url} controls className="audio-native" />
          <span className="small muted">{t.rec.seconds}s{t.transcript && ` · ${t.transcript.split(/\s+/).length} từ`}</span>
        </div>
      )}
      {(t.rec || edit || t.transcript) && (
        <div className="turn__tr">
          <div className="row-between"><span className="small muted">Transcript (sửa được nếu máy nghe sai):</span>{!edit && <button className="btn btn--text btn--sm" onClick={() => setEdit(true)}>Sửa</button>}</div>
          {edit ? <textarea className="textarea" rows={3} value={t.transcript} onChange={(e) => onTranscript(e.target.value)} onBlur={() => setEdit(false)} autoFocus /> : <p className="turn__text" onClick={() => setEdit(true)}>{t.transcript || <em className="muted">Chưa có transcript – bấm để gõ</em>}</p>}
        </div>
      )}
      {!t.rec && !t.transcript && <button className="btn btn--text btn--sm" onClick={() => setEdit(true)}>Hoặc gõ câu trả lời</button>}
      {fb && (
        <div className="turn__fb">
          <p><strong>Nhận xét:</strong> {fb.comment}</p>
          {fb.corrections.length > 0 && <ul className="fb-fixes">{fb.corrections.map((c, k) => <li key={k}><span className="fb-from">{c.original}</span> → <span className="fb-to">{c.corrected}</span> <span className="fb-why">{c.explanation}</span></li>)}</ul>}
          <Collapse title="Câu trả lời mẫu AI (band 7–8, giữ ý của bạn)" tone="tip"><p className="sample">{fb.improved}</p></Collapse>
        </div>
      )}
      {t.sample && <Collapse key={String(!!showSample)} defaultOpen={showSample} title="Bài mẫu tham khảo" tone="info"><p className="sample">{t.sample}</p></Collapse>}
    </div>
  );
}
