// Danh sách đề Writing: 3 tab (Task 1 Academic / Task 1 General / Task 2), chip dạng bài có đếm, lọc nguồn / chủ đề / trạng thái,
// thẻ "Cách làm dạng này" cho từng dạng.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FolderInput, NotebookPen } from 'lucide-react';
import type { WritingMaterial, WritingType } from '../types';
import { useDb } from '../db';
import { fmtBand } from '../lib/band';
import { BANK_TEST, parseId } from '../lib/tests';
import { topicGroup, TOPIC_GROUPS } from '../lib/topics';
import { STRUCTURE, TAB_LABEL, TAB_TYPES, TIPS, TYPE_LABEL, sourceLabel, tabOf, type WTab } from '../lib/writing';
import { Collapse } from '../components/ui';
import ScrollRow from '../components/ScrollRow';
import { SKILL_META } from './SkillList';

type Status = '' | 'todo' | 'self' | 'ai';
const STATUS_LABEL: Record<Exclude<Status, ''>, string> = { todo: 'Chưa làm', self: 'Đã nộp', ai: 'AI đã chấm' };
const load = <T extends string>(k: string, d: T): T => { try { return (localStorage.getItem(k) as T) || d; } catch { return d; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };

export default function WritingList() {
  const db = useDb();
  const meta = SKILL_META.writing;
  const [tab, setTabS] = useState<WTab>(() => load<WTab>('ielts-wtab', 't1a'));
  const setTab = (t: WTab) => { setTabS(t); save('ielts-wtab', t); setType(''); setPurpose(''); };
  const [type, setType] = useState<WritingType | ''>('');
  const [purpose, setPurpose] = useState('');
  const [src, setSrc] = useState<string>(''); // '' | 'bank' | 'vol<N>'
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState<Status>('');
  const [q, setQ] = useState('');

  const all = useMemo(() => (Object.values(db.materials).filter((m) => m.skill === 'writing') as WritingMaterial[]), [db.materials]);
  const info = useMemo(() => new Map(all.map((m) => {
    const p = parseId(m.id);
    return [m.id, { p, src: p?.vol ? `vol${p.vol}` : m.id.startsWith('wr-') ? 'bank' : 'other', label: sourceLabel(m, p, BANK_TEST), topic: topicGroup(m), tab: tabOf(m) }] as const;
  })), [all]);
  const statusOf = useMemo(() => {
    const st = new Map<string, { s: Exclude<Status, '' | 'todo'>; band?: number }>();
    for (const a of db.attempts) { // mới nhất trước
      if (a.skill !== 'writing' || !a.materialId) continue;
      const cur = st.get(a.materialId);
      if (a.mode === 'ai' && (!cur || cur.s !== 'ai')) st.set(a.materialId, { s: 'ai', band: a.band });
      else if (!cur) st.set(a.materialId, { s: 'self', band: a.selfBand });
    }
    return st;
  }, [db.attempts]);

  const vols = useMemo(() => [...new Set(all.map((m) => info.get(m.id)!.p?.vol).filter((v): v is number => !!v))].sort((a, b) => a - b), [all, info]);
  const hasOther = all.some((m) => info.get(m.id)!.src === 'other');
  const inTab = all.filter((m) => info.get(m.id)!.tab === tab);
  const base = inTab.filter((m) => {
    const i = info.get(m.id)!;
    if (src && i.src !== src) return false;
    if (topic && i.topic !== topic) return false;
    const s = statusOf.get(m.id)?.s;
    if (status === 'todo' ? !!s : status && s !== status) return false;
    if (q && !`${m.title} ${m.prompt}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const typeCount = (t: WritingType) => base.filter((m) => m.type === t).length;
  const extraTypes = [...new Set(base.map((m) => m.type))].filter((t) => !TAB_TYPES[tab].includes(t));
  const byType = base.filter((m) => !type || m.type === type);
  const purposes = tab === 't1g' ? [...new Set(byType.map((m) => m.purpose).filter((x): x is string => !!x))].sort() : [];
  const shown = byType.filter((m) => !purpose || m.purpose === purpose)
    .sort((a, b) => { const ia = info.get(a.id)!, ib = info.get(b.id)!; return (ia.p?.vol ?? 99) - (ib.p?.vol ?? 99) || (ia.p?.test ?? 0) - (ib.p?.test ?? 0) || a.id.localeCompare(b.id, 'en', { numeric: true }); });
  const topics = TOPIC_GROUPS.filter((t) => inTab.some((m) => info.get(m.id)!.topic === t));
  const tabCount = (t: WTab) => all.filter((m) => info.get(m.id)!.tab === t).length;
  const Icon = meta.icon;
  const tipType = type || null;

  return (
    <div className="page wlist" style={{ ['--skill' as string]: meta.color }} data-testid="wlist">
      <div className="page-head">
        <span className="skill__icon skill__icon--lg"><Icon size={26} /></span>
        <div><h1>{meta.label}</h1><p>{meta.desc}</p></div>
      </div>
      <div className="wtabs" role="tablist" aria-label="Loại đề">
        {(Object.keys(TAB_LABEL) as WTab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`wtabs__btn${tab === t ? ' is-on' : ''}`} onClick={() => setTab(t)} data-testid={`wtab-${t}`}>
            {TAB_LABEL[t]} <small>{tabCount(t)}</small>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input className="input" placeholder="Tìm đề…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Link to="/library?skill=writing" className="btn btn--ghost"><FolderInput size={16} /> Nạp / tạo đề</Link>
      </div>
      <div className="filters" aria-label="Bộ lọc">
        <div className="filters__row" data-testid="wtypes">
          <span className="filters__label">Dạng</span>
          <button className={`fchip${!type ? ' is-on' : ''}`} aria-pressed={!type} onClick={() => { setType(''); setPurpose(''); }}>Tất cả <small>{base.length}</small></button>
          {[...TAB_TYPES[tab], ...extraTypes].filter((t) => typeCount(t)).map((t) => (
            <button key={t} data-type={t} className={`fchip${type === t ? ' is-on' : ''}`} aria-pressed={type === t} onClick={() => { setType(type === t ? '' : t); setPurpose(''); }}>
              {TYPE_LABEL[t] ?? t} <small>{typeCount(t)}</small>
            </button>
          ))}
        </div>
        {purposes.length > 1 && (
          <div className="filters__row">
            <span className="filters__label">Mục đích</span>
            {purposes.map((p) => <button key={p} className={`fchip${purpose === p ? ' is-on' : ''}`} aria-pressed={purpose === p} onClick={() => setPurpose(purpose === p ? '' : p)}>{p} <small>{byType.filter((m) => m.purpose === p).length}</small></button>)}
          </div>
        )}
        <div className="filters__row" data-testid="wsrc">
          <span className="filters__label">Nguồn</span>
          <button className={`fchip${!src ? ' is-on' : ''}`} aria-pressed={!src} onClick={() => setSrc('')}>Tất cả</button>
          {vols.map((v) => <button key={v} className={`fchip${src === `vol${v}` ? ' is-on' : ''}`} aria-pressed={src === `vol${v}`} onClick={() => setSrc(src === `vol${v}` ? '' : `vol${v}`)}>VOL {v}</button>)}
          <button className={`fchip${src === 'bank' ? ' is-on' : ''}`} aria-pressed={src === 'bank'} onClick={() => setSrc(src === 'bank' ? '' : 'bank')} data-testid="wsrc-bank">Đề tự soạn</button>
          {hasOther && <button className={`fchip${src === 'other' ? ' is-on' : ''}`} aria-pressed={src === 'other'} onClick={() => setSrc(src === 'other' ? '' : 'other')}>Bài mẫu &amp; tự nạp</button>}
        </div>
        <div className="filters__row">
          <span className="filters__label">Trạng thái</span>
          <button className={`fchip${!status ? ' is-on' : ''}`} aria-pressed={!status} onClick={() => setStatus('')}>Tất cả</button>
          {(Object.keys(STATUS_LABEL) as Exclude<Status, ''>[]).map((s) => <button key={s} className={`fchip${status === s ? ' is-on' : ''}`} aria-pressed={status === s} onClick={() => setStatus(status === s ? '' : s)}>{STATUS_LABEL[s]}</button>)}
        </div>
      </div>
      {topics.length > 1 && (
        <ScrollRow label="Chủ đề">
          <button className={`tabs__btn${!topic ? ' is-on' : ''}`} onClick={() => setTopic('')}>Tất cả chủ đề</button>
          {topics.map((t) => <button key={t} className={`tabs__btn${topic === t ? ' is-on' : ''}`} onClick={() => setTopic(topic === t ? '' : t)}>{t}</button>)}
        </ScrollRow>
      )}
      {tipType && TIPS[tipType] && (
        <div className="wtips" data-testid="wtips">
          <Collapse title={`Cách làm dạng này – ${TYPE_LABEL[tipType]}`} tone="tip">
            <div className="wtips__body">
              <div><h4>Bố cục</h4><ol className="plan">{STRUCTURE[tipType].map((s, i) => <li key={i}>{s}</li>)}</ol></div>
              <div><h4>Mẹo</h4><ul>{TIPS[tipType].tips.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
              <p className="wtips__mistake"><strong>Lỗi hay gặp:</strong> {TIPS[tipType].mistake}</p>
            </div>
          </Collapse>
        </div>
      )}
      {shown.length === 0 ? (
        <div className="empty empty--big"><p>{inTab.length ? 'Không có đề nào khớp bộ lọc.' : 'Chưa có đề nào ở mục này.'}</p></div>
      ) : (
        <>
          <p className="muted small" data-testid="wcount">{shown.length} đề</p>
          <ul className="items items--1">
            {shown.map((m) => {
              const i = info.get(m.id)!; const st = statusOf.get(m.id);
              return (
                <li key={m.id}>
                  <Link to={`/writing/${m.id}`} className={`item${st ? ' item--done' : ''}`}>
                    <div className="item__no">{st?.band ? fmtBand(st.band) : <NotebookPen size={16} />}</div>
                    <div className="item__body">
                      <div className="item__title">{m.title.replace(/^.*? · Task \d – /, '')}</div>
                      <div className="item__sub wlist__sub"><span className="wsrc">{i.label}</span> · {TYPE_LABEL[m.type] ?? m.type}{m.purpose ? ` · ${m.purpose}` : ''}{m.topic ? ` · ${m.topic}` : ''}</div>
                    </div>
                    {st && <span className={`wstatus wstatus--${st.s}`}>{st.s === 'ai' ? `AI · Band ${st.band ? fmtBand(st.band) : '–'}` : st.band ? `Đã nộp · ${fmtBand(st.band)}` : 'Đã nộp'}</span>}
                    <ChevronRight size={18} className="item__arrow" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
