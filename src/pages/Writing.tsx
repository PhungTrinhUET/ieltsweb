// Writing: đề + biểu đồ, dàn ý, soạn bài (đếm từ, bấm giờ, tự lưu nháp), AI chấm theo 4 tiêu chí IELTS.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, BookmarkPlus, Check, FileCheck2, Loader2, Sparkles } from 'lucide-react';
import type { WritingMaterial } from '../types';
import { addAttempt, findCard, updateAttempt, resolveUrl, saveCard, saveDraft, useDb } from '../db';
import { aiReady, getAiConfig, setLastOpen, touchStreak, useAiConfig } from '../store';
import SelfCheck from '../components/SelfCheck';
import Timer from '../components/Timer';
import ZoomImage from '../components/ZoomImage';
import { Collapse } from '../components/ui';
import { BandPill, ChartView, CriteriaBars, WordDiff } from '../components/misc';
import type { WritingGrade } from '../ai/writing';
import { wordCount } from '../lib/text';
import { newCard } from '../lib/srs';
import { SKILL_META } from './SkillList';

const TYPE_LABEL: Record<string, string> = {
  opinion: 'Opinion (agree/disagree)', discussion: 'Discussion (both views + opinion)', advantage: 'Advantages / disadvantages', problem: 'Problem / solution', double: 'Double question',
  line: 'Line graph', bar: 'Bar chart', pie: 'Pie chart', table: 'Table', process: 'Process', map: 'Map', mixed: 'Mixed charts',
  'letter-formal': 'Formal letter', 'letter-semi': 'Semi-formal letter', 'letter-informal': 'Informal letter',
};
const STRUCTURE: Record<string, string[]> = {
  opinion: ['Intro: paraphrase + thesis rõ (I completely/partly agree…)', 'Body 1: lý do 1 + giải thích + ví dụ', 'Body 2: lý do 2 (hoặc mặt đối lập rồi phản bác nếu partly)', 'Conclusion: nhắc lại quan điểm'],
  discussion: ['Intro: paraphrase + nêu sẽ bàn cả hai + opinion', 'Body 1: quan điểm A – lý do, ví dụ', 'Body 2: quan điểm B – lý do, ví dụ', 'Conclusion: quan điểm cá nhân'],
  advantage: ['Intro: paraphrase + outline', 'Body 1: lợi ích (1–2 ý)', 'Body 2: bất lợi (1–2 ý)', 'Conclusion: cái nào lớn hơn (nếu đề hỏi outweigh)'],
  problem: ['Intro: paraphrase + outline', 'Body 1: vấn đề/nguyên nhân + hệ quả', 'Body 2: giải pháp tương ứng + ai thực hiện', 'Conclusion'],
  double: ['Intro: paraphrase + trả lời ngắn cả hai câu', 'Body 1: trả lời câu hỏi 1', 'Body 2: trả lời câu hỏi 2', 'Conclusion'],
  line: ['Intro: paraphrase (what, where, when)', 'Overview: 2 xu hướng chính (không số liệu)', 'Body 1: nhóm 1 – số liệu đầu/cuối, so sánh', 'Body 2: nhóm 2 – điểm nổi bật'],
  bar: ['Intro: paraphrase', 'Overview: cao nhất/thấp nhất, xu hướng chung', 'Body 1 + Body 2: nhóm theo danh mục, có số liệu'],
  pie: ['Intro', 'Overview: phần lớn nhất/nhỏ nhất, thay đổi lớn nhất', 'Body: so sánh các phần, số liệu'],
  table: ['Intro', 'Overview: hàng/cột nổi bật', 'Body: so sánh theo nhóm'],
  process: ['Intro: paraphrase', 'Overview: số bước, bắt đầu/kết thúc, tuần hoàn hay tuyến tính', 'Body 1: nửa đầu quy trình (bị động, từ nối trình tự)', 'Body 2: nửa sau'],
  map: ['Intro', 'Overview: thay đổi lớn nhất', 'Body 1: khu vực A – thêm/bớt/chuyển', 'Body 2: khu vực B'],
  mixed: ['Intro', 'Overview: ý chính của mỗi biểu đồ', 'Body 1: biểu đồ 1', 'Body 2: biểu đồ 2 + liên hệ'],
  'letter-formal': ['Dear Sir or Madam, / Dear Mr Smith,', 'Đoạn 1: lý do viết', 'Đoạn 2–3: từng gạch đầu dòng của đề', 'Đoạn cuối: hành động mong muốn', 'Yours faithfully, / Yours sincerely,'],
  'letter-semi': ['Dear Mr/Ms…,', 'Lý do viết', 'Chi tiết theo gạch đầu dòng', 'Kết: Best regards,'],
  'letter-informal': ['Dear Anna, / Hi Tom,', 'Mở thân mật (How are you? Sorry I haven\'t written…)', 'Chi tiết theo gạch đầu dòng, giọng tự nhiên, contractions', 'Kết: Love, / Best wishes,'],
};

