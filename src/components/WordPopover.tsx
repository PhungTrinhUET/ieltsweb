// Tra từ khi bấm vào một từ trong bài: nghĩa trong từ vựng kèm bài → từ điển miễn phí (dictionaryapi.dev) → AI theo ngữ cảnh.
import { useEffect, useState } from 'react';
import { BookmarkPlus, Check, Loader2, Sparkles, Volume2, X } from 'lucide-react';
import type { Vocab } from '../types';
import { aiReady, getAiConfig } from '../store';
import { findCard, saveCard } from '../db';
import { newCard } from '../lib/srs';
import { speak } from '../lib/tts';
import { cleanWord } from '../lib/text';
import type { Lookup } from '../ai/assist';

export interface WordSel { word: string; sentence: string; x: number; y: number }

interface DictEntry { phonetic?: string; meanings: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[] }
async function freeDict(word: string): Promise<DictEntry | null> {
  try {
    const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d) ? d[0] : null;
  } catch { return null; }
}

export default function WordPopover({ sel, vocab, from, onClose }: { sel: WordSel; vocab?: Vocab[]; from?: string; onClose: () => void }) {
  const w = cleanWord(sel.word);
  const local = vocab?.find((v) => v[0].toLowerCase() === w || v[0].toLowerCase().split(/[\s/(]/)[0] === w);
  const [dict, setDict] = useState<DictEntry | null | 'busy'>('busy');
  const [ai, setAi] = useState<Lookup | null | 'busy' | string>(null);
  const [saved, setSaved] = useState(() => !!findCard(w));

  useEffect(() => { setDict('busy'); freeDict(w).then(setDict); setAi(null); setSaved(!!findCard(w)); }, [w]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const askAi = async () => {
    setAi('busy');
    try {
      const { lookupWord } = await import('../ai/assist');
      setAi(await lookupWord(sel.word, sel.sentence, getAiConfig()));
    } catch (e) { setAi(e instanceof Error ? e.message : String(e)); }
  };
  const save = async () => {
    const a = typeof ai === 'object' && ai ? ai : null;
    const d = dict !== 'busy' ? dict : null;
    const meaning = a?.meaning ?? local?.[2] ?? d?.meanings[0]?.definitions[0]?.definition ?? '';
    await saveCard(newCard({ id: `v-${w}-${Date.now().toString(36)}`, word: a?.word ?? local?.[0] ?? w, pos: a?.pos ?? local?.[1] ?? d?.meanings[0]?.partOfSpeech, meaning, example: sel.sentence, from }));
    setSaved(true);
  };

  const style = { left: Math.min(sel.x, window.innerWidth - 340), top: sel.y + 8 };
  return (
    <div className="wpop" style={style} role="dialog">
      <div className="wpop__head">
        <strong>{typeof ai === 'object' && ai ? ai.word : local?.[0] ?? w}</strong>
        {(typeof ai === 'object' && ai?.ipa) || (dict !== 'busy' && dict?.phonetic) ? <span className="muted small">{typeof ai === 'object' && ai ? ai.ipa : (dict as DictEntry).phonetic}</span> : null}
        <button className="icon-btn" onClick={() => speak(w, { rate: 0.9 })} aria-label="Phát âm"><Volume2 size={16} /></button>
        <button className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={16} /></button>
      </div>
      {local && <p className="wpop__vi"><em>{local[1]}</em> {local[2]}</p>}
      {typeof ai === 'object' && ai ? (
        <div className="wpop__ai">
          <p className="wpop__vi"><em>{ai.pos}</em> {ai.meaning}</p>
          <p className="small muted">{ai.meaningEn}</p>
          {ai.otherMeanings.length > 0 && <p className="small">Nghĩa khác: {ai.otherMeanings.join('; ')}</p>}
          {ai.collocations.length > 0 && <p className="small">Collocation: {ai.collocations.join(' · ')}</p>}
          {ai.synonyms.length > 0 && <p className="small">Đồng nghĩa: {ai.synonyms.join(', ')}</p>}
          <p className="small"><em>{ai.example}</em></p>
          <p className="small muted">Câu trong bài: {ai.sentenceVi}</p>
        </div>
      ) : !local && dict !== 'busy' && dict ? (
        <div className="wpop__dict">
          {dict.meanings.slice(0, 2).map((m, i) => (
            <p key={i} className="small"><em>{m.partOfSpeech}</em> {m.definitions[0]?.definition}</p>
          ))}
        </div>
      ) : !local && dict === 'busy' ? <p className="small muted"><Loader2 size={14} className="spin" /> Đang tra…</p>
      : !local && !dict ? <p className="small muted">Không thấy trong từ điển.</p> : null}
      {typeof ai === 'string' && ai !== 'busy' && <p className="no-text small">{ai}</p>}
      <div className="wpop__actions">
        {ai !== 'busy' && typeof ai !== 'object' && (
          <button className="btn btn--ghost btn--sm" onClick={askAi} disabled={!aiReady(getAiConfig())} title={aiReady(getAiConfig()) ? 'Tra nghĩa theo ngữ cảnh bằng AI' : 'Cần cấu hình AI ở Cài đặt'}><Sparkles size={15} /> Tra AI</button>
        )}
        {ai === 'busy' && <span className="small muted"><Loader2 size={14} className="spin" /> AI đang tra…</span>}
        <button className="btn btn--primary btn--sm" onClick={save} disabled={saved}>{saved ? <><Check size={15} /> Đã lưu</> : <><BookmarkPlus size={15} /> Lưu từ</>}</button>
      </div>
    </div>
  );
}

/** Văn bản mà mỗi từ bấm được; `sentence` để tra theo ngữ cảnh. */
export function Clickable({ text, onWord, className }: { text: string; onWord: (s: WordSel) => void; className?: string }) {
  return (
    <span className={className} onClick={(e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.w === undefined) return;
      const r = t.getBoundingClientRect();
      onWord({ word: t.dataset.w, sentence: text, x: r.left + window.scrollX, y: r.bottom + window.scrollY });
    }}>
      {text.split(/(\s+)/).map((tok, i) => (/\S/.test(tok) && cleanWord(tok) ? <span key={i} data-w={cleanWord(tok)} className="w">{tok}</span> : tok))}
    </span>
  );
}
