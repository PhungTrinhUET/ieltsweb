// Từ vựng (A2/A3/A5): bộ từ, dựng bài tập, chấm gõ từ.
//   Bộ từ có sẵn: public/data/vocab-deck.json (content/vocab/*.json). Mỗi từ: [từ, loại, nghĩa Việt, ví dụ, IPA, nghĩa Anh, dịch ví dụ, collocation "a; b"].
//   Bộ theo đề: public/data/vocab-deck.json → tests[] (build-data chọn từ học thuật trong từng đề).
//   Bộ tự tạo: kv `deck:<id>`. Từ tự lưu: thẻ có decks chứa 'saved'.
import { useEffect, useMemo, useState } from 'react';
import { useDb } from '../db';
import type { ExKind, VocabCard } from '../types';
import { newCard } from './srs';
import { shuffle } from './text';
import { wordRe } from './context';

export interface DeckWord { word: string; pos: string; vi: string; ex?: string; ipa?: string; en?: string; exVi?: string; colloc?: string[] }
export type DeckSource = 'custom' | 'test' | 'ai' | 'import' | 'shared' | 'builtin';
export interface DeckMeta { description?: string; emoji?: string; color?: string; topic?: string; level?: string; source?: DeckSource; createdAt?: number; updatedAt?: number }
export interface Deck extends DeckMeta { id: string; name: string; vi?: string; kind: 'topic' | 'test' | 'custom' | 'saved'; words: DeckWord[]; ref?: string }
type RawWord = [string, string, string, string?, string?, string?, string?, string?];
interface DeckFile { topics: { id: string; name: string; vi: string; words: RawWord[] }[]; tests?: { id: string; name: string; ref: string; words: RawWord[] }[] }

export const fromRaw = ([word, pos, vi, ex, ipa, en, exVi, colloc]: RawWord): DeckWord =>
  ({ word, pos, vi, ex: ex || undefined, ipa: ipa || undefined, en: en || undefined, exVi: exVi || undefined, colloc: colloc ? colloc.split(/\s*;\s*/).filter(Boolean) : undefined });

