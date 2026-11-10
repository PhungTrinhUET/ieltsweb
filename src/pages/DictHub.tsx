// Hub nghe-chép `#/dictation` (B1/B2): tiếp tục bài dở · 4 cấp · lọc theo cấp / chủ đề / VOL / trạng thái.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, Keyboard, Play } from 'lucide-react';
import { useDb } from '../db';
import { allLessons, GEN_HINT, GEN_NAMES, type GenKind, LEVEL_DESC, LEVEL_NAMES, type Lesson } from '../lib/dictation';
import { parseId, testName } from '../lib/tests';
import { type DictProgress, getProgress, lessonScore } from './DictLesson';
import ScrollRow from '../components/ScrollRow';

type Status = '' | 'todo' | 'doing' | 'done';
const STATUS: [Status, string][] = [['', 'Tất cả'], ['todo', 'Chưa làm'], ['doing', 'Đang dở'], ['done', 'Đã xong']];
const statusOf = (p?: DictProgress): Exclude<Status, ''> => (!p ? 'todo' : p.done ? 'done' : 'doing');
export const lessonHref = (id: string) => `/dictation/${encodeURIComponent(id)}`;

export default function DictHub() {
  const db = useDb();
  const [sp, setSp] = useSearchParams();
  const level = Math.min(4, Math.max(1, +(sp.get('level') ?? 0) || 0)) || (sp.get('m') ? 3 : 1);
  const mFilter = sp.get('m') ?? '';
  const setLevel = (l: number) => setSp((p) => { const n = new URLSearchParams(p); n.set('level', String(l)); n.delete('m'); return n; }, { replace: true });
  const [vol, setVol] = useState(0);
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState<Status>('');
  const [limit, setLimit] = useState(20);
  const lessons = useMemo(() => allLessons(db.materials), [db.materials]);
  const kv = db.kv; // đổi tiến độ → vẽ lại

  const last = kv['dict:last'] as string | undefined;
  const lastP = last ? getProgress(last) : undefined;
  const resume = lastP && !lastP.done ? { id: last!, p: lastP } : undefined;

  const ofLevel = lessons.filter((l) => l.level === level && (!mFilter || l.materialId === mFilter));
  const vols = [...new Set(ofLevel.map((l) => l.vol ?? 0))].filter(Boolean).sort((a, b) => a - b);
  const topics = [...new Map(ofLevel.filter((l) => l.topic).map((l) => [l.topic!, 0]))].map(([t]) => t).sort();
  const shown = ofLevel.filter((l) => (!vol || l.vol === vol) && (!topic || l.topic === topic) && (!status || statusOf(getProgress(l.id)) === status));
  // gom theo section
  const groups = useMemo(() => {
    const g = new Map<string, Lesson[]>();
    for (const l of shown) g.set(l.materialId!, [...(g.get(l.materialId!) ?? []), l]);
    return [...g];
  }, [shown.map((l) => l.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = [1, 2, 3, 4].map((lv) => (lv === 1 ? Object.keys(GEN_NAMES).length : lessons.filter((l) => l.level === lv).length));
  const doneN = lessons.filter((l) => getProgress(l.id)?.done).length;

  return (
    <div className="page dh" style={{ ['--skill' as string]: 'var(--c-listening)' }}>
      <div className="page-head">
        <span className="skill__icon skill__icon--lg"><Keyboard size={26} /></span>
        <div><h1>Nghe & chép</h1><p>Nghe từng câu rồi gõ lại – luyện tai nghe số, tên riêng và từng từ như Section 1–4. {doneN > 0 && <>Đã xong {doneN} bài.</>}</p></div>
      </div>

      {resume && (
        <Link to={lessonHref(resume.id)} className="dh-resume card" data-testid="dh-resume">
          <Play size={22} />
          <div><small>Tiếp tục bài đang dở</small><strong>{resume.p.title ?? resume.id}</strong>
            <span className="small muted">câu {(resume.p.order ?? resume.p.res.map((_, k) => k)).indexOf(resume.p.i) + 1}/{(resume.p.order ?? resume.p.res).length} · đúng {Math.round(lessonScore(resume.p) * 100)}%</span></div>
          <ChevronRight size={18} />
        </Link>
      )}

      <div className="dh-levels" role="tablist" aria-label="Cấp độ">
        {[1, 2, 3, 4].map((lv) => (
          <button key={lv} role="tab" aria-selected={level === lv} className={`dh-level${level === lv ? ' is-on' : ''}`} onClick={() => setLevel(lv)}>
            <strong>Cấp {lv}</strong><span>{LEVEL_NAMES[lv]}</span><small>{lv === 1 ? 'không giới hạn' : `${counts[lv - 1]} bài`}</small>
          </button>
        ))}
      </div>
      <p className="muted small">{LEVEL_DESC[level]} Đạt ≥ 90% ba bài liền thì nên lên cấp.</p>

      {level === 1 ? (
        <div className="dh-gen">
          {(Object.keys(GEN_NAMES) as GenKind[]).map((k) => {
            const p = getProgress(`gen:${k}`);
            return (
              <Link key={k} to={lessonHref(`gen:${k}`)} className={`dh-gen__item card${k === 'mixed' ? ' dh-gen__item--mix' : ''}`}>
                <strong>{GEN_NAMES[k]}</strong><span className="small muted">{GEN_HINT[k]}</span>
                {p && <span className={`badge ${p.done ? 'badge--ok' : ''}`}>{p.done ? `${Math.round(lessonScore(p) * 100)}%` : 'đang dở'}</span>}
              </Link>
            );
          })}
        </div>
      ) : (
        <>
          {mFilter && <p className="small">Đang xem các bài của <strong>{db.materials[mFilter]?.title ?? mFilter}</strong> · <button className="btn btn--text btn--sm" onClick={() => setLevel(level)}>Xem tất cả</button></p>}
          <div className="dh-filters">
            <select className="input input--sm" value={vol} onChange={(e) => setVol(+e.target.value)} aria-label="VOL">
              <option value={0}>Mọi VOL</option>{vols.map((v) => <option key={v} value={v}>VOL {v}</option>)}
            </select>
            <select className="input input--sm" value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Trạng thái">
              {STATUS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
          {topics.length > 1 && (
            <ScrollRow label="Chủ đề">
              <button className={`tabs__btn${!topic ? ' is-on' : ''}`} onClick={() => setTopic('')}>Tất cả chủ đề</button>
              {topics.map((t) => <button key={t} className={`tabs__btn${topic === t ? ' is-on' : ''}`} onClick={() => setTopic(topic === t ? '' : t)}>{t}</button>)}
            </ScrollRow>
          )}
          {!groups.length && <p className="empty">Không có bài phù hợp bộ lọc.</p>}
          <ul className="dh-list">
            {groups.slice(0, limit).map(([mid, ls]) => {
              const pid = parseId(mid);
              const m = db.materials[mid];
              return (
                <li key={mid} className="dh-sec card">
                  <div className="dh-sec__head"><strong>{pid ? `${testName(pid)} · Section ${m && m.skill === 'listening' ? m.section : '?'}` : m?.title}</strong>{m?.topic && <span className="small muted">{m.topic}</span>}</div>
                  <div className="dh-sec__lessons">
                    {ls.map((l) => {
                      const p = getProgress(l.id); const st = statusOf(p);
                      return (
                        <Link key={l.id} to={lessonHref(l.id)} className={`dh-chip dh-chip--${st}`} title={`${l.sentences.length} câu`}>
                          {l.part}{st === 'done' ? ` · ${Math.round(lessonScore(p!) * 100)}%` : st === 'doing' ? ' · dở' : ''}
                        </Link>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
          {groups.length > limit && <button className="btn btn--ghost" onClick={() => setLimit(limit + 30)}>Xem thêm ({groups.length - limit} section)</button>}
        </>
      )}
    </div>
  );
}
