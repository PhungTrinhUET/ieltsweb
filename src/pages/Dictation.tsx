// Chép chính tả theo câu (kiểu DailyDictation): nghe một câu → gõ → kiểm tra từng từ → đọc lại (shadowing) → câu tiếp.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Eye, Lightbulb, Mic, Play, Repeat, SkipForward } from 'lucide-react';
import type { ListeningMaterial } from '../types';
import { addAttempt, resolveUrl, useDb } from '../db';
import { touchStreak, updateSettings, useSettings } from '../store';
import AudioPlayer, { stopAudio, type AudioHandle } from '../components/AudioPlayer';
import Recorder, { type Recording } from '../components/Recorder';
import { accuracy, maskWord, sentences, wordDiff } from '../lib/text';
import { speak, stopSpeak, ttsAvailable } from '../lib/tts';
import { SKILL_META } from './SkillList';

interface Unit { text: string; start?: number; end?: number; speaker?: string }

export default function Dictation() {
  const { id } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const s = useSettings();
  const m = db.materials[id!] as ListeningMaterial | undefined;
  const useAudio = !!(m?.audio && m.segments?.length);
  const [skipNarrator, setSkipNarrator] = useState(true);
  const hasNarrator = !!m?.segments?.some((g) => g.speaker === 'Narrator');
  const units = useMemo<Unit[]>(() => {
    if (!m) return [];
    if (useAudio) return m.segments!.filter((g) => !skipNarrator || g.speaker !== 'Narrator').map((g) => ({ text: g.text, start: g.start, end: g.end, speaker: g.speaker }));
    return m.transcript.split('\n').map((l) => l.trim()).filter(Boolean).flatMap((l) => {
      const sm = l.match(/^([A-Z][A-Za-z ]{0,20}):\s*/);
      const body = sm ? l.slice(sm[0].length) : l;
      return sentences(body).map((t) => ({ text: t, speaker: sm?.[1] }));
    });
  }, [m, useAudio, skipNarrator]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const [reveal, setReveal] = useState(0); // số chữ cái gợi ý mỗi từ
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState<number[]>([]);
  const [plays, setPlays] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const [shadow, setShadow] = useState(false);
  const [rec, setRec] = useState<Recording | null>(null);
  const audio = useRef<AudioHandle>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const u = units[i];

  useEffect(() => { if (m?.audio) resolveUrl(m.audio).then(setSrc); touchStreak(); return () => { stopAudio(); stopSpeak(); }; }, [id]); // eslint-disable-line
  const playUnit = () => {
    if (!u) return;
    setPlays((p) => p + 1);
    if (useAudio && u.start !== undefined) audio.current?.playRange(u.start, u.end ?? u.start + 8);
    else speak(u.text, { voice: m?.voice });
    input.current?.focus();
  };
  useEffect(() => { const t = setTimeout(playUnit, 300); return () => clearTimeout(t); }, [i, src]); // eslint-disable-line

  const check = () => {
    if (!u || checked) return;
    setChecked(true);
    setResults((r) => { const n = [...r]; n[i] = accuracy(u.text, typed); return n; });
  };
  const next = async () => {
    if (i + 1 >= units.length) {
      const avg = results.length ? results.reduce((a, b) => a + b, 0) / units.length : 0;
      await addAttempt({ materialId: m!.id, skill: 'listening', title: m!.title, mode: 'dictation', score: Math.round(avg * 100), max: 100, detail: { units: units.length } });
      nav(`/listening/${m!.id}`);
      return;
    }
    setI(i + 1); setTyped(''); setChecked(false); setReveal(0); setShowAnswer(false); setRec(null);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); checked ? next() : check(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); playUnit(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); next(); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }); // phụ thuộc state mới nhất

  if (!m) return <div className="page"><p className="empty">Không tìm thấy bài.</p></div>;
  if (!units.length) return <div className="page"><p className="empty">Bài này chưa có transcript.</p></div>;
  const acc = results[i];
  const diff = checked ? wordDiff(u.text, typed) : [];
  const hint = u.text.split(/\s+/).map((w) => maskWord(w, reveal)).join(' ');
  const overall = results.filter((x) => x !== undefined);
  const avg = overall.length ? overall.reduce((a, b) => a + b, 0) / overall.length : 0;

  return (
    <div className="page page--practice" style={{ ['--skill' as string]: SKILL_META.listening.color }}>
      <div className="topbar topbar--sticky">
        <button className="icon-btn" onClick={() => nav(`/listening/${m.id}`)} aria-label="Quay lại"><ArrowLeft size={20} /></button>
        <div className="topbar__title"><small>Chép chính tả · câu {i + 1}/{units.length}</small><strong>{m.title}</strong></div>
        <div className="topbar__actions">{hasNarrator && <button className={`chip${skipNarrator ? ' is-on' : ''}`} onClick={() => { setSkipNarrator(!skipNarrator); setI(0); setResults([]); }} title="Bỏ qua lời dẫn của đề (Section one. You will hear…)">Bỏ lời dẫn</button>}<span className="badge badge--ok">Đúng {Math.round(avg * 100)}%</span></div>
        <div className="topbar__progress" style={{ width: `${(i / units.length) * 100}%` }} />
      </div>

      {useAudio && <div hidden><AudioPlayer ref={audio} src={src} compact /></div>}

      <div className="dict card">
        <div className="dict__play">
          <button className="audio__play" onClick={playUnit} aria-label="Nghe lại"><Play size={24} fill="currentColor" /></button>
          <div>
            <div className="small muted">{u.speaker ? <strong>{u.speaker}: </strong> : null}Đã nghe {plays} lần · {u.text.split(/\s+/).length} từ{!useAudio && ' · giọng máy'}</div>
            <div className="dict__speed">
              Tốc độ: {[0.6, 0.8, 1, 1.2].map((r) => <button key={r} className={`chip${(useAudio ? s.speed : s.ttsRate) === r ? ' is-on' : ''}`} onClick={() => updateSettings(useAudio ? { speed: r } : { ttsRate: r })}>{r}×</button>)}
            </div>
          </div>
        </div>
        {!checked && reveal > 0 && <p className="dict__hint">{hint}</p>}
        {!checked && showAnswer && <p className="dict__hint dict__hint--full">{u.text}</p>}
        <textarea ref={input} className={`textarea textarea--dict${checked ? (acc >= 0.9 ? ' is-correct' : ' is-wrong') : ''}`} rows={3} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={checked} placeholder="Gõ những gì bạn nghe được… (Enter để kiểm tra, Ctrl+Enter nghe lại)" spellCheck={false} autoFocus />
        {checked && (
          <div className="dict__result">
            <div className={acc >= 0.9 ? 'ok-text' : acc >= 0.6 ? 'mid-text' : 'no-text'}><strong>{Math.round(acc * 100)}%</strong> từ đúng</div>
            <p className="wdiff">
              {diff.map((o, k) => o.op === 'eq' ? <span key={k}>{o.a} </span> : o.op === 'del' ? <span key={k} className="wd-miss" title="bạn bỏ sót">{o.a} </span> : o.op === 'ins' ? <span key={k} className="wd-extra" title="thừa">{o.b} </span> : <span key={k}><span className="wd-wrong">{o.b}</span><span className="wd-fix">{o.a}</span> </span>)}
            </p>
            <p className="dict__answer">{u.text}</p>
          </div>
        )}
        <div className="dict__actions">
          {!checked ? (
            <>
              <button className="btn btn--ghost btn--sm" onClick={() => setReveal((r) => Math.min(3, r + 1))}><Lightbulb size={15} /> Gợi ý {reveal > 0 && `(${reveal} chữ)`}</button>
              <button className="btn btn--ghost btn--sm" onClick={() => setShowAnswer(true)}><Eye size={15} /> Xem đáp án</button>
              <button className="btn btn--text btn--sm" onClick={next}><SkipForward size={15} /> Bỏ qua</button>
              <span style={{ flex: 1 }} />
              <button className="btn btn--primary" onClick={check}><Check size={18} /> Kiểm tra</button>
            </>
          ) : (
            <>
              <button className="btn btn--ghost btn--sm" onClick={playUnit}><Repeat size={15} /> Nghe lại</button>
              <button className={`btn btn--sm ${shadow ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setShadow(!shadow)}><Mic size={15} /> Shadowing</button>
              <span style={{ flex: 1 }} />
              <button className="btn btn--primary" onClick={next}>{i + 1 >= units.length ? 'Hoàn thành' : 'Câu tiếp'} <ArrowRight size={18} /></button>
            </>
          )}
        </div>
        {checked && shadow && (
          <div className="dict__shadow">
            <p className="small muted">Nghe lại câu rồi đọc theo, cố bắt chước ngữ điệu và nối âm. Ghi âm để so với bản gốc.</p>
            <Recorder onDone={setRec} maxSeconds={30} label="Ghi âm bạn đọc câu này" />
            {rec && <div className="row"><audio src={rec.url} controls className="audio-native" />{rec.transcript && <span className="small muted">Máy nghe được: “{rec.transcript}”</span>}</div>}
          </div>
        )}
      </div>
      <p className="muted small">Mẹo: nghe 2–3 lần trước khi gõ; từ nghe không ra hãy đoán theo ngữ pháp (số nhiều, quá khứ -ed, mạo từ) rồi kiểm tra. Mục tiêu ≥ 90% mỗi câu.</p>
      <div className="dict__dots">{units.map((_, k) => <span key={k} className={`dot-s${results[k] !== undefined ? (results[k] >= 0.9 ? ' is-ok' : ' is-no') : ''}${k === i ? ' is-cur' : ''}`} onClick={() => { setI(k); setTyped(''); setChecked(false); setReveal(0); setShowAnswer(false); }} />)}</div>
    </div>
  );
}
