// Tra từ khi bấm vào một từ trong bài.
// Nghĩa tiếng Việt: từ vựng kèm bài → AI (nếu đã cấu hình) → dịch miễn phí (MyMemory).
// Phiên âm, loại từ, định nghĩa Anh: Datamuse (dictionaryapi.dev làm dự phòng). Không cần API key.
import { useEffect, useState } from 'react';
import { BookmarkPlus, Check, Languages, Loader2, Sparkles, Volume2, X } from 'lucide-react';
import type { Vocab } from '../types';
import { aiReady, getAiConfig } from '../store';
import { findCard, saveCard } from '../db';
import { newCard } from '../lib/srs';
import { speak } from '../lib/tts';
import { cleanWord } from '../lib/text';
import { freeTranslate, translateText } from '../lib/freeTranslate';
import type { Lookup } from '../ai/assist';

export interface WordSel { word: string; sentence: string; x: number; y: number }

interface DictEntry { phonetic?: string; phonetics?: { text?: string }[]; meanings: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[] }
const DM_POS: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
const dictCache = new Map<string, Promise<DictEntry | null>>();
const getJson = async (url: string, ms = 5000) => {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); return r.ok ? await r.json() : null; } finally { clearTimeout(t); }
};
/** Datamuse (CORS mở, có IPA; từ biến thể như "worms" trả định nghĩa của "worm"). */
async function datamuse(word: string): Promise<DictEntry | null> {
  const d = await getJson(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=dpr&ipa=1&max=1`);
  const e = Array.isArray(d) ? d[0] : null;
  if (!e || String(e.word).toLowerCase() !== word.toLowerCase()) return null;
  const ipa = (e.tags as string[] | undefined)?.find((t) => t.startsWith('ipa_pron:'))?.slice(9).replace(/ɫ/g, 'l');
  const byPos = new Map<string, string[]>();
  for (const raw of (e.defs as string[] | undefined) ?? []) {
    const [p, def] = raw.split('\t'); const pos = DM_POS[p] ?? p;
    if (def) byPos.set(pos, [...(byPos.get(pos) ?? []), def.trim()]);
  }
  if (!byPos.size && !ipa) return null;
  return { phonetic: ipa ? `/${ipa}/` : undefined, meanings: [...byPos].map(([partOfSpeech, ds]) => ({ partOfSpeech, definitions: ds.map((definition) => ({ definition })) })) };
}
async function dictApi(word: string): Promise<DictEntry | null> {
  const d = await getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, 4000);
  return Array.isArray(d) ? d[0] : null;
}
/** Phiên âm + định nghĩa Anh: Datamuse, thiếu thì thử dictionaryapi.dev. Lỗi mạng → null (popover vẫn hiện nghĩa Việt). */
function freeDict(word: string): Promise<DictEntry | null> {
  let p = dictCache.get(word);
  if (!p) {
    p = (async () => {
      const a = await datamuse(word).catch(() => null);
      if (a?.meanings.length && a.phonetic) return a;
      const b = await dictApi(word).catch(() => null);
      if (!b) return a;
      return a ? { ...b, phonetic: a.phonetic ?? b.phonetic, meanings: a.meanings.length ? a.meanings : b.meanings } : b;
    })();
    dictCache.set(word, p);
    p.then((r) => { if (!r) dictCache.delete(word); });
  }
  return p;
}
const POS_VI: Record<string, string> = { noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv', preposition: 'prep', conjunction: 'conj', pronoun: 'pron', interjection: 'interj' };

export default function WordPopover({ sel, vocab, from, onClose }: { sel: WordSel; vocab?: Vocab[]; from?: string; onClose: () => void }) {
  const w = cleanWord(sel.word);
  const local = vocab?.find((v) => v[0].toLowerCase() === w || v[0].toLowerCase().split(/[\s/(]/)[0] === w);
  const [dict, setDict] = useState<DictEntry | null | 'busy'>('busy');
  const [vi, setVi] = useState<string | null | 'busy'>(null);
  const [ai, setAi] = useState<Lookup | null | 'busy' | string>(null);
  const [sentVi, setSentVi] = useState<string | 'busy' | null>(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(() => !!findCard(w));
  const [form, setForm] = useState<{ meaning: string; pos: string; note: string } | null>(null);
  const hasAi = aiReady(getAiConfig());

  useEffect(() => {
    setDict('busy'); setAi(null); setSentVi(null); setErr(''); setForm(null); setSaved(!!findCard(w));
    freeDict(w).then(setDict);
    if (local) setVi(local[2]);
    else { setVi('busy'); freeTranslate(w).then(setVi, (e) => { setVi(null); setErr(e instanceof Error ? e.message : String(e)); }); }
  }, [w]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const d = dict !== 'busy' ? dict : null;
  const a = typeof ai === 'object' && ai ? ai : null;
  const ipa = a?.ipa || d?.phonetic || d?.phonetics?.find((p) => p.text)?.text || '';
  const pos = a?.pos || local?.[1] || (d?.meanings[0] ? POS_VI[d.meanings[0].partOfSpeech] ?? d.meanings[0].partOfSpeech : '');
  const meaningVi = a?.meaning || (typeof vi === 'string' ? vi : '') || '';
  const meaningEn = a?.meaningEn || d?.meanings[0]?.definitions[0]?.definition || '';

  const askAi = async () => {
    setAi('busy');
    try {
      const { lookupWord } = await import('../ai/assist');
      const r = await lookupWord(sel.word, sel.sentence, getAiConfig());
      setAi(r); setSentVi(r.sentenceVi);
    } catch (e) { setAi(e instanceof Error ? e.message : String(e)); }
  };
  const transSentence = async () => {
    setSentVi('busy');
    try { setSentVi(await translateText(sel.sentence)); } catch (e) { setSentVi(null); setErr(e instanceof Error ? e.message : String(e)); }
  };
  const save = async () => {
    if (!form) return;
    await saveCard(newCard({
      id: `v-${w}-${Date.now().toString(36)}`, word: a?.word ?? local?.[0] ?? w, pos: form.pos || undefined, meaning: form.meaning,
      ipa: ipa || undefined, meaningEn: meaningEn || undefined, example: sel.sentence,
      exampleVi: typeof sentVi === 'string' && sentVi !== 'busy' ? sentVi : undefined, note: form.note || undefined, from,
    }));
    setSaved(true); setForm(null);
  };

  const style = { left: Math.max(8, Math.min(sel.x, window.innerWidth - 372)), top: sel.y + 8 };
  return (
    <div className="wpop" style={style} role="dialog" aria-label={`Tra từ ${w}`}>
      <div className="wpop__head">
        <strong>{a?.word ?? local?.[0] ?? w}</strong>
        {ipa && <span className="muted small">{ipa}</span>}
        <button className="icon-btn" onClick={() => speak(w, { rate: 0.9 })} aria-label="Phát âm"><Volume2 size={16} /></button>
        <button className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={16} /></button>
      </div>

      <div className="wpop__row">
        <span className="wpop__k">Nghĩa</span>
        <span className="wpop__vi">{pos && <em>{pos}</em>} {vi === 'busy' && !a ? <Loader2 size={13} className="spin" /> : meaningVi || <span className="muted">—</span>}</span>
      </div>
      {a && a.otherMeanings.length > 0 && <div className="wpop__row"><span className="wpop__k">Nghĩa khác</span><span className="small">{a.otherMeanings.join('; ')}</span></div>}
      {dict === 'busy' ? <p className="small muted"><Loader2 size={13} className="spin" /> Đang tra từ điển…</p> : (meaningEn || (d && d.meanings.length > 1)) ? (
        <div className="wpop__row">
          <span className="wpop__k">English</span>
          <span className="small">
            {a ? a.meaningEn : d!.meanings.slice(0, 2).map((mm, i) => <span key={i} className="wpop__def"><em>{POS_VI[mm.partOfSpeech] ?? mm.partOfSpeech}</em> {mm.definitions[0]?.definition}</span>)}
          </span>
        </div>
      ) : null}
      {a && a.collocations.length > 0 && <div className="wpop__row"><span className="wpop__k">Collocation</span><span className="small">{a.collocations.join(' · ')}</span></div>}
      {a && a.synonyms.length > 0 && <div className="wpop__row"><span className="wpop__k">Đồng nghĩa</span><span className="small">{a.synonyms.join(', ')}</span></div>}

      <div className="wpop__sent">
        <span className="small"><em>“{sel.sentence.length > 220 ? sel.sentence.slice(0, 220) + '…' : sel.sentence}”</em></span>
        {sentVi === null && <button className="btn btn--text btn--sm" onClick={transSentence}><Languages size={14} /> Dịch câu</button>}
        {sentVi === 'busy' && <span className="small muted"><Loader2 size={13} className="spin" /> Đang dịch…</span>}
        {sentVi && sentVi !== 'busy' && <span className="small wpop__sentvi">{sentVi}</span>}
      </div>
      {err && <p className="no-text small">{err}</p>}
      {typeof ai === 'string' && ai !== 'busy' && <p className="no-text small">{ai}</p>}

      {form ? (
        <div className="wpop__form">
          <label className="small">Nghĩa tiếng Việt<input className="input" value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} autoFocus /></label>
          <label className="small">Loại từ<input className="input" value={form.pos} onChange={(e) => setForm({ ...form, pos: e.target.value })} placeholder="n, v, adj…" /></label>
          <label className="small">Ghi chú của bạn<textarea className="textarea" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Cách dùng, từ đồng nghĩa, mẹo nhớ…" /></label>
          <div className="wpop__actions">
            <button className="btn btn--ghost btn--sm" onClick={() => setForm(null)}>Huỷ</button>
            <button className="btn btn--primary btn--sm" onClick={save} disabled={!form.meaning.trim()}><Check size={15} /> Lưu vào sổ từ</button>
          </div>
        </div>
      ) : (
        <div className="wpop__actions">
          {hasAi && ai !== 'busy' && !a && <button className="btn btn--ghost btn--sm" onClick={askAi} title="Tra nghĩa theo ngữ cảnh bằng AI"><Sparkles size={15} /> Tra AI</button>}
          {ai === 'busy' && <span className="small muted"><Loader2 size={14} className="spin" /> AI đang tra…</span>}
          <button className="btn btn--primary btn--sm" onClick={() => setForm({ meaning: meaningVi, pos, note: '' })} disabled={saved}>{saved ? <><Check size={15} /> Đã có trong sổ</> : <><BookmarkPlus size={15} /> Lưu từ</>}</button>
        </div>
      )}
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
