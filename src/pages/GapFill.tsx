// Điền từ vào transcript: che các từ khoá (mật độ chọn được), nghe audio / giọng máy rồi gõ lại.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Pause, Play, RotateCcw } from 'lucide-react';
import type { ListeningMaterial } from '../types';
import { addAttempt, resolveUrl, useDb } from '../db';
import { touchStreak } from '../store';
import AudioPlayer, { stopAudio, type AudioHandle } from '../components/AudioPlayer';
import { cleanWord, isKeyword, normAnswer } from '../lib/text';
import { ttsAvailable } from '../lib/tts';
import { useScriptSpeaker } from './ListeningTest';
import { SKILL_META } from './SkillList';

export default function GapFill() {
  const { id } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const m = db.materials[id!] as ListeningMaterial | undefined;
  const [density, setDensity] = useState(4); // 1 trong N từ khoá
  const [seed, setSeed] = useState(0);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const audio = useRef<AudioHandle>(null);
  const sp = useScriptSpeaker(m);
  useEffect(() => { if (m?.audio) resolveUrl(m.audio).then(setSrc); touchStreak(); return () => { stopAudio(); }; }, [id]); // eslint-disable-line

  const lines = useMemo(() => (m ? m.transcript.split('\n').map((l) => l.trim()).filter(Boolean) : []), [m]);
  // Mỗi token: { t, gap: index | null }
  const tokens = useMemo(() => {
    let n = 0, gi = 0;
    const off = seed % density;
    return lines.map((l) => {
      const sm = l.match(/^([A-Z][A-Za-z ]{0,20}):\s*/);
      const body = sm ? l.slice(sm[0].length) : l;
      return { speaker: sm?.[1], toks: body.split(/(\s+)/).map((t) => {
        if (!/\S/.test(t) || !isKeyword(t)) return { t, gap: null as number | null };
        n++;
        return { t, gap: n % density === off ? gi++ : null };
      }) };
    });
  }, [lines, density, seed]);
  const gaps = tokens.flatMap((l) => l.toks.filter((t) => t.gap !== null));
  const correct = gaps.filter((g) => normAnswer(vals[g.gap!] ?? '') === normAnswer(cleanWord(g.t))).length;

  if (!m) return <div className="page"><p className="empty">Không tìm thấy bài.</p></div>;
  const submit = async () => {
    setChecked(true); sp.halt(); stopAudio();
    await addAttempt({ materialId: m.id, skill: 'listening', title: m.title, mode: 'gapfill', score: correct, max: gaps.length, detail: { density,
      items: tokens.filter((l) => l.toks.some((t) => t.gap !== null)).map((l) => {
        const ok = (t: { t: string; gap: number | null }) => normAnswer(vals[t.gap!] ?? '') === normAnswer(cleanWord(t.t));
        const gs = l.toks.filter((t) => t.gap !== null);
        return { text: l.toks.map((t) => t.t).join('').trim(), typed: l.toks.map((t) => (t.gap === null ? t.t : `[${vals[t.gap] ?? '…'}]`)).join('').trim(), score: gs.filter(ok).length / gs.length, wrongWords: gs.filter((t) => !ok(t)).map((t) => cleanWord(t.t)) };
      }) } });
  };
  const reset = () => { setVals({}); setChecked(false); setSeed((s) => s + 1); };

  return (
    <div className="page page--practice" style={{ ['--skill' as string]: SKILL_META.listening.color }}>
      <div className="topbar topbar--sticky">
        <button className="icon-btn" onClick={() => nav(`/listening/${m.id}`)} aria-label="Quay lại"><ArrowLeft size={20} /></button>
        <div className="topbar__title"><small>Điền từ transcript · {gaps.length} chỗ trống</small><strong>{m.title}</strong></div>
      </div>
      {m.audio ? <AudioPlayer ref={audio} src={src} /> : (
        <div className="audio">
          <button className="audio__play" onClick={() => (sp.line === null ? sp.play() : sp.halt())} disabled={!ttsAvailable()}>{sp.line === null ? <Play size={22} fill="currentColor" /> : <Pause size={22} fill="currentColor" />}</button>
          <div className="audio__body"><div className="audio__label">Giọng đọc máy</div><div className="audio__meta"><span>{sp.line === null ? 'Bấm để nghe cả bài' : `Dòng ${sp.line + 1}/${sp.lines.length}`}</span></div></div>
        </div>
      )}
      <div className="row wrap">
        <span className="small muted">Độ khó (che 1 trong N từ khoá):</span>
        {[6, 4, 3, 2].map((d) => <button key={d} className={`chip${density === d ? ' is-on' : ''}`} onClick={() => { setDensity(d); setVals({}); setChecked(false); }} disabled={checked}>{d === 6 ? 'Dễ' : d === 4 ? 'Vừa' : d === 3 ? 'Khó' : 'Rất khó'}</button>)}
      </div>
      <article className="passage gapfill card">
        {tokens.map((l, li) => (
          <p key={li} className={sp.line === li ? 'is-reading' : ''}>
            {l.speaker && <strong>{l.speaker}: </strong>}
            {l.toks.map((t, ti) => t.gap === null ? <span key={ti}>{t.t}</span> : (
              <span key={ti} className="gap">
                {t.t.match(/^[^A-Za-z0-9']*/)?.[0]}
                <input className={`blank blank--gap${checked ? (normAnswer(vals[t.gap] ?? '') === normAnswer(cleanWord(t.t)) ? ' is-correct' : ' is-wrong') : ''}`} value={vals[t.gap] ?? ''} disabled={checked} onChange={(e) => setVals((v) => ({ ...v, [t.gap!]: e.target.value }))} style={{ width: `${Math.max(4, cleanWord(t.t).length + 1)}ch` }} spellCheck={false} autoComplete="off"
                  onKeyDown={(e) => { if (e.key === 'Enter') { const inputs = [...document.querySelectorAll<HTMLInputElement>('.blank--gap')]; inputs[inputs.indexOf(e.currentTarget) + 1]?.focus(); } }} />
                {checked && normAnswer(vals[t.gap] ?? '') !== normAnswer(cleanWord(t.t)) && <span className="gap__fix">{cleanWord(t.t)}</span>}
                {t.t.match(/[^A-Za-z0-9']*$/)?.[0]}
              </span>
            ))}
          </p>
        ))}
      </article>
      <div className="actionbar"><div className="actionbar__inner">
        <span className={`result${checked ? (correct / gaps.length >= 0.8 ? ' result--ok' : ' result--mid') : ''}`}>{checked ? `${correct}/${gaps.length} đúng` : `${Object.values(vals).filter(Boolean).length}/${gaps.length} đã điền`}</span>
        {checked ? <button className="btn btn--ghost" onClick={reset}><RotateCcw size={16} /> Làm lại (vị trí khác)</button> : <button className="btn btn--primary" onClick={submit}><Check size={18} /> Kiểm tra</button>}
      </div></div>
    </div>
  );
}
