import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Highlighter, RotateCcw, GraduationCap } from 'lucide-react';
import { HighlightBar, HlText, colorMap, useHighlights } from '../components/Highlight';
import type { ReadingMaterial } from '../types';
import { addAttempt, useDb } from '../db';
import { touchStreak, setLastOpen } from '../store';
import Timer from '../components/Timer';
import { GroupsView, scoreGroups, type Answers } from '../components/Questions';
import { paragraphs, paraLabel } from '../lib/text';
import { rawToBand, fmtBand } from '../lib/band';
import { SKILL_META } from './SkillList';
import WordPopover, { type WordSel } from '../components/WordPopover';

export default function ReadingTest() {
  const { id } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const m = db.materials[id!] as ReadingMaterial | undefined;
  const [answers, setAnswers] = useState<Answers>({});
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<'passage' | 'questions'>('passage');
  const [sel, setSel] = useState<WordSel | null>(null);
  const hl = useHighlights(id);
  const startedAt = useMemo(() => Date.now(), []);
  const paras = useMemo(() => (m ? paragraphs(m.passage) : []), [m]);
  useEffect(() => { setAnswers({}); setChecked(false); if (id && m) setLastOpen(id, `/reading/${id}`, 'test'); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m) return <div className="page"><p className="empty">Không tìm thấy bài.</p></div>;
  const total = m.groups.reduce((n, g) => n + g.questions.length, 0);
  const done = Object.values(answers).filter((a) => a !== null && a !== '' && !(Array.isArray(a) && !a.length)).length;
  const res = checked ? scoreGroups(m.groups, answers) : null;
  const band = res ? rawToBand('reading', res.score, res.max, m.module) : null;

  const submit = async () => {
    const r = scoreGroups(m.groups, answers);
    setChecked(true);
    touchStreak();
    await addAttempt({ materialId: m.id, skill: 'reading', title: m.title, mode: 'test', score: r.score, max: r.max, band: rawToBand('reading', r.score, r.max, m.module), detail: { answers, minutes: Math.round((Date.now() - startedAt) / 60000), wrong: r.wrong } });
    setTab('questions');
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="page page--wide page--practice" style={{ ['--skill' as string]: SKILL_META.reading.color }}>
      <div className="topbar topbar--sticky">
        <button className="icon-btn" onClick={() => nav('/reading')} aria-label="Quay lại"><ArrowLeft size={20} /></button>
        <div className="topbar__title"><small>Thi thử · Reading · {m.module === 'general' ? 'General Training' : 'Academic'}</small><strong>{m.title}</strong></div>
        <div className="topbar__actions">
          {!checked && <Timer key={m.id} minutes={m.minutes ?? 20} onEnd={submit} autoStart />}
          {checked ? <Link to={`/reading/${m.id}/practice`} className="btn btn--primary btn--sm"><GraduationCap size={16} /> Luyện tập bài này</Link> : null}
        </div>
        <div className="topbar__progress" style={{ width: `${(done / total) * 100}%` }} />
      </div>

      {checked && res && (
        <div className="final card">
          <div className="final__head">
            <div><strong style={{ fontSize: 28 }}>{res.score}/{res.max}</strong><div className="muted small">câu đúng</div></div>
            <div><strong style={{ fontSize: 28 }}>Band {fmtBand(band)}</strong><div className="muted small">ước tính theo thang {res.max} câu → 40</div></div>
            <div className="final__next">
              <button className="btn btn--ghost btn--sm" onClick={() => { setAnswers({}); setChecked(false); }}><RotateCcw size={15} /> Làm lại</button>
            </div>
          </div>
          <p className="small muted">Bấm vào từ trong bài đọc để tra nghĩa và lưu vào sổ từ. Sai ở câu: {res.wrong.join(', ') || 'không có'}.</p>
        </div>
      )}

      <div className="tabs tabs--mobile">
        <button className={`tabs__btn${tab === 'passage' ? ' is-on' : ''}`} onClick={() => setTab('passage')}>Bài đọc</button>
        <button className={`tabs__btn${tab === 'questions' ? ' is-on' : ''}`} onClick={() => setTab('questions')}>Câu hỏi ({done}/{total})</button>
      </div>

      <div className="split">
        <section className={`split__pane split__pane--passage${tab !== 'passage' ? ' hide-sm' : ''}`}>
          <div className="passage-tools">
            <span className="small muted"><Highlighter size={14} /> Bôi đen chữ trong bài để highlight (5 màu){checked ? ' · bấm vào từ để tra nghĩa' : ''}</span>
            {hl.list.length > 0 && <button className="btn btn--text btn--sm" onClick={hl.clear}>Xoá hết highlight</button>}
          </div>
          <article className="passage passage--reading">
            <h2>{m.title}</h2>
            {paras.map((p, i) => {
              const { label, text } = paraLabel(p);
              return (
                <p key={i} className="passage__p">
                  {label && <span className="passage__label">{label}</span>}
                  <span><HlText text={text} map={colorMap(text, hl.list)} onWord={checked ? setSel : undefined} /></span>
                </p>
              );
            })}
          </article>
        </section>
        <section className={`split__pane split__pane--questions${tab !== 'questions' ? ' hide-sm' : ''}`}>
          <GroupsView groups={m.groups} answers={answers} onChange={(no, a) => setAnswers((s) => ({ ...s, [no]: a }))} checked={checked} />
        </section>
      </div>

      {!checked && (
        <div className="actionbar"><div className="actionbar__inner">
          <span className="result">{done}/{total} câu đã trả lời</span>
          <button className="btn btn--primary" onClick={submit}><Check size={18} /> Nộp bài</button>
        </div></div>
      )}
      <HighlightBar scopeClass="passage" onAdd={hl.add} onRemove={hl.remove} />
      {sel && <WordPopover sel={sel} vocab={m.vocab} from={m.id} onClose={() => setSel(null)} />}
    </div>
  );
}
