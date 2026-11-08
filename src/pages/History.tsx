import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { clearAttempts, useDb } from '../db';
import type { Skill } from '../types';
import { SKILL_META } from './SkillList';
import { fmtBand, overallBand } from '../lib/band';
import { fmtDate } from '../lib/text';

const SKILLS: Skill[] = ['reading', 'listening', 'speaking', 'writing'];
const MODE: Record<string, string> = { test: 'Làm đề', dictation: 'Chép chính tả', gapfill: 'Điền từ', ai: 'AI chấm', self: 'Tự chấm' };

export default function History() {
  const db = useDb();
  const [skill, setSkill] = useState<Skill | 'all'>('all');
  const list = db.attempts.filter((a) => skill === 'all' || a.skill === skill);
  const trend = useMemo(() => Object.fromEntries(SKILLS.map((k) => [k, db.attempts.filter((a) => a.skill === k && a.band).slice(0, 8).reverse().map((a) => a.band!)])) as Record<Skill, number[]>, [db.attempts]);
  const latest = SKILLS.map((k) => trend[k].at(-1)).filter((b): b is number => !!b);

  return (
    <div className="page">
      <div className="page-head"><div><h1>Lịch sử</h1><p>Band ước tính từng kỹ năng theo thời gian. {latest.length === 4 && <>Overall hiện tại: <strong>{fmtBand(overallBand(latest))}</strong></>}</p></div></div>
      <div className="part-grid">
        {SKILLS.map((k) => {
          const t = trend[k]; const last = t.at(-1);
          return (
            <div key={k} className="part-card" style={{ ['--skill' as string]: SKILL_META[k].color }}>
              <div className="part-card__top"><span className="part-card__label">{SKILL_META[k].label}</span><span className="part-card__count">{db.attempts.filter((a) => a.skill === k).length} lần</span></div>
              <div className="part-card__title"><strong style={{ fontSize: 26 }}>{last ? fmtBand(last) : '–'}</strong></div>
              <Spark values={t} />
            </div>
          );
        })}
      </div>
      <div className="row-between">
        <div className="seg">{(['all', ...SKILLS] as const).map((k) => <button key={k} className={`seg__btn${skill === k ? ' is-selected' : ''}`} onClick={() => setSkill(k)}>{k === 'all' ? 'Tất cả' : SKILL_META[k].label}</button>)}</div>
        {db.attempts.length > 0 && <button className="btn btn--text btn--sm" onClick={() => confirm('Xoá toàn bộ lịch sử?') && clearAttempts()}><Trash2 size={14} /> Xoá lịch sử</button>}
      </div>
      {list.length === 0 ? <p className="empty">Chưa có kết quả nào.</p> : (
        <ul className="items items--1">
          {list.map((a) => (
            <li key={a.id} className="item">
              <div className="item__no" style={{ color: SKILL_META[a.skill].color }}>{a.band ? fmtBand(a.band) : a.max ? `${a.score}/${a.max}` : '✓'}</div>
              <div className="item__body"><Link to={`/${a.skill}/${a.materialId}`} className="item__title">{a.title}</Link><div className="item__sub">{SKILL_META[a.skill].label} · {MODE[a.mode]} · {fmtDate(a.at)}{a.mode === 'dictation' && a.score !== undefined && ` · ${a.score}% từ đúng`}</div></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="small muted">Cần ≥ 2 lần để vẽ xu hướng</div>;
  const w = 160, h = 36;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - 3) / 6) * h}`).join(' ');
  return <svg width={w} height={h} className="spark"><polyline fill="none" stroke="var(--skill)" strokeWidth={2} points={pts} /></svg>;
}
