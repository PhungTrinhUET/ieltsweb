// Một bài tập từ vựng (A2/A3): giới thiệu từ, chọn nghĩa/chọn từ/nghe chọn, điền câu, gõ từ, chép câu.
// Trả lời xong hiện đúng/sai + đáp án; câu chọn đúng tự sang sau 0,8 s; Enter = tiếp. Phím 1–4 chọn phương án.
import { useEffect, useRef, useState } from 'react';
import { Check, Lightbulb, Volume2, X } from 'lucide-react';
import type { VocabCard } from '../types';
import { type Ex, judgeTyped } from '../lib/vocab';
import { check as checkDict } from '../lib/dictation';
import { playClip } from '../lib/context';
import { speak, ttsAvailable } from '../lib/tts';
import ContextList from './ContextList';

export interface ExResult { ok: boolean; near?: boolean; hint?: boolean; ms: number; score?: number; typing?: boolean }

export const sayWord = (w: string, rate = 0.9) => ttsAvailable() && speak(w, { rate, voice: 'en-GB' });

export function WordHead({ c, big }: { c: VocabCard; big?: boolean }) {
  return (
    <div className={`lt-word${big ? ' lt-word--big' : ''}`}>
      <strong>{c.word}</strong>
      <button className="icon-btn" onClick={() => sayWord(c.word)} aria-label="Phát âm"><Volume2 size={20} /></button>
      {c.ipa && <span className="lt-ipa">{c.ipa}</span>}
    </div>
  );
}

