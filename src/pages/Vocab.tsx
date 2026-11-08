// Sổ từ vựng + ôn tập theo lặp lại ngắt quãng (flashcard, gõ lại từ, trắc nghiệm).
import { useMemo, useState } from 'react';
import { Check, Keyboard, Layers, ListChecks, Plus, Trash2, Volume2, X } from 'lucide-react';
import { deleteCard, saveCard, useDb } from '../db';
import type { VocabCard } from '../types';
import { dueCards, newCard, previewInterval, review, type Grade } from '../lib/srs';
import { speak } from '../lib/tts';
import { normAnswer, shuffle } from '../lib/text';
import { touchStreak, useSettings } from '../store';

type Mode = 'flash' | 'type' | 'mcq';

export default function Vocab() {
  const db = useDb();
  const s = useSettings();
  const cards = useMemo(() => Object.values(db.vocab).sort((a, b) => b.addedAt - a.addedAt), [db.vocab]);
  const due = useMemo(() => dueCards(cards), [cards]);
  const [session, setSession] = useState<{ mode: Mode; queue: VocabCard[]; i: number; flipped: boolean; typed: string; checked: boolean; pick: number | null; done: number } | null>(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ word: '', pos: '', meaning: '', example: '' });

  const start = (mode: Mode) => {
    const fresh = cards.filter((c) => c.reps === 0 && c.due <= Date.now()).slice(0, s.newCardsPerDay);
    const queue = shuffle([...new Set([...due, ...fresh])]);
    if (!queue.length) return;
    touchStreak();
    setSession({ mode, queue, i: 0, flipped: false, typed: '', checked: false, pick: null, done: 0 });
  };
  const grade = async (g: Grade) => {
    if (!session) return;
    const c = session.queue[session.i];
    await saveCard(review(c, g));
    const queue = g === 0 ? [...session.queue, c] : session.queue; // quên → học lại cuối phiên
    const i = session.i + 1;
    if (i >= queue.length) return setSession(null);
    setSession({ ...session, queue, i, flipped: false, typed: '', checked: false, pick: null, done: session.done + 1 });
  };
  const shown = cards.filter((c) => !q || c.word.toLowerCase().includes(q.toLowerCase()) || c.meaning.toLowerCase().includes(q.toLowerCase()));

  if (session) {
    const c = session.queue[session.i];
    const options = session.mode === 'mcq' ? shuffle([c, ...shuffle(cards.filter((x) => x.id !== c.id)).slice(0, 3)]) : [];
    const typedOk = normAnswer(session.typed) === normAnswer(c.word);
    return (
      <div className="page" style={{ ['--skill' as string]: 'var(--primary)' }}>
        <div className="topbar">
          <button className="icon-btn" onClick={() => setSession(null)} aria-label="Thoát"><X size={20} /></button>
          <div className="topbar__title"><small>Ôn từ vựng</small><strong>{session.i + 1} / {session.queue.length}</strong></div>
        </div>
        <div className="bar"><div className="bar__fill" style={{ width: `${(session.i / session.queue.length) * 100}%` }} /></div>
        <div className="flash card">
          {session.mode === 'flash' && (
            <>
              <div className="flash__front"><strong>{c.word}</strong> {c.pos && <em className="vocab__pos">{c.pos}</em>}<button className="icon-btn" onClick={() => speak(c.word, { rate: 0.9 })}><Volume2 size={18} /></button></div>
              {session.flipped ? <div className="flash__back"><p className="flash__meaning">{c.meaning}</p>{c.example && <p className="flash__ex">{c.example}</p>}</div>
                : <button className="btn btn--primary" onClick={() => setSession({ ...session, flipped: true })}>Lật thẻ</button>}
            </>
          )}
          {session.mode === 'type' && (
            <>
              <p className="flash__meaning">{c.meaning} {c.pos && <em className="vocab__pos">({c.pos})</em>}</p>
              {c.example && <p className="flash__ex">{c.example.replace(new RegExp(c.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '____')}</p>}
              <form onSubmit={(e) => { e.preventDefault(); if (!session.checked) setSession({ ...session, checked: true, flipped: true }); }} className="flash__form">
                <input className={`input input--lg${session.checked ? (typedOk ? ' is-correct' : ' is-wrong') : ''}`} autoFocus value={session.typed} onChange={(e) => setSession({ ...session, typed: e.target.value })} disabled={session.checked} placeholder="Gõ từ tiếng Anh…" spellCheck={false} autoComplete="off" />
                {!session.checked && <button className="btn btn--primary" type="submit">Kiểm tra</button>}
              </form>
              {session.checked && <div className={typedOk ? 'ok-text' : 'no-text'}>{typedOk ? <><Check size={16} /> Chính xác</> : <><X size={16} /> Đáp án: <strong>{c.word}</strong></>} <button className="icon-btn" onClick={() => speak(c.word)}><Volume2 size={16} /></button></div>}
            </>
          )}
          {session.mode === 'mcq' && (
            <>
              <div className="flash__front"><strong>{c.word}</strong> {c.pos && <em className="vocab__pos">{c.pos}</em>}<button className="icon-btn" onClick={() => speak(c.word)}><Volume2 size={18} /></button></div>
              <div className="options">
                {options.map((o, i) => {
                  let st = '';
                  if (session.checked) st = o.id === c.id ? ' is-correct' : session.pick === i ? ' is-wrong' : ' is-dim';
                  return <button key={o.id} className={`option${st}`} disabled={session.checked} onClick={() => setSession({ ...session, pick: i, checked: true, flipped: true })}><span className="option__letter">{'ABCD'[i]}</span><span className="option__text">{o.meaning}</span></button>;
                })}
              </div>
            </>
          )}
          {session.flipped && (
            <div className="flash__grades">
              {([0, 1, 2, 3] as Grade[]).map((g) => (
                <button key={g} className={`btn grade grade--${g}`} onClick={() => grade(g)}>
                  <span>{['Quên', 'Khó', 'Tốt', 'Dễ'][g]}</span><small>{previewInterval(c, g)}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="muted small center">Phím tắt: 1–4 để chấm sau khi lật thẻ.</p>
        <KeyGrades enabled={session.flipped} onGrade={grade} onFlip={() => setSession({ ...session, flipped: true })} />
      </div>
    );
  }

  return (
    <div className="page" style={{ ['--skill' as string]: 'var(--primary)' }}>
      <div className="page-head">
        <span className="skill__icon skill__icon--lg"><Layers size={26} /></span>
        <div><h1>Từ vựng</h1><p>{cards.length} từ đã lưu · <strong>{due.length}</strong> đến hạn ôn hôm nay</p></div>
      </div>
      <div className="part-grid">
        <button className="part-card" onClick={() => start('flash')} disabled={!due.length}><span className="part-card__label"><Layers size={14} /> Flashcard</span><span className="part-card__title">Lật thẻ, tự chấm 4 mức</span></button>
        <button className="part-card" onClick={() => start('type')} disabled={!due.length}><span className="part-card__label"><Keyboard size={14} /> Gõ từ</span><span className="part-card__title">Nhìn nghĩa + câu ví dụ, gõ lại từ</span></button>
        <button className="part-card" onClick={() => start('mcq')} disabled={cards.length < 4 || !due.length}><span className="part-card__label"><ListChecks size={14} /> Trắc nghiệm</span><span className="part-card__title">Chọn nghĩa đúng trong 4 đáp án</span></button>
        <button className="part-card" onClick={() => setAdding(true)}><span className="part-card__label"><Plus size={14} /> Thêm từ</span><span className="part-card__title">Nhập tay từ mới</span></button>
      </div>
      {adding && (
        <form className="card pad form-grid" onSubmit={async (e) => { e.preventDefault(); if (!form.word.trim()) return; await saveCard(newCard({ id: `v-${form.word}-${Date.now().toString(36)}`, word: form.word.trim(), pos: form.pos, meaning: form.meaning, example: form.example })); setForm({ word: '', pos: '', meaning: '', example: '' }); setAdding(false); }}>
          <input className="input" placeholder="Từ / cụm" value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} autoFocus />
          <input className="input" placeholder="Loại từ (n, v, adj…)" value={form.pos} onChange={(e) => setForm({ ...form, pos: e.target.value })} />
          <input className="input" placeholder="Nghĩa" value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} />
          <input className="input" placeholder="Câu ví dụ" value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
          <div className="row"><button className="btn btn--primary" type="submit">Lưu</button><button className="btn btn--ghost" type="button" onClick={() => setAdding(false)}>Huỷ</button></div>
        </form>
      )}
      <input className="input" placeholder="Tìm từ…" value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length === 0 ? <p className="empty">Chưa có từ nào. Bấm vào từ trong bài Reading/Listening (chế độ học) để lưu.</p> : (
        <ul className="vlist card">
          {shown.map((c) => (
            <li key={c.id} className="vlist__row">
              <div className="vlist__body">
                <strong className="vocab__w">{c.word}</strong> <em className="vocab__pos">{c.pos}</em>
                <div className="vocab__vi">{c.meaning}</div>
                {c.example && <div className="vocab__ex">{c.example}</div>}
                <div className="small muted">{c.due <= Date.now() ? 'Đến hạn' : `Ôn lại sau ${Math.ceil((c.due - Date.now()) / 864e5)} ngày`} · {c.reps} lần đúng · {c.lapses} lần quên</div>
              </div>
              <button className="icon-btn" onClick={() => speak(c.word)} aria-label="Phát âm"><Volume2 size={16} /></button>
              <button className="icon-btn" onClick={() => deleteCard(c.id)} aria-label="Xoá"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KeyGrades({ enabled, onGrade, onFlip }: { enabled: boolean; onGrade: (g: Grade) => void; onFlip: () => void }) {
  useKey((e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === ' ' && !enabled) { e.preventDefault(); onFlip(); }
    if (enabled && ['1', '2', '3', '4'].includes(e.key)) onGrade((+e.key - 1) as Grade);
  });
  return null;
}
import { useEffect } from 'react';
function useKey(f: (e: KeyboardEvent) => void) {
  useEffect(() => { document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, [f]);
}
