import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Trash2 } from 'lucide-react';
import { clearAttempts, deleteAttempt, useDb } from '../db';
import type { Attempt, Skill } from '../types';
import { SKILL_META } from './SkillList';
import { fmtBand, overallBand } from '../lib/band';
import { fmtDate } from '../lib/text';
import { MODE_LABEL, countsForBand } from '../lib/attempts';

const SKILLS: Skill[] = ['reading', 'listening', 'speaking', 'writing'];
const day = (s: string) => new Date(`${s}T00:00:00`).getTime();

export default function History() {
  const db = useDb();
  const [skill, setSkill] = useState<Skill | 'all'>('all');
  const [mode, setMode] = useState<Attempt['mode'] | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const list = db.attempts.filter((a) => (skill === 'all' || a.skill === skill) && (!mode || a.mode === mode)
    && (!from || a.at >= day(from)) && (!to || a.at < day(to) + 86400000));
  const modes = [...new Set(db.attempts.map((a) => a.mode))];
  const trend = useMemo(() => Object.fromEntries(SKILLS.map((k) => [k, db.attempts.filter((a) => a.skill === k && countsForBand(a)).slice(0, 12).reverse()])) as Record<Skill, Attempt[]>, [db.attempts]);
  const latest = SKILLS.map((k) => trend[k].at(-1)?.band).filter((b): b is number => !!b);
  const filtered = skill !== 'all' || mode || from || to;

  return (
    <div className="page">
      <div className="page-head"><div><h1>Lịch sử</h1><p>Band ước tính từng kỹ năng theo thời gian (không tính lượt Luyện tập). {latest.length === 4 && <>Overall hiện tại: <strong>{fmtBand(overallBand(latest))}</strong></>}</p></div></div>
      <div className="part-grid">
        {SKILLS.map((k) => {
          const t = trend[k]; const last = t.at(-1)?.band;
          return (
            <div key={k} className="part-card" style={{ ['--skill' as string]: SKILL_META[k].color }}>
              <div className="part-card__top"><span className="part-card__label">{SKILL_META[k].label}</span><span className="part-card__count">{db.attempts.filter((a) => a.skill === k).length} lần</span></div>
              <div className="part-card__title"><strong style={{ fontSize: 26 }}>{last ? fmtBand(last) : '–'}</strong></div>
              <BandChart items={t} />
            </div>
          );
        })}
      </div>
      <div className="hfilters" data-testid="hfilters">
        <div className="seg">{(['all', ...SKILLS] as const).map((k) => <button key={k} className={`seg__btn${skill === k ? ' is-selected' : ''}`} onClick={() => setSkill(k)}>{k === 'all' ? 'Tất cả' : SKILL_META[k].label}</button>)}</div>
        <div className="hfilters__row">
          <select className="input input--sm" value={mode} onChange={(e) => setMode(e.target.value as Attempt['mode'] | '')} aria-label="Hình thức">
            <option value="">Mọi hình thức</option>
            {modes.map((m) => <option key={m} value={m}>{MODE_LABEL[m] ?? m}</option>)}
          </select>
          <label className="small">Từ <input type="date" className="input input--sm" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="small">đến <input type="date" className="input input--sm" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          {filtered && <button className="btn btn--text btn--sm" onClick={() => { setSkill('all'); setMode(''); setFrom(''); setTo(''); }}>Bỏ lọc</button>}
          <span className="spacer" />
          {db.attempts.length > 0 && <button className="btn btn--text btn--sm" onClick={() => confirm('Xoá TOÀN BỘ lịch sử làm bài? Không hoàn tác được.') && clearAttempts()}><Trash2 size={14} /> Xoá toàn bộ</button>}
        </div>
      </div>
      {list.length === 0 ? <p className="empty">{db.attempts.length ? 'Không có lượt nào khớp bộ lọc.' : 'Chưa có kết quả nào.'}</p> : (
        <>
          <p className="small muted">{list.length} lượt · bấm vào một dòng để xem lại câu trả lời</p>
          <ul className="items items--1" data-testid="hlist">
            {list.map((a) => (
              <li key={a.id} className="hrow">
                <Link to={`/history/${a.id}`} className="item">
                  <div className="item__no" style={{ color: SKILL_META[a.skill].color }}>{a.band ? fmtBand(a.band) : a.selfBand ? fmtBand(a.selfBand) : a.max ? (a.mode === 'dictation' ? `${a.score}%` : `${a.score}/${a.max}`) : '✓'}</div>
                  <div className="item__body"><div className="item__title">{a.title}</div><div className="item__sub">{SKILL_META[a.skill].label} · {MODE_LABEL[a.mode] ?? a.mode} · {fmtDate(a.at)}{a.mode === 'dictation' && a.score !== undefined && ` · ${a.score}% từ đúng`}</div></div>
                  <ChevronRight size={18} className="item__arrow" />
                </Link>
                <button className="icon-btn hrow__del" aria-label="Xoá lượt này" title="Xoá lượt này" onClick={() => confirm(`Xoá "${a.title}" khỏi Lịch sử?`) && deleteAttempt(a.id)}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Biểu đồ band nhỏ: trục 3–9, mỗi điểm một lượt (tooltip: ngày + band). */
function BandChart({ items }: { items: Attempt[] }) {
  if (items.length < 2) return <div className="small muted">Cần ≥ 2 lần để vẽ xu hướng</div>;
  const w = 180, h = 54, pl = 16, pt = 4, pb = 4;
  const x = (i: number) => pl + (i / (items.length - 1)) * (w - pl - 4);
  const y = (v: number) => pt + (1 - (v - 3) / 6) * (h - pt - pb);
  const pts = items.map((a, i) => `${x(i)},${y(a.band!)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="spark" role="img" aria-label={`Band: ${items.map((a) => fmtBand(a.band!)).join(', ')}`}>
      {[4, 6, 8].map((v) => <g key={v}><line x1={pl} x2={w} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="2 3" /><text x={0} y={y(v) + 3} fontSize="8" fill="var(--text-2)">{v}</text></g>)}
      <polyline fill="none" stroke="var(--skill)" strokeWidth={2} points={pts} />
      {items.map((a, i) => <circle key={a.id} cx={x(i)} cy={y(a.band!)} r={2.6} fill="var(--skill)"><title>{`${fmtDate(a.at)} · ${fmtBand(a.band!)}`}</title></circle>)}
    </svg>
  );
}