export default function VocabEx({ ex, onDone, onKnow, label }: { ex: Ex; onDone: (r: ExResult) => void; onKnow?: () => void; label?: React.ReactNode }) {
  const c = ex.card;
  const t0 = useRef(Date.now());
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [hint, setHint] = useState(0);
  const [res, setRes] = useState<ExResult | null>(null);
  const [marks, setMarks] = useState<ReturnType<typeof checkDict> | null>(null);
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const timer = useRef<number>(0);
  // Bước giới thiệu = thẻ lật: mặt trước là từ (+ âm), lật ra nghĩa, ví dụ, câu trong đề.
  const [flipped, setFlipped] = useState(false);

  const playSentence = () => { if (ex.clip) playClip(ex.clip.audio, ex.clip.start, ex.clip.end); else if (ex.sentence) sayWord(ex.sentence, 0.85); };
  const audio = () => (ex.step === 'dictate' ? playSentence() : sayWord(c.word));
  // Tự phát: giới thiệu, nghe chọn, gõ theo âm, chép câu.
  useEffect(() => {
    if (ex.step === 'intro' || ex.step === 'listen' || (ex.step === 'type' && ex.mode === 'audio') || ex.step === 'dictate') audio();
    else if (ex.step === 'meaning') sayWord(c.word);
    input.current?.focus();
    return () => clearTimeout(timer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (r: ExResult) => { clearTimeout(timer.current); onDone(r); };
  const pick = (i: number) => {
    if (res) return;
    const ok = i === ex.answer;
    const r = { ok, ms: Date.now() - t0.current };
    setPicked(i); setRes(r);
    if (ex.step !== 'meaning') sayWord(c.word);
    if (ok) timer.current = window.setTimeout(() => finish(r), 900);
  };
  const submit = () => {
    if (res) return finish(res);
    if (ex.step === 'dictate') {
      const m = checkDict(ex.target!, typed); setMarks(m);
      setRes({ ok: m.score >= 0.9, near: m.score >= 0.9 && m.score < 1, hint: hint > 0, ms: Date.now() - t0.current, score: m.score, typing: true });
      return;
    }
    const j = judgeTyped(typed, ex.target!);
    setRes({ ok: j !== 'no', near: j === 'near', hint: hint > 0, ms: Date.now() - t0.current, typing: true });
    sayWord(c.word);
  };
  const giveHint = () => {
    if (res || !ex.target) return;
    const n = hint + 1; setHint(n);
    if (ex.step === 'dictate') { const w = ex.target.split(/\s+/); setTyped(w.slice(0, n).join(' ') + ' '); }
    else setTyped(ex.target.slice(0, n));
    input.current?.focus();
  };

  const choiceUi = !!ex.options && (ex.step !== 'fill' || !!ex.choose);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (ex.step === 'intro' && (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') && tag !== 'INPUT') { e.preventDefault(); if (!flipped) setFlipped(true); else finish({ ok: true, ms: Date.now() - t0.current }); return; }
      if (choiceUi && !res && /^[1-4]$/.test(e.key) && tag !== 'INPUT') { e.preventDefault(); pick(+e.key - 1); return; }
      if (res && e.key === 'Enter' && tag !== 'TEXTAREA') { e.preventDefault(); finish(res); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });

  const prompt = (() => {
    switch (ex.step) {
      case 'intro': return null;
      case 'meaning': return <><WordHead c={c} /><p className="lt-ask">Chọn nghĩa đúng</p></>;
      case 'word': return <><p className="lt-mean">{c.meaning}</p>{c.meaningEn && <p className="small muted">{c.meaningEn}</p>}<p className="lt-ask">Chọn từ tiếng Anh</p></>;
      case 'listen': return <><button className="lt-listen" onClick={audio} aria-label="Nghe lại"><Volume2 size={34} /></button><p className="lt-ask">Nghe rồi chọn từ</p></>;
      case 'fill': return <><p className="lt-ex lt-ex--fill">{ex.sentence}</p><p className="lt-ask">{ex.choose ? 'Chọn từ điền vào chỗ trống' : `Gõ từ còn thiếu (${c.meaning})`}</p></>;
      case 'type': return ex.mode === 'audio'
        ? <><button className="lt-listen" onClick={audio} aria-label="Nghe lại"><Volume2 size={34} /></button><p className="lt-ask">Nghe rồi gõ lại từ</p></>
        : <><p className="lt-mean">{c.meaning}</p>{c.pos && <em className="vocab__pos">{c.pos}</em>}<p className="lt-ask">Gõ từ tiếng Anh</p></>;
      case 'dictate': return <><button className="lt-listen" onClick={audio} aria-label="Nghe lại"><Volume2 size={34} /></button><p className="lt-ask">Nghe và chép lại cả câu</p></>;
    }
  })();

  return (
    <div className="lt-card card" data-step={ex.step} data-testid="vx">
      <div className="lt-card__tag">{label}{c.pos && ex.step !== 'type' && <em className="vocab__pos">{c.pos}</em>}</div>

      {ex.step === 'intro' && !flipped ? (
        <div className="lt-flip" role="button" tabIndex={0} onClick={() => setFlipped(true)} data-testid="vx-front">
          <WordHead c={c} big />
          <p className="lt-ask">Bạn có nhớ nghĩa? Nghĩ trong đầu rồi lật thẻ.</p>
          <div className="lt-actions"><button className="btn btn--primary btn--lg" onClick={(e) => { e.stopPropagation(); setFlipped(true); }} autoFocus>Lật thẻ <small>Enter</small></button></div>
        </div>
      ) : ex.step === 'intro' ? (
        <div className="lt-flip is-back">
          <WordHead c={c} big />
          <p className="lt-mean">{c.meaning}</p>
          {c.meaningEn && <p className="lt-en">{c.meaningEn}</p>}
          {c.example && <p className="lt-ex">{c.example}{c.exampleVi && <span className="lt-exvi">{c.exampleVi}</span>}</p>}
          {c.colloc?.length ? <div className="lt-colloc">{c.colloc.map((x) => <span key={x} className="chip">{x}</span>)}</div> : null}
          {c.context ? (
            <div className="ctx"><div className="ctx__title small muted">Câu bạn đã lưu</div><p>{c.context.text}</p>{c.context.label && <span className="small muted">{c.context.label}</span>}</div>
          ) : <ContextList word={c.word} max={1} />}
          <div className="lt-actions"><button className="btn btn--primary btn--lg" onClick={() => finish({ ok: true, ms: Date.now() - t0.current })} autoFocus>Đã nhớ, tiếp <small>Enter</small></button></div>
        </div>
      ) : (
        <>
          {prompt}
          {choiceUi ? (
            <div className="lt-opts" role="group">
              {ex.options!.map((o, i) => {
                const st = res ? (i === ex.answer ? ' is-right' : i === picked ? ' is-wrong' : ' is-dim') : '';
                return <button key={i} className={`lt-opt${st}`} onClick={() => pick(i)} disabled={!!res} data-right={i === ex.answer ? '' : undefined}><kbd>{i + 1}</kbd><span>{o}</span></button>;
              })}
            </div>
          ) : (
            <form className="lt-type" data-target={ex.target} onSubmit={(e) => { e.preventDefault(); submit(); }}>
              {ex.step === 'dictate'
                ? <textarea ref={input} className={`textarea dl-input${res ? (res.ok ? ' is-correct' : ' is-wrong') : ''}`} rows={2} value={typed} readOnly={!!res}
                    onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} placeholder="Gõ cả câu…" spellCheck={false} />
                : <input ref={input} className={`input input--lg${res ? (res.ok ? (res.near ? ' is-mid' : ' is-correct') : ' is-wrong') : ''}`} value={typed} readOnly={!!res}
                    onChange={(e) => setTyped(e.target.value)} placeholder="Gõ từ tiếng Anh…" spellCheck={false} autoComplete="off" autoCapitalize="off" aria-label="Từ cần gõ" />}
              {!res && <div className="row"><button type="button" className="btn btn--ghost" onClick={giveHint}><Lightbulb size={16} /> Gợi ý</button><button className="btn btn--primary" type="submit">Kiểm tra</button></div>}
            </form>
          )}
          {res && (
            <div className="lt-feedback">
              <div className={res.ok ? (res.near ? 'mid-text' : 'ok-text') : 'no-text'}>
                {res.ok ? <><Check size={16} /> {res.near ? 'Gần đúng – sai một chữ cái' : 'Chính xác'}</> : <><X size={16} /> Chưa đúng</>}
                {(!res.ok || res.near || ex.step === 'fill') && <> · <strong>{ex.target ?? c.word}</strong></>}
              </div>
              {marks && <p className="dl-marked">{ex.target!.split(/\s+/).map((w, k) => <span key={k} className={`dl-w dl-w--${marks.marks[k] ?? 'ok'}`}>{w} </span>)}</p>}
              {ex.step !== 'dictate' && <p className="small"><strong>{c.word}</strong> {c.ipa} – {c.meaning}</p>}
              <div className="lt-actions"><button className={`btn btn--lg ${res.ok ? 'lt-yes' : 'lt-no'}`} onClick={() => finish(res)} autoFocus>Tiếp <small>Enter</small></button></div>
            </div>
          )}
          {!res && onKnow && <button className="btn btn--text btn--sm lt-know" onClick={onKnow}>Tôi biết từ này</button>}
        </>
      )}
    </div>
  );
}
