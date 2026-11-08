// Chế độ học bài đọc / transcript: đọc từng đoạn – dịch – bấm từ để tra & lưu – nghe đọc bằng giọng máy – ghi chú – từ vựng của bài.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookmarkPlus, Check, Languages, Loader2, Pause, Play, Sparkles, StickyNote } from 'lucide-react';
import type { ListeningMaterial, ReadingMaterial, Vocab } from '../types';
import { findCard, saveCard, saveMaterial, saveNote, useDb } from '../db';
import { aiReady, getAiConfig, touchStreak } from '../store';
import { paragraphs, paraLabel, sentences } from '../lib/text';
import { speak, stopSpeak, ttsAvailable } from '../lib/tts';
import { newCard } from '../lib/srs';
import WordPopover, { Clickable, type WordSel } from '../components/WordPopover';
import { SKILL_META } from './SkillList';

export default function ReadingStudy() {
  const { id } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const m = db.materials[id!] as ReadingMaterial | ListeningMaterial | undefined;
  const isListening = m?.skill === 'listening';
  const text = m ? (isListening ? (m as ListeningMaterial).transcript : (m as ReadingMaterial).passage) : '';
  // Listening: mỗi dòng (lượt lời) là một "đoạn"; Reading: đoạn cách dòng trống.
  const paras = useMemo(() => (isListening ? text.split('\n').map((l) => l.trim()).filter(Boolean) : paragraphs(text)), [text, isListening]);
  const [showVi, setShowVi] = useState(true);
  const [sel, setSel] = useState<WordSel | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [reading, setReading] = useState<number | null>(null); // đoạn đang được đọc
  const [sentVi, setSentVi] = useState<Record<string, string>>({});
  const [note, setNote] = useState(db.notes[id!]?.text ?? '');
  const noteTimer = useRef(0);
  const stopRef = useRef(false);
  useEffect(() => { touchStreak(); return () => { stopSpeak(); }; }, []);
  useEffect(() => { setNote(db.notes[id!]?.text ?? ''); }, [id]);

  if (!m) return <div className="page"><p className="empty">Không tìm thấy bài.</p></div>;
  const translation = m.translation ?? [];

  const translateAll = async () => {
    setBusy('all'); setErr('');
    try {
      const { translateMany } = await import('../ai/assist');
      const src = paras.map((p) => paraLabel(p).text);
      const out: string[] = [];
      for (let i = 0; i < src.length; i += 12) out.push(...await translateMany(src.slice(i, i + 12), getAiConfig()));
      await saveMaterial({ ...m, translation: out, builtin: false });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const translateSentence = async (s: string) => {
    if (sentVi[s]) return;
    setBusy(s);
    try {
      const { translateMany } = await import('../ai/assist');
      const [vi] = await translateMany([s], getAiConfig());
      setSentVi((x) => ({ ...x, [s]: vi }));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const readFrom = async (start: number) => {
    stopRef.current = false;
    for (let i = start; i < paras.length; i++) {
      if (stopRef.current) break;
      setReading(i);
      await speak(paraLabel(paras[i]).text.replace(/^[A-Z][a-z]+ ?\d?:\s*/, ''), { voice: (m as ListeningMaterial).voice });
    }
    setReading(null);
  };
  const stopReading = () => { stopRef.current = true; stopSpeak(); setReading(null); };
  const saveVocab = async (v: Vocab) => {
    if (findCard(v[0])) return;
    await saveCard(newCard({ id: `v-${v[0]}-${Date.now().toString(36)}`, word: v[0], pos: v[1], meaning: v[2], example: v[3], from: m.id }));
  };
  const onNote = (t: string) => {
    setNote(t);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => saveNote({ materialId: m.id, text: t, highlights: db.notes[m.id]?.highlights ?? [], updatedAt: Date.now() }), 600);
  };
  const ai = aiReady(getAiConfig());
  const savedCount = (m.vocab ?? []).filter((v) => findCard(v[0])).length;

  return (
    <div className="page page--wide page--practice" style={{ ['--skill' as string]: SKILL_META[m.skill].color }}>
      <div className="topbar topbar--sticky">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Quay lại"><ArrowLeft size={20} /></button>
        <div className="topbar__title"><small>Chế độ học · {isListening ? 'Transcript' : 'Bài đọc'}</small><strong>{m.title}</strong></div>
        <div className="topbar__actions">
          {ttsAvailable() && (reading === null
            ? <button className="btn btn--ghost btn--sm" onClick={() => readFrom(0)}><Play size={15} /> Nghe đọc</button>
            : <button className="btn btn--ghost btn--sm" onClick={stopReading}><Pause size={15} /> Dừng</button>)}
          <button className={`btn btn--sm ${showVi ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setShowVi(!showVi)}><Languages size={15} /> Dịch</button>
        </div>
      </div>

      {showVi && translation.length === 0 && (
        <div className="banner">
          <Sparkles size={18} />
          <span>Bài này chưa có bản dịch. {ai ? 'Nhờ AI dịch cả bài (lưu lại, chỉ tốn một lần).' : 'Cấu hình AI trong Cài đặt để dịch tự động, hoặc bấm từng câu.'}</span>
          {ai && <button className="btn btn--primary btn--sm" onClick={translateAll} disabled={busy === 'all'}>{busy === 'all' ? <><Loader2 size={15} className="spin" /> Đang dịch…</> : 'Dịch cả bài'}</button>}
        </div>
      )}
      {err && <p className="no-text small">{err}</p>}

      <div className="split">
        <section className="split__pane split__pane--passage">
          <p className="muted small">Bấm vào từ để tra nghĩa & lưu. Bấm ▶ ở đầu đoạn để nghe đọc từ đó. Bấm vào câu để dịch riêng câu đó.</p>
          <article className="passage passage--study">
            {paras.map((p, i) => {
              const { label, text: t } = paraLabel(p);
              const speakerM = isListening ? t.match(/^([A-Z][A-Za-z ]{0,20}):\s*/) : null;
              const body = speakerM ? t.slice(speakerM[0].length) : t;
              const sents = sentences(body);
              return (
                <div key={i} className={`study-p${reading === i ? ' is-reading' : ''}`}>
                  <div className="study-p__head">
                    {label && <span className="passage__label">{label}</span>}
                    {speakerM && <strong className="study-p__speaker">{speakerM[1]}</strong>}
                    {ttsAvailable() && <button className="icon-btn icon-btn--xs" onClick={() => (reading === i ? stopReading() : readFrom(i))} aria-label="Đọc đoạn này">{reading === i ? <Pause size={14} /> : <Play size={14} />}</button>}
                  </div>
                  <p className="study-p__en">
                    {sents.map((s, si) => (
                      <span key={si} className="study-s" onDoubleClick={() => ai && translateSentence(s)} title={ai ? 'Nhấp đúp để dịch câu này' : ''}>
                        <Clickable text={s} onWord={setSel} />{' '}
                        {sentVi[s] && <span className="study-s__vi">{sentVi[s]}</span>}
                        {busy === s && <Loader2 size={12} className="spin" />}
                      </span>
                    ))}
                  </p>
                  {showVi && translation[i] && <p className="study-p__vi">{translation[i]}</p>}
                </div>
              );
            })}
          </article>
        </section>
        <aside className="split__pane split__pane--side">
          {(m.vocab?.length ?? 0) > 0 && (
            <section className="card pad">
              <div className="row-between">
                <h3 className="h3">Từ vựng của bài ({m.vocab!.length})</h3>
                <button className="btn btn--text btn--sm" onClick={() => m.vocab!.forEach(saveVocab)} disabled={savedCount === m.vocab!.length}>{savedCount === m.vocab!.length ? <><Check size={14} /> Đã lưu hết</> : <><BookmarkPlus size={14} /> Lưu tất cả</>}</button>
              </div>
              <ul className="vlist">
                {m.vocab!.map((v, i) => {
                  const saved = !!findCard(v[0]);
                  return (
                    <li key={i} className="vlist__row">
                      <div className="vlist__body"><strong className="vocab__w">{v[0]}</strong> <em className="vocab__pos">{v[1]}</em><div className="vocab__vi">{v[2]}</div>{v[3] && <div className="vocab__ex">{v[3]}</div>}</div>
                      <button className="icon-btn" onClick={() => saveVocab(v)} disabled={saved} aria-label="Lưu">{saved ? <Check size={16} /> : <BookmarkPlus size={16} />}</button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <section className="card pad">
            <h3 className="h3"><StickyNote size={16} /> Ghi chú của bạn</h3>
            <textarea className="textarea" rows={6} value={note} onChange={(e) => onNote(e.target.value)} placeholder="Ý chính từng đoạn, cấu trúc đáng học, bẫy đã mắc…" />
            {(db.notes[m.id]?.highlights?.length ?? 0) > 0 && (
              <div><p className="small muted">Đã highlight:</p><ul className="hl-list">{db.notes[m.id]!.highlights.map((h, i) => <li key={i}>“{h}”</li>)}</ul></div>
            )}
          </section>
        </aside>
      </div>
      {sel && <WordPopover sel={sel} vocab={m.vocab} from={m.id} onClose={() => setSel(null)} />}
    </div>
  );
}