export const COLORS = ['#2563eb', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0891b2', '#dc2626', '#65a30d'];
const TOPIC_EMOJI: Record<string, string> = { education: '🎓', environment: '🌿', technology: '💻', health: '🩺', work: '💼', society: '👥', media: '📰', travel: '✈️', science: '🔬', economy: '📈', crime: '⚖️', culture: '🎭', family: '👪', food: '🍲', city: '🏙️', trends: '📊' };

let pending: Promise<Deck[]> | null = null;
export function loadDecks(): Promise<Deck[]> {
  pending ??= fetch('./data/vocab-deck.json').then((r) => (r.ok ? r.json() : { topics: [] })).then((d: DeckFile) => [
    ...d.topics.map((t, i): Deck => ({ id: `deck:${t.id}`, name: t.vi, vi: t.name, kind: 'topic', source: 'builtin', emoji: TOPIC_EMOJI[t.id] ?? '📘', color: COLORS[i % COLORS.length], words: t.words.map(fromRaw) })),
    ...(d.tests ?? []).map((t): Deck => ({ id: `test:${t.id}`, name: t.name, kind: 'test', source: 'builtin', emoji: '📄', color: '#64748b', ref: t.ref, words: t.words.map(fromRaw) })),
  ]).catch(() => { pending = null; return []; });
  return pending;
}
export function useBuiltinDecks() {
  const [d, setD] = useState<Deck[] | null>(null);
  useEffect(() => { let on = true; loadDecks().then((x) => on && setD(x)); return () => { on = false; }; }, []);
  return d;
}

export const cardId = (w: string) => `d-${w.toLowerCase().trim().replace(/\s+/g, '-')}`;
/** Thẻ (chưa lưu) từ một từ trong bộ. */
export function cardFromDeck(w: DeckWord, deck: string): VocabCard {
  return newCard({ id: cardId(w.word), word: w.word, pos: w.pos, meaning: w.vi, example: w.ex, ipa: w.ipa, meaningEn: w.en, exampleVi: w.exVi, colloc: w.colloc, decks: [deck], from: deck.startsWith('deck:') ? deck : undefined });
}
/** Gộp thông tin bộ từ vào thẻ cũ thiếu trường (thẻ học trước khi bộ được làm giàu). */
export function enrich(c: VocabCard, w?: DeckWord, deck?: string): VocabCard {
  if (!w) return c;
  return { ...c, ipa: c.ipa ?? w.ipa, meaningEn: c.meaningEn ?? w.en, example: c.example ?? w.ex, exampleVi: c.exampleVi ?? w.exVi, colloc: c.colloc ?? w.colloc,
    decks: deck && !(c.decks ?? []).includes(deck) ? [...(c.decks ?? []), deck] : c.decks };
}
/** "Từ đã lưu": từ người học tự lưu (không phải từ bộ có sẵn, không phải thẻ câu). */
const isSaved = (c: VocabCard) => c.kind !== 'sentence' && ((c.decks ?? []).includes('saved') || (!c.id.startsWith('d-') && !(c.decks ?? []).some((d) => d.startsWith('my:'))));
export const inDeck = (c: VocabCard, deck: string) => (deck === 'saved' ? isSaved(c) : (c.decks ?? []).includes(deck) || c.from === deck);

/** Bộ tự tạo lưu ở kv `udeck:<id>`; id bộ = `my:<id>`. */
export interface UserDeck extends DeckMeta { id: string; name: string; words: DeckWord[]; at: number; ref?: string }
export const userDecks = (kv: Record<string, unknown>): Deck[] => Object.entries(kv).filter(([k]) => k.startsWith('udeck:'))
  .map(([, v]) => v as UserDeck).sort((a, b) => (b.updatedAt ?? b.at) - (a.updatedAt ?? a.at))
  .map(({ id, at, ...d }) => ({ ...d, id: `my:${id}`, kind: 'custom', source: d.source ?? 'custom', createdAt: d.createdAt ?? at }));
export const GENERAL_NAME = 'Sổ chung';
/** Mọi bộ: có sẵn (chủ đề, theo đề) + Từ đã lưu + Tự tạo. */
export function useAllDecks(): Deck[] | null {
  const db = useDb();
  const builtin = useBuiltinDecks();
  return useMemo(() => {
    if (!builtin) return null;
    // "Sổ chung" luôn có: từ lưu không chọn bộ, từ giữ lại khi xoá bộ.
    const saved: Deck = { id: 'saved', name: GENERAL_NAME, description: 'Từ lưu khi đọc/nghe bài (kèm câu gốc) và từ không thuộc bộ nào', kind: 'saved', source: 'custom', emoji: '📒', color: '#0f766e', words: [] };
    return [saved, ...userDecks(db.kv), ...builtin];
  }, [builtin, db.vocab, db.kv]);
}

// ---------- Bài tập ----------
export type Step = 'intro' | ExKind;
export interface Ex {
  step: Step;
  card: VocabCard;
  /** Lựa chọn (chữ hiển thị) cho dạng chọn; `answer` = chỉ số đúng. */
  options?: string[];
  answer?: number;
  /** Dạng gõ: chữ cần gõ. */
  target?: string;
  /** Câu có chỗ trống (fill) hoặc câu cần chép (dictate). */
  sentence?: string;
  /** fill: chọn (lần đầu) hay gõ. */
  choose?: boolean;
  /** type: nghe hay nhìn nghĩa. */
  mode?: 'audio' | 'meaning';
  /** Đoạn audio thật cho câu (dictate). */
  clip?: { audio: string; start: number; end: number };
}
export interface PoolWord { word: string; pos?: string; meaning: string }

const posKey = (p?: string) => (p ?? '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);
/** 3 phương án nhiễu: cùng loại từ trước, khác từ và khác nghĩa. */
function distractors(c: VocabCard, pool: PoolWord[], by: 'word' | 'meaning', n = 3): string[] {
  const own = (by === 'word' ? c.word : c.meaning).toLowerCase();
  const seen = new Set([own]);
  const cand = shuffle(pool).filter((p) => p.word.toLowerCase() !== c.word.toLowerCase() && p.meaning && p.meaning.toLowerCase() !== c.meaning.toLowerCase());
  const same = cand.filter((p) => posKey(p.pos) === posKey(c.pos));
  const out: string[] = [];
  for (const p of [...same, ...cand]) {
    const v = by === 'word' ? p.word : p.meaning;
    if (seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase()); out.push(v);
    if (out.length >= n) break;
  }
  return out;
}
function choice(c: VocabCard, pool: PoolWord[], by: 'word' | 'meaning') {
  const right = by === 'word' ? c.word : c.meaning;
  const options = shuffle([right, ...distractors(c, pool, by)]);
  return { options, answer: options.indexOf(right) };
}
/** Câu có chỗ trống thay cho từ; null nếu câu không chứa từ. */
export function blankOut(sentence: string, word: string): { text: string; form: string } | null {
  const m = sentence.match(wordRe(word));
  if (!m || m.index == null) return null;
  return { text: sentence.slice(0, m.index) + '_____' + sentence.slice(m.index + m[0].length), form: m[0] };
}

/** Dựng một bài tập. `sentence` (fill/dictate) do nơi gọi chọn (ví dụ hoặc câu thật trong đề). */
export function makeEx(step: Step, card: VocabCard, pool: PoolWord[], o: { sentence?: string; choose?: boolean; mode?: 'audio' | 'meaning'; clip?: Ex['clip'] } = {}): Ex {
  switch (step) {
    case 'meaning': return { step, card, ...choice(card, pool, 'meaning') };
    case 'word': case 'listen': return { step, card, ...choice(card, pool, 'word') };
    case 'fill': {
      const b = o.sentence ? blankOut(o.sentence, card.word) : null;
      if (!b) return makeEx('type', card, pool, { mode: 'meaning' });
      if (o.choose) {
        const opts = shuffle([b.form, ...distractors(card, pool, 'word')]);
        return { step, card, sentence: b.text, choose: true, options: opts, answer: opts.indexOf(b.form), target: b.form };
      }
      return { step, card, sentence: b.text, target: b.form };
    }
    case 'type': return { step, card, target: card.word, mode: o.mode ?? 'meaning' };
    case 'dictate': return { step, card, sentence: o.sentence ?? card.example ?? card.word, target: o.sentence ?? card.example ?? card.word, clip: o.clip };
    default: return { step, card };
  }
}

// ---------- Chấm gõ ----------
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' -]/g, '').replace(/[\s-]+/g, ' ').trim();
function lev(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}
/** 'ok' đúng · 'near' sai một chữ cái · 'no' sai. */
export function judgeTyped(typed: string, target: string): 'ok' | 'near' | 'no' {
  const a = norm(typed), b = norm(target);
  if (!a) return 'no';
  if (a === b) return 'ok';
  return b.length >= 4 && lev(a, b) === 1 ? 'near' : 'no';
}

/** XP cho một câu trả lời (chung cho từ vựng + nghe-chép). */
export const xpFor = (ok: boolean, step: Step | 'dictation' | 'context') => (!ok ? 0 : step === 'intro' ? 1 : step === 'type' || step === 'dictate' || step === 'dictation' ? 3 : 2);
