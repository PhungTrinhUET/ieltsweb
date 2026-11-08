import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, FolderInput, GraduationCap, Headphones, Mic, NotebookPen, Sparkles, Timer } from 'lucide-react';
import type { Skill, Material } from '../types';
import { useDb } from '../db';
import { fmtBand } from '../lib/band';

export const SKILL_META: Record<Skill, { label: string; icon: typeof BookOpen; color: string; desc: string }> = {
  reading: { label: 'Reading', icon: BookOpen, color: 'var(--c-reading)', desc: 'Làm đề đủ dạng câu hỏi, chế độ học: đọc – dịch – tra từ – ghi chú – nghe đọc.' },
  listening: { label: 'Listening', icon: Headphones, color: 'var(--c-listening)', desc: 'Làm đề, chép chính tả từng câu, điền từ transcript, shadowing.' },
  speaking: { label: 'Speaking', icon: Mic, color: 'var(--c-speaking)', desc: 'Part 1–2–3 đúng giờ thi thật, ghi âm, nhận dạng giọng nói, AI chấm.' },
  writing: { label: 'Writing', icon: NotebookPen, color: 'var(--c-writing)', desc: 'Task 1 & 2 mọi dạng, đếm từ, bấm giờ, AI chấm theo band descriptors.' },
};

const LEVEL: Record<string, string> = { easy: 'Dễ', medium: 'Vừa', hard: 'Khó' };

export function subtitle(m: Material) {
  const bits: string[] = [];
  if (m.skill === 'reading') { bits.push(`${m.groups.reduce((n, g) => n + g.questions.length, 0)} câu`); if (m.module) bits.push(m.module === 'general' ? 'GT' : 'Academic'); }
  if (m.skill === 'listening') { bits.push(`Section ${m.section ?? '?'}`); bits.push(`${m.groups.reduce((n, g) => n + g.questions.length, 0)} câu`); bits.push(m.audio ? 'Audio' : 'Giọng máy'); }
  if (m.skill === 'speaking') { if (m.part1?.length) bits.push('P1'); if (m.part2) bits.push('P2'); if (m.part3) bits.push('P3'); }
  if (m.skill === 'writing') { bits.push(`Task ${m.task}`); bits.push(m.type); if (m.module === 'general') bits.push('GT'); }
  if (m.level) bits.push(LEVEL[m.level]);
  if (m.topic) bits.push(m.topic);
  return bits.join(' · ');
}

export default function SkillList({ skill }: { skill: Skill }) {
  const db = useDb();
  const nav = useNavigate();
  const meta = SKILL_META[skill];
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const items = useMemo(() => Object.values(db.materials).filter((m) => m.skill === skill).sort((a, b) => b.addedAt - a.addedAt), [db.materials, skill]);
  const topics = useMemo(() => [...new Set(items.map((m) => m.topic).filter(Boolean))] as string[], [items]);
  const shown = items.filter((m) => (!q || m.title.toLowerCase().includes(q.toLowerCase())) && (!tag || m.topic === tag));
  const best = (id: string) => db.attempts.filter((a) => a.materialId === id && a.mode === 'test').sort((a, b) => (b.score ?? 0) / (b.max ?? 1) - (a.score ?? 0) / (a.max ?? 1))[0];
  const lastAi = (id: string) => db.attempts.find((a) => a.materialId === id && a.mode === 'ai');
  const Icon = meta.icon;
  const dual = skill === 'reading' || skill === 'listening';
  const [mode, setModeState] = useState<'practice' | 'test'>(() => { try { return localStorage.getItem(`ielts-mode-${skill}`) === 'test' ? 'test' : 'practice'; } catch { return 'practice'; } });
  const setMode = (v: 'practice' | 'test') => { setModeState(v); try { localStorage.setItem(`ielts-mode-${skill}`, v); } catch { /* bỏ qua */ } };
  const open = (id: string) => nav(dual && mode === 'practice' ? `/${skill}/${id}/practice` : `/${skill}/${id}`);

  return (
    <div className="page" style={{ ['--skill' as string]: meta.color }}>
      <div className="page-head">
        <span className="skill__icon skill__icon--lg"><Icon size={26} /></span>
        <div><h1>{meta.label}</h1><p>{meta.desc}</p></div>
      </div>
      {dual && (
        <div className="modes" role="tablist" aria-label="Chế độ">
          <button role="tab" aria-selected={mode === 'practice'} className={`mode${mode === 'practice' ? ' is-on' : ''}`} onClick={() => setMode('practice')}>
            <span className="mode__icon"><GraduationCap size={22} /></span>
            <span className="mode__body"><strong>Luyện tập</strong><span>Không tính giờ · bấm từ tra nghĩa tiếng Việt, lưu sổ từ · dịch từng đoạn · highlight · xem đáp án và giải thích từng câu</span></span>
          </button>
          <button role="tab" aria-selected={mode === 'test'} className={`mode${mode === 'test' ? ' is-on' : ''}`} onClick={() => setMode('test')}>
            <span className="mode__icon"><Timer size={22} /></span>
            <span className="mode__body"><strong>Thi thử</strong><span>Bấm giờ như thi thật · nộp bài mới xem đáp án · chấm band</span></span>
          </button>
        </div>
      )}
      <div className="toolbar">
        <input className="input" placeholder="Tìm bài…" value={q} onChange={(e) => setQ(e.target.value)} />
        {dual && mode === 'test' && <Link to={`/mock/${skill}`} className="btn btn--primary" title="Ghép nhiều bài thành một đề đầy đủ, tính giờ"><Timer size={16} /> Thi cả đề (nhiều bài)</Link>}
        <Link to={`/library?skill=${skill}`} className="btn btn--ghost"><FolderInput size={16} /> Nạp / tạo đề</Link>
      </div>
      {topics.length > 1 && (
        <div className="tabs">
          <button className={`tabs__btn${!tag ? ' is-on' : ''}`} onClick={() => setTag('')}>Tất cả</button>
          {topics.map((t) => <button key={t} className={`tabs__btn${tag === t ? ' is-on' : ''}`} onClick={() => setTag(t)}>{t}</button>)}
        </div>
      )}
      {shown.length === 0 ? (
        <div className="empty empty--big">
          <p>Chưa có bài nào. Vào <Link to={`/library?skill=${skill}`}><strong>Tài liệu</strong></Link> để nạp file hoặc nhờ AI tạo đề.</p>
        </div>
      ) : (
        <ul className="items items--1">
          {shown.map((m) => {
            const b = best(m.id); const ai = lastAi(m.id);
            return (
              <li key={m.id} className={`item${b ? (b.score! / b.max! >= 0.7 ? ' item--done' : ' item--wrong') : ''}`} onClick={() => open(m.id)} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(m.id)}>
                <div className="item__no">{b ? `${b.score}/${b.max}` : ai?.band ? fmtBand(ai.band) : <Icon size={16} />}</div>
                <div className="item__body">
                  <div className="item__title">{m.title}</div>
                  <div className="item__sub">{subtitle(m)}{m.source?.startsWith('AI') && <> · <Sparkles size={11} /> AI</>}</div>
                </div>
                {b?.band ? <span className="item__score">Band {fmtBand(b.band)}</span> : ai?.band ? <span className="item__score">Band {fmtBand(ai.band)}</span> : null}
                {dual && <span className={`item__mode item__mode--${mode}`}>{mode === 'practice' ? 'Luyện tập' : 'Thi thử'}</span>}
                <ChevronRight size={18} className="item__arrow" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