export default function Writing() {
  const { id } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const m = db.materials[id!] as WritingMaterial | undefined;
  const key = `w-${id}`;
  const [text, setText] = useState(db.drafts[key] ?? '');
  const [grade, setGrade] = useState<WritingGrade | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [tab, setTab] = useState<'fixes' | 'corrected' | 'improved' | 'upgrades'>('fixes');
  const [done, setDone] = useState<{ id: string; words: number; minutes: number } | null>(null);
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
    setDone(null); setErr('');
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
      setGrade(g); setTab('fixes');
      // Đã "Nộp bài" rồi thì nâng bản ghi đó thành bản AI chấm, không tạo 2 dòng lịch sử.
      if (done) await updateAttempt(done.id, { mode: 'ai', band: g.overall, detail: { text, words: n, minutes: done.minutes, grade: g } });
      else await addAttempt({ materialId: m.id, skill: 'writing', title: m.title, mode: 'ai', band: g.overall, detail: { text, words: n, minutes: usedMin(), grade: g } });
      window.scrollTo({ top: document.getElementById('ai-result')?.offsetTop ?? 0 });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const handIn = async () => {
    if (!text.trim()) return setErr('Chưa viết gì.');
    setErr('');
    const minutesUsed = usedMin();
    const a = await addAttempt({ materialId: m.id, skill: 'writing', title: m.title, mode: 'self', score: n, detail: { text, words: n, minutes: minutesUsed } });
    setDone({ id: a.id, words: n, minutes: minutesUsed });
    window.setTimeout(() => document.getElementById('self-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <div className="page page--wide page--practice" style={{ ['--skill' as string]: SKILL_META.writing.color }}>
      <div className="topbar topbar--sticky">
        <button className="icon-btn" onClick={() => nav('/writing')} aria-label="Quay lại"><ArrowLeft size={20} /></button>
        <div className="topbar__title"><small>Writing Task {m.task} · {TYPE_LABEL[m.type] ?? m.type}{m.module === 'general' && ' · GT'}</small><strong>{m.title}</strong></div>
        <div className="topbar__actions"><Timer key={m.id} minutes={minutes} start={text.trim().length > 0} overtime stopped={!!done} /></div>
      </div>

      <div className="split">
        <section className="split__pane">
          <div className="wtask card pad">
            <div className="wtask__prompt">{m.prompt.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div>
            {img && <ZoomImage src={img} alt={m.imageAlt ?? 'Biểu đồ / bản đồ của đề'} className="wtask__img" />}
            {m.chart && !img && <ChartView chart={m.chart} />}
            {m.imageAlt && (img || m.chart
              ? <Collapse title="Mô tả hình bằng chữ" defaultOpen={false}><p className="small wtask__alt">{m.imageAlt}</p></Collapse>
              : <div className="qcontext wtask__alt"><strong className="small">Hình của đề (mô tả bằng chữ – tài liệu gốc chỉ có hình):</strong>{'\n'}{m.imageAlt}</div>)}
          </div>
          <Collapse title="Cấu trúc bài gợi ý" tone="tip" defaultOpen={false}>
            <ol className="plan">{(m.outline ?? STRUCTURE[m.type] ?? []).map((o, i) => <li key={i}>{o}</li>)}</ol>
          </Collapse>
          {m.sample && <Collapse title="Bài mẫu band 8 (xem sau khi viết xong!)" tone="info"><div className="sample sample--long">{m.sample.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div></Collapse>}
          {m.vocab?.length ? (
            <Collapse title={`Từ vựng gợi ý (${m.vocab.length})`} tone="info">
              <ul className="vlist">{m.vocab.map((v, i) => { const saved = !!findCard(v[0]); return <li key={i} className="vlist__row"><div className="vlist__body"><strong className="vocab__w">{v[0]}</strong> <em className="vocab__pos">{v[1]}</em> – {v[2]}</div><button className="icon-btn" disabled={saved} onClick={() => saveCard(newCard({ id: `v-${v[0]}-${Date.now().toString(36)}`, word: v[0], pos: v[1], meaning: v[2], example: v[3], from: m.id }))}>{saved ? <Check size={16} /> : <BookmarkPlus size={16} />}</button></li>; })}</ul>
            </Collapse>
          ) : null}
        </section>
        <section className="split__pane">
          <div className={`wbox${n >= min ? ' wbox--ok' : ''}`}>
            <textarea className="wbox__input" value={text} onChange={(e) => onText(e.target.value)} placeholder={`Viết bài tại đây (tối thiểu ${min} từ)…`} spellCheck={false} rows={18} />
            <div className="wbox__meta"><span className="wbox__count">{n} từ</span><span className="muted small">tối thiểu {min} · tự lưu nháp</span></div>
          </div>
          <div className="row wrap">
            <button className="btn btn--primary btn--grow" onClick={handIn} disabled={!!done || !text.trim()}><FileCheck2 size={16} /> {done ? 'Đã nộp' : 'Nộp bài'}</button>
            {aiReady(cfg) && <button className="btn btn--ghost btn--grow" onClick={submit} disabled={busy || n < 30}>{busy ? <><Loader2 size={16} className="spin" /> AI đang chấm (30–90 giây)…</> : <><Bot size={16} /> Chấm bằng AI</>}</button>}
          </div>
          {!aiReady(cfg) && <p className="small muted">Nộp bài để lưu vào Lịch sử, xem bài mẫu và tự chấm. Muốn AI chấm thêm: <a href="#/settings">Cài đặt → AI</a>.</p>}
          {err && <p className="no-text small">{err}</p>}
        </section>
      </div>

      {done && (
        <div id="self-result" className="stack">
          <section className="card pad">
            <div className="ai__head"><FileCheck2 size={18} /> <strong>Đã nộp bài</strong></div>
            <p className="small">{done.words} từ{done.words < min && <span className="no-text"> (thiếu {min - done.words} từ so với tối thiểu {min} – bị trừ điểm Task {m.task === 1 ? 'Achievement' : 'Response'})</span>} · {done.minutes ? `${done.minutes} phút` : 'không bấm giờ'}{done.minutes > minutes && <span className="no-text"> (quá {done.minutes - minutes} phút)</span>} · đã lưu vào Lịch sử.</p>
            {m.sample
              ? <><h4>Bài mẫu</h4><div className="sample sample--long">{m.sample.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div></>
              : <p className="small muted">Đề này chưa có bài mẫu.</p>}
          </section>
          <SelfCheck kind="writing" task={m.task} attemptId={done.id} />
        </div>
      )}

      {grade && (
        <section className="card pad ai" id="ai-result">
          <div className="ai__head"><Sparkles size={18} /> <strong>Kết quả chấm</strong></div>
          <div className="ai__top"><BandPill band={grade.overall} label="Band" /><p>{grade.summary}</p></div>
          <CriteriaBars items={[
            { label: m.task === 1 ? 'Task Achievement' : 'Task Response', band: grade.scores.task, reason: grade.reasons.task },
            { label: 'Coherence & Cohesion', band: grade.scores.coherence, reason: grade.reasons.coherence },
            { label: 'Lexical Resource', band: grade.scores.lexical, reason: grade.reasons.lexical },
            { label: 'Grammatical Range & Accuracy', band: grade.scores.grammar, reason: grade.reasons.grammar },
          ]} />
          <div className="ai__lists">
            <div><h4>Điểm mạnh</h4><ul>{grade.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div><h4>Để lên band</h4><ul>{grade.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          </div>
          <div className="tabs">
            {([['fixes', `Lỗi (${grade.corrections.length})`], ['corrected', 'Bản sửa lỗi'], ['improved', 'Bản nâng band'], ['upgrades', 'Nâng cấp cụm từ']] as const).map(([k, l]) => <button key={k} className={`tabs__btn${tab === k ? ' is-on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          {tab === 'fixes' && <ul className="fb-fixes">{grade.corrections.map((c, i) => <li key={i}><span className="tag">{c.kind}</span> <span className="fb-from">{c.original}</span> → <span className="fb-to">{c.corrected}</span><div className="fb-why">{c.explanation}</div></li>)}</ul>}
          {tab === 'corrected' && <div className="sample sample--long"><p className="small muted">Gạch đỏ = bỏ, xanh = thêm/sửa, so với bài của bạn.</p>{grade.corrected.split('\n').map((p, i) => <WordDiff key={i} from={(text.split('\n')[i] ?? '')} to={p} />)}</div>}
          {tab === 'improved' && <div className="sample sample--long">{grade.improved.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div>}
          {tab === 'upgrades' && (
            <table className="table"><thead><tr><th>Bạn viết</th><th>Cách tốt hơn</th><th></th></tr></thead>
              <tbody>{grade.upgrades.map((u, i) => { const saved = !!findCard(u.to); return <tr key={i}><td>{u.from}</td><td><strong>{u.to}</strong></td><td><button className="icon-btn" disabled={saved} onClick={() => saveCard(newCard({ id: `v-${u.to}-${Date.now().toString(36)}`, word: u.to, meaning: `Thay cho: ${u.from}`, from: m.id }))}>{saved ? <Check size={16} /> : <BookmarkPlus size={16} />}</button></td></tr>; })}</tbody></table>
          )}
        </section>
      )}
    </div>
  );
}
