import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, ChevronRight, Shuffle, FolderInput, GraduationCap, Headphones, Mic, NotebookPen, Sparkles, Timer } from 'lucide-react';
import type { Skill, Material } from '../types';
import { useDb } from '../db';
import { fmtBand } from '../lib/band';
import { BANK_TEST, bestResults, groupByTest, parseId, partLabel, testName } from '../lib/tests';
import { QKINDS, QKIND_LABEL, materialKinds, type QKind } from '../lib/qtypes';

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
  const meta = SKILL_META[skill];
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const all = useMemo(() => Object.values(db.materials), [db.materials]);
  const items = useMemo(() => all.filter((m) => m.skill === skill).sort((a, b) => b.addedAt - a.addedAt), [all, skill]);
  const topics = useMemo(() => [...new Set(items.map((m) => m.topic).filter(Boolean))] as string[], [items]);
  const shown = items.filter((m) => (!q || m.title.toLowerCase().includes(q.toLowerCase())) && (!tag || m.topic === tag));
  const results = useMemo(() => bestResults(db.attempts), [db.attempts]);
  const lastAi = (id: string) => db.attempts.find((a) => a.materialId === id && (a.mode === 'ai' || a.mode === 'self'));
  const Icon = meta.icon;
  const dual = skill === 'reading' || skill === 'listening';
  const byTest = skill !== 'speaking';
  const grouped = useMemo(() => groupByTest(all, skill), [all, skill]);
  const [mode, setModeState] = useState<'practice' | 'test'>(() => { try { return localStorage.getItem(`ielts-mode-${skill}`) === 'test' ? 'test' : 'practice'; } catch { return 'practice'; } });
  const setMode = (v: 'practice' | 'test') => { setModeState(v); try { localStorage.setItem(`ielts-mode-${skill}`, v); } catch { /* bỏ qua */ } };
  const href = (id: string) => (dual && mode === 'practice' ? `/${skill}/${id}/practice` : `/${skill}/${id}`);
  const [kinds, setKinds] = useState<QKind[]>([]);
  const [vol, setVol] = useState(0);
  const kindOf = useMemo(() => new Map(items.map((m) => [m.id, materialKinds(m)])), [items]);
  const kindCount = useMemo(() => {
    const c = new Map<QKind, number>();
    for (const m of items) if (!vol || parseId(m.id)?.vol === vol) for (const k of kindOf.get(m.id) ?? []) c.set(k, (c.get(k) ?? 0) + 1);
    return c;
  }, [items, kindOf, vol]);
  const toggleKind = (k: QKind) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));
  const filtering = kinds.length > 0;
  const browse = byTest && !q && !tag && !filtering && grouped.vols.size > 0;
  const byKind = filtering
    ? items.filter((m) => (!vol || parseId(m.id)?.vol === vol) && kindOf.get(m.id)!.some((k) => kinds.includes(k)) && (!q || m.title.toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => { const pa = parseId(a.id), pb = parseId(b.id); return pa && pb ? pa.vol - pb.vol || pa.test - pb.test || a.id.localeCompare(b.id) : pa ? -1 : pb ? 1 : 0; })
    : [];

  const row = (m: Material, label?: string) => {
    const b = results.get(m.id); const ai = lastAi(m.id);
    const band = b?.band ?? ai?.band ?? ai?.selfBand;
    return (
      <li key={m.id}>
        <Link to={href(m.id)} className={`item${b ? (b.score / (b.max || 1) >= 0.7 ? ' item--done' : ' item--wrong') : ai ? ' item--done' : ''}`}>
          <div className="item__no">{b ? `${b.score}/${b.max}` : band ? fmtBand(band) : <Icon size={16} />}</div>
          <div className="item__body">
            <div className="item__title">{label ?? m.title}</div>
            <div className="item__sub">{subtitle(m)}{m.source?.startsWith('AI') && <> · <Sparkles size={11} /> AI</>}</div>
            {filtering && <div className="kchips">{kindOf.get(m.id)!.map((k) => <span key={k} className={`kchip${kinds.includes(k) ? ' is-on' : ''}`}>{QKIND_LABEL[k]}</span>)}</div>}
          </div>
          {band ? <span className="item__score">Band {fmtBand(band)}</span> : null}
          {dual && <span className={`item__mode item__mode--${mode}`}>{mode === 'practice' ? 'Luyện tập' : 'Thi thử'}</span>}
          <ChevronRight size={18} className="item__arrow" />
        </Link>
      </li>
    );
  };

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
        {dual && <Link to={`/mock/${skill}`} className="btn btn--ghost" title="Ghép ngẫu nhiên các bài từ nhiều đề thành một đề đủ, tính giờ"><Shuffle size={16} /> Ghép đề ngẫu nhiên</Link>}
        <Link to={`/library?skill=${skill}`} className="btn btn--ghost"><FolderInput size={16} /> Nạp / tạo đề</Link>
      </div>
      {topics.length > 1 && (
        <div className="tabs">
          <button className={`tabs__btn${!tag ? ' is-on' : ''}`} onClick={() => setTag('')}>Tất cả</button>
          {topics.map((t) => <button key={t} className={`tabs__btn${tag === t ? ' is-on' : ''}`} onClick={() => setTag(t)}>{t}</button>)}
        </div>
      )}
      {dual && (
        <div className="filters" aria-label="Bộ lọc dạng bài">
          <div className="filters__row">
            <span className="filters__label">VOL</span>
            <button className={`fchip${!vol ? ' is-on' : ''}`} aria-pressed={!vol} onClick={() => setVol(0)}>Tất cả</button>
            {[...grouped.vols.keys()].map((v) => <button key={v} className={`fchip${vol === v ? ' is-on' : ''}`} aria-pressed={vol === v} onClick={() => setVol(vol === v ? 0 : v)}>{v}</button>)}
          </div>
          <div className="filters__row">
            <span className="filters__label">Dạng bài</span>
            {QKINDS[skill as 'reading' | 'listening'].filter((k) => kindCount.get(k)).map((k) => (
              <button key={k} className={`fchip${kinds.includes(k) ? ' is-on' : ''}`} aria-pressed={kinds.includes(k)} onClick={() => toggleKind(k)}>
                {QKIND_LABEL[k]} <small>{kindCount.get(k)}</small>
              </button>
            ))}
            {filtering && <button className="fchip fchip--clear" onClick={() => setKinds([])}>Bỏ lọc</button>}
          </div>
        </div>
      )}
      {filtering ? (
        byKind.length ? <>
          <p className="muted small">{byKind.length} bài có dạng {kinds.map((k) => QKIND_LABEL[k]).join(' / ')}{vol ? ` trong VOL ${vol}` : ''}</p>
          <ul className="items items--1">{byKind.map((m) => row(m))}</ul>
        </> : <div className="empty empty--big"><p>Không có bài nào khớp.</p></div>
      ) : browse ? (
        <div className="vols">
          {[...grouped.vols].filter(([v]) => !vol || v === vol).map(([vol, tests], vi) => {
            const parts = tests.flatMap((t) => t.parts);
            const done = parts.filter((m) => results.has(m.id) || lastAi(m.id)).length;
            return (
              <details key={vol} className="vol" open={vi === 0}>
                <summary className="vol__head"><strong>VOL {vol}</strong><span className="muted small">{tests.length} đề · đã làm {done}/{parts.length} phần</span><ChevronDown size={18} className="vol__chev" /></summary>
                <ul className="items">
                  {tests.map((t) => (
                    <li key={t.key}>
                      <Link to={`/test/${skill}/${t.key}`} className="item item--test">
                        <div className="item__no">{t.test === BANK_TEST ? <Icon size={16} /> : `T${t.test}`}</div>
                        <div className="item__body">
                          <div className="item__title">{testName(t)}</div>
                          <div className="partpills">
                            {t.parts.map((m) => { const r = results.get(m.id); const ai = lastAi(m.id); return (
                              <span key={m.id} className={`partpill${r ? (r.score / (r.max || 1) >= 0.7 ? ' is-ok' : ' is-no') : ai ? ' is-ok' : ''}`} title={m.title}>
                                {t.test === BANK_TEST ? `T${(m as { task?: unknown }).task}` : partLabel(m).replace(/^(\w)\w+ /, '$1')}{r ? ` ${r.score}/${r.max}` : ai?.band ? ` ${fmtBand(ai.band)}` : ''}
                              </span>); })}
                          </div>
                        </div>
                        <ChevronRight size={18} className="item__arrow" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
          {grouped.others.length > 0 && (
            <details className="vol" open={grouped.vols.size === 0}>
              <summary className="vol__head"><strong>Bài mẫu &amp; bài tự nạp</strong><span className="muted small">{grouped.others.length} bài</span><ChevronDown size={18} className="vol__chev" /></summary>
              <ul className="items">{grouped.others.map((m) => row(m))}</ul>
            </details>
          )}
        </div>
      ) : shown.length === 0 ? (
        <div className="empty empty--big">
          <p>{items.length ? 'Không có bài nào khớp.' : <>Chưa có bài nào. Vào <Link to={`/library?skill=${skill}`}><strong>Tài liệu</strong></Link> để nạp file hoặc nhờ AI tạo đề.</>}</p>
        </div>
      ) : (
        <ul className="items items--1">{shown.map((m) => row(m))}</ul>
      )}
    </div>
  );
}
