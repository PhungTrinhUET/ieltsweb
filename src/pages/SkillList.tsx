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
  const open = (id: string) => nav(dual ? `/${skill}/${id}/practice` : `/${skill}/${id}`);

  return (
    <div className="page" style={{ ['--skill' as string]: meta.color }}>
      <div className="page-head">
        <span className="skill__icon skill__icon--lg"><Icon size={26} /></span>
        <div><h1>{meta.label}</h1><p>{meta.desc}</p></div>
      </div>
      {dual && <p className="muted small mode-hint"><strong>Luyện tập</strong>: không tính giờ, bấm từ để tra nghĩa tiếng Việt và lưu sổ từ, dịch từng đoạn, kiểm tra từng câu kèm giải thích. <strong>Thi thử</strong>: bấm giờ như thi thật, nộp bài mới xem đáp án.</p>}
      <div className="toolbar">
        <input className="input" placeholder="Tìm bài…" value={q} onChange={(e) => setQ(e.target.value)} />
        {(skill === 'reading' || skill === 'listening') && <Link to={`/mock/${skill}`} className="btn btn--primary"><Timer size={16} /> Thi thử cả đề</Link>}
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
                {dual ? (
                  <div className="item__modes" onClick={(e) => e.stopPropagation()}>
                    <Link to={`/${skill}/${m.id}/practice`} className="btn btn--ghost btn--sm" title="Không tính giờ, tra từ, dịch, xem đáp án từng câu"><GraduationCap size={15} /> Luyện tập</Link>
                    <Link to={`/${skill}/${m.id}`} className="btn btn--ghost btn--sm" title="Bấm giờ như thi thật, nộp bài mới xem đáp án"><Timer size={15} /> Thi thử</Link>
                  </div>
                ) : <ChevronRight size={18} className="item__arrow" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
