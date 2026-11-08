// Trang một đề (VOL N · Test M): chọn từng phần (Section / Passage / Task) hoặc làm cả đề một lần.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, GraduationCap, Play, Timer } from 'lucide-react';
import type { Material, Skill } from '../types';
import { useDb } from '../db';
import { fmtBand, rawToBand } from '../lib/band';
import { BANK_TEST, SECTION_DESC, bestResults, groupByTest, partLabel, saveMode, savedMode, shortTitle, testName } from '../lib/tests';
import { SKILL_META, subtitle } from './SkillList';
import { useSettings } from '../store';
import { QKIND_LABEL, materialKinds } from '../lib/qtypes';

const nQ = (m: Material) => ('groups' in m ? m.groups.reduce((n, g) => n + g.questions.length, 0) : 0);

export default function TestPage() {
  const { skill, tid } = useParams<{ skill: Skill; tid: string }>();
  const db = useDb();
  const s = useSettings();
  const t = useMemo(() => groupByTest(Object.values(db.materials), skill!).tests.get(tid!), [db.materials, skill, tid]);
  const results = useMemo(() => bestResults(db.attempts), [db.attempts]);
  const [mode, setModeState] = useState(() => savedMode(skill!));
  const setMode = (v: 'practice' | 'test') => { setModeState(v); saveMode(skill!, v); };
  if (!skill || !SKILL_META[skill]) return null;
  const meta = SKILL_META[skill];
  if (!t) return <div className="page"><p className="empty">Không tìm thấy đề.</p></div>;
  const dual = skill === 'reading' || skill === 'listening';
  const total = t.parts.reduce((n, m) => n + nQ(m), 0);
  const doneParts = t.parts.filter((m) => results.has(m.id));
  const sum = doneParts.reduce((n, m) => n + results.get(m.id)!.score, 0);
  const allDone = dual && doneParts.length === t.parts.length;
  const minutes = skill === 'reading' ? 60 : 32;
  const lastAi = (id: string) => db.attempts.find((a) => a.materialId === id && (a.mode === 'ai' || a.mode === 'self'));

  return (
    <div className="page" style={{ ['--skill' as string]: meta.color }}>
      <div className="topbar">
        <Link className="icon-btn" to={`/${skill}`} aria-label="Quay lại"><ArrowLeft size={20} /></Link>
        <div className="topbar__title"><small>{meta.label}</small><strong>{testName(t)}</strong></div>
      </div>

      {dual && (
        <div className="fullmodes">
          <div className={`fulltest card${mode === 'practice' ? ' is-on' : ''}`}>
            <div className="fulltest__body">
              <strong><GraduationCap size={17} /> Luyện tập cả đề</strong>
              <span className="muted small">Không tính giờ · đi lần lượt {t.parts.length} {skill === 'listening' ? 'section' : 'passage'} · tra từ, dịch, xem đáp án và giải thích từng câu</span>
            </div>
            <Link to={`/${skill}/${t.parts[0].id}/practice`} onClick={() => setMode('practice')} className={`btn ${mode === 'practice' ? 'btn--primary' : 'btn--ghost'}`}><GraduationCap size={17} /> Luyện tập</Link>
          </div>
          <div className={`fulltest card${mode === 'test' ? ' is-on' : ''}`}>
            <div className="fulltest__body">
              <strong><Timer size={17} /> Thi thử cả đề</strong>
              <span className="muted small">
                {skill === 'listening' ? `${t.parts.length} section liên tiếp, một đồng hồ ~30 phút + 2 phút kiểm tra` : `${t.parts.length} passage, một đồng hồ ${minutes} phút`} · {total} câu · nộp một lần, chấm band
              </span>
              {allDone && <span className="small">Tổng điểm tốt nhất các phần: <strong>{sum}/{total}</strong> · Band {fmtBand(rawToBand(skill, sum, total, s.module))}</span>}
            </div>
            <Link to={`/test/${skill}/${t.key}/full`} onClick={() => setMode('test')} className={`btn ${mode === 'test' ? 'btn--primary' : 'btn--ghost'}`}><Timer size={17} /> Thi thử</Link>
          </div>
        </div>
      )}

      <h2 className="h2">{t.test === BANK_TEST ? 'Các đề' : dual ? 'Hoặc làm từng phần' : 'Các task'}</h2>
      <ul className="items items--1">
        {t.parts.map((m) => {
          const r = results.get(m.id); const ai = lastAi(m.id); const band = ai?.band ?? ai?.selfBand;
          return (
            <li key={m.id} className={`item item--part${r ? (r.score / (r.max || 1) >= 0.7 ? ' item--done' : ' item--wrong') : ai ? ' item--done' : ''}`}>
              <div className="item__no">{r ? <Check size={16} /> : partLabel(m).replace(/^(\w)\w+ /, '$1')}</div>
              <div className="item__body">
                <div className="item__title"><strong>{partLabel(m)}</strong> – {shortTitle(m).replace(/^(Section|Passage|Task) \d+\s*[–:-]\s*/, '')}</div>
                <div className="item__sub">{m.skill === 'listening' && m.section ? SECTION_DESC[m.section] + ' · ' : ''}{subtitle(m)}{r ? ` · Tốt nhất ${r.score}/${r.max}` : band ? ` · Band ${fmtBand(band)}` : ''}</div>
                {dual && <div className="kchips">{materialKinds(m).map((k) => <span key={k} className="kchip">{QKIND_LABEL[k]}</span>)}</div>}
              </div>
              <div className="item__actions">
                {dual ? <>
                  <Link to={`/${skill}/${m.id}/practice`} onClick={() => setMode('practice')} className={`btn btn--sm ${mode === 'practice' ? 'btn--primary' : 'btn--ghost'}`} title="Không tính giờ, xem đáp án từng câu"><GraduationCap size={15} /> Luyện tập</Link>
                  <Link to={`/${skill}/${m.id}`} onClick={() => setMode('test')} className={`btn btn--sm ${mode === 'test' ? 'btn--primary' : 'btn--ghost'}`} title="Bấm giờ, nộp bài mới xem đáp án"><Play size={15} /> Thi thử</Link>
                </> : <Link to={`/${skill}/${m.id}`} className="btn btn--primary btn--sm">Làm <ChevronRight size={15} /></Link>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
