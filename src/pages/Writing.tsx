// Writing: đề + biểu đồ, dàn ý, soạn bài (đếm từ, bấm giờ, tự lưu nháp), AI chấm theo 4 tiêu chí IELTS.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bot, Check, Eye, FileCheck2, Lightbulb, Loader2, Sparkles } from 'lucide-react';
import type { WritingMaterial } from '../types';
import { addAttempt, updateAttempt, resolveUrl, saveDraft, useDb } from '../db';
import { aiReady, getAiConfig, setLastOpen, touchStreak, useAiConfig } from '../store';
import SelfCheck from '../components/SelfCheck';
import { ExamClock, ExamFrame, ExamSheet, ExamSplit } from '../components/Exam';
import ZoomImage from '../components/ZoomImage';
import { Collapse } from '../components/ui';
import { ChartView, DataTable } from '../components/misc';
import { WritingGradeView } from '../components/GradeViews';
import { AiMissing } from '../components/AiGuide';
import { STRUCTURE, TYPE_LABEL, chartsOf, promptParas } from '../lib/writing';
import type { WritingGrade } from '../ai/writing';
import { wordCount } from '../lib/text';
import { DeckSelect, SaveWordBtn, useDeckChoice } from '../components/DeckPicker';

export default function Writing() {
  const { id } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const [deck, setDeck] = useDeckChoice(id);
  const m = db.materials[id!] as WritingMaterial | undefined;
  const key = `w-${id}`;
  const [text, setText] = useState(db.drafts[key] ?? '');
  const [grade, setGrade] = useState<WritingGrade | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; words: number; minutes: number } | null>(null);
  const [aids, setAids] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const cfg = useAiConfig();
  const started = useRef(0); // lúc gõ chữ đầu tiên (đồng hồ bắt đầu)
  const saveT = useRef(0);
  useEffect(() => {
    if (id && db.materials[id]) setLastOpen(id, `/writing/${id}`, 'practice');
    setText(db.drafts[key] ?? '');
    const last = db.attempts.find((a) => a.materialId === id && a.mode === 'ai');
    setGrade((last?.detail as { grade?: WritingGrade } | undefined)?.grade ?? null);
    if (m?.image) resolveUrl(m.image).then(setImg); else setImg(null);
    started.current = 0;
    setDone(null); setErr(''); setShowSample(false);
    touchStreak();
  }, [id]); // eslint-disable-line
  const n = useMemo(() => wordCount(text), [text]);
  if (!m) return <div className="page"><p className="empty">Không tìm thấy bài.</p></div>;
  const min = m.task === 1 ? 150 : 250;
  const minutes = m.task === 1 ? 20 : 40;
  const usedMin = () => (started.current ? Math.max(1, Math.round((Date.now() - started.current) / 60000)) : 0);
  const onText = (v: string) => { if (!started.current && v.trim()) started.current = Date.now(); setText(v); window.clearTimeout(saveT.current); saveT.current = window.setTimeout(() => saveDraft(key, v), 500); };
  const submit = async () => {
    if (n < 30) return setErr('Bài quá ngắn để chấm.');
    setBusy(true); setErr('');
    try {
      const { gradeWriting } = await import('../ai/writing');
      const g = await gradeWriting(m, text, getAiConfig(), usedMin());
      setGrade(g);
      // Đã "Nộp bài" rồi thì nâng bản ghi đó thành bản AI chấm, không tạo 2 dòng lịch sử.
      if (done) await updateAttempt(done.id, { mode: 'ai', band: g.overall, detail: { text, words: n, minutes: done.minutes, grade: g } });
      else await addAttempt({ materialId: m.id, skill: 'writing', title: m.title, mode: 'ai', band: g.overall, detail: { text, words: n, minutes: usedMin(), grade: g } });
      setSheet(true);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const handIn = async () => {
    if (!text.trim()) return setErr('Chưa viết gì.');
    setErr('');
    const minutesUsed = usedMin();
    const a = await addAttempt({ materialId: m.id, skill: 'writing', title: m.title, mode: 'self', score: n, detail: { text, words: n, minutes: minutesUsed } });
    setDone({ id: a.id, words: n, minutes: minutesUsed });
    setSheet(true);
  };

  const sampleBox = m.sample && (showSample
    ? <div className="sample sample--long"><p className="small muted">{m.id.startsWith('wr-') ? 'Bài mẫu do AI viết – để tham khảo cách triển khai, không học thuộc.' : 'Bài mẫu để tham khảo cách triển khai, không học thuộc.'}</p>{m.sample.split(/\n\s*\n|\n/).map((l, i) => <p key={i}>{l}</p>)}</div>
    : <button className="btn btn--ghost btn--sm" onClick={() => setShowSample(true)}><Eye size={15} /> Xem bài mẫu</button>);
  const prompt = (
    <div className="xprompt">
      <TaskPrompt m={m} img={img} />
      {aids && <>
        <Collapse title="Cấu trúc bài gợi ý" tone="tip" defaultOpen={false}>
          <ol className="plan">{(m.outline ?? STRUCTURE[m.type] ?? []).map((o, i) => <li key={i}>{o}</li>)}</ol>
        </Collapse>
        {m.sample && <Collapse title="Bài mẫu (xem sau khi viết xong!)" tone="info">{sampleBox}</Collapse>}
        {m.vocab?.length ? (
          <Collapse title={`Từ vựng gợi ý (${m.vocab.length})`} tone="info">
            <DeckSelect from={m.id} value={deck} onChange={setDeck} />
            <ul className="vlist" data-testid="w-vocab">{m.vocab.map((v, i) => <li key={i} className="vlist__row"><div className="vlist__body"><strong className="vocab__w">{v[0]}</strong> <em className="vocab__pos">{v[1]}</em> – {v[2]}{v[3] && <div className="small muted">{v[3]}</div>}</div><SaveWordBtn deck={deck} f={{ word: v[0], pos: v[1], meaning: v[2], example: v[3], from: m.id }} /></li>)}</ul>
          </Collapse>
        ) : null}
      </>}
    </div>
  );
  const editor = (
    <div className="xwrite">
      <textarea className="wbox__input" value={text} onChange={(e) => onText(e.target.value)} placeholder="" aria-label="Bài viết" spellCheck={false} />
      <div className="xwrite__count">Words: {n}{n < min && <span className="muted"> (tối thiểu {min})</span>}</div>
      {err && <p className="no-text small">{err}</p>}
    </div>
  );
  const tools = (
    <>
      <button className={`xtool${aids ? ' is-on' : ''}`} onClick={() => setAids(!aids)} title="Dàn ý gợi ý, bài mẫu, từ vựng"><Lightbulb size={15} /> <span>Gợi ý</span></button>
      {(done || grade) && <button className="xtool" onClick={() => setSheet(true)}><FileCheck2 size={15} /> <span>Kết quả</span></button>}
      {aiReady(cfg)
        ? <button className="xtool" onClick={submit} disabled={busy || n < 30} title="Chấm theo 4 tiêu chí IELTS" aria-label="Chấm bằng AI">{busy ? <><Loader2 size={15} className="spin" /> <span>AI đang chấm…</span></> : <><Bot size={15} /> <span>Chấm AI</span></>}</button>
        : <a className="xtool" href="#/settings?ai=1" title="Chưa cài AI – xem hướng dẫn"><Bot size={15} /> <span>Chấm AI</span></a>}
    </>
  );
  return (
    <ExamFrame onExit={() => nav('/writing')} tools={tools}
      status={<ExamClock key={m.id} seconds={minutes * 60} running={text.trim().length > 0} overtime stopped={!!done} />}
      banner={{ title: `Part ${m.task}`, text: `You should spend about ${minutes} minutes on this task.${/write at least/i.test(m.prompt) ? '' : ` Write at least ${min} words.`}` }}
      footer={(
        <footer className="xnav">
          <div className="xnav__parts"><div className="xnav__part is-on"><strong>Part {m.task}</strong> <span data-testid="w-typelabel">{TYPE_LABEL[m.type] ?? m.type}{m.module === 'general' ? ' · GT' : ''}</span></div></div>
          <div className="xnav__right">
            <button className="xnav__submit" onClick={() => (done ? setSheet(true) : confirm('Nộp bài?') && handIn())} disabled={!text.trim()} aria-label={done ? 'Xem kết quả' : 'Nộp bài'} title={done ? 'Xem kết quả' : 'Nộp bài'}><Check size={22} /></button>
          </div>
        </footer>
      )}>
      <ExamSplit left={prompt} right={editor} labels={['Task', `Answer (${n})`]} storeKey="ielts:writing-split" />
      {sheet && (done || grade) && (
        <ExamSheet onClose={() => setSheet(false)}>
          <div className="stack">
      {done && (
        <div className="stack">
          <section className="card pad">
            <div className="ai__head"><FileCheck2 size={18} /> <strong>Đã nộp bài</strong></div>
            <p className="small">{done.words} từ{done.words < min && <span className="no-text"> (thiếu {min - done.words} từ so với tối thiểu {min} – bị trừ điểm Task {m.task === 1 ? 'Achievement' : 'Response'})</span>} · {done.minutes ? `${done.minutes} phút` : 'không bấm giờ'}{done.minutes > minutes && <span className="no-text"> (quá {done.minutes - minutes} phút)</span>} · đã lưu vào Lịch sử.</p>
            {m.sample ? sampleBox : <p className="small muted">Đề này chưa có bài mẫu.</p>}
          </section>
          {!aiReady(cfg) && <AiMissing />}
          <SelfCheck kind="writing" task={m.task} attemptId={done.id} />
        </div>
      )}

      {grade && <WritingGradeView grade={grade} text={text} task={m.task} from={m.id} id="ai-result" />}
          </div>
        </ExamSheet>
      )}
    </ExamFrame>
  );
}

/** Đề Writing: chữ đề, ảnh hoặc biểu đồ vẽ từ số liệu, bảng số liệu, mô tả hình. Dùng cả ở thi thử 4 kỹ năng. */
export function TaskPrompt({ m, img }: { m: WritingMaterial; img: string | null }) {
  const charts = chartsOf(m);
  const paras = promptParas(m.prompt);
  return (
    <>
      <div className="wtask__prompt">{paras.map((p, i) => <p key={i} className={p.startsWith('•') ? 'wtask__bullets' : undefined}>{p}</p>)}</div>
      {img && <div className="wtask__frame"><ZoomImage src={img} alt={m.imageAlt ?? 'Biểu đồ / bản đồ của đề'} className="wtask__img" /></div>}
      {!img && charts.map((c, i) => <ChartView key={i} chart={c} />)}
      {img && charts.length > 0 && (
        <Collapse title="Bảng số liệu" defaultOpen={false}>
          <div className="stack" data-testid="w-datatables">{charts.map((c, i) => <DataTable key={i} chart={c} />)}</div>
        </Collapse>
      )}
      {m.imageAlt && (img || charts.length
        ? <Collapse title="Mô tả hình bằng chữ" defaultOpen={false}><p className="small wtask__alt">{m.imageAlt}</p></Collapse>
        : <div className="qcontext wtask__alt"><strong className="small">Hình của đề (mô tả bằng chữ – tài liệu gốc chỉ có hình):</strong>{'\n'}{m.imageAlt}</div>)}
    </>
  );
}
