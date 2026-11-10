// Bộ từ kiểu MemCab: tạo / sửa / xoá / gộp bộ, lưu từ vào bộ, nhớ bộ theo đề, dán danh sách, nhập/xuất, link chia sẻ.
//   Bộ tự tạo: kv `udeck:<id>` (UserDeck), id bộ trong app = `my:<id>`. Thẻ thuộc bộ khi `card.decks` chứa id bộ.
//   "Sổ chung" = id 'saved' (luôn có). Bộ có sẵn (deck:, test:) chỉ đọc → "Sao chép thành bộ của tôi".
//   Một thẻ có thể nằm trong nhiều bộ.
import { deleteCard, findCard, getState, saveCard, saveCards, setKv } from '../db';
import type { CardContext, VocabCard } from '../types';
import { cardState, isLearned, newCard, type WordState } from './srs';
import { type Deck, type DeckMeta, type DeckWord, type UserDeck, COLORS, GENERAL_NAME, cardFromDeck, loadDecks } from './vocab';
import { dictInfo } from './dict';
import { freeTranslate } from './freeTranslate';

export const GENERAL = 'saved';
const key = (deckId: string) => `udeck:${deckId.replace(/^my:/, '')}`;
export const isMine = (deckId: string) => deckId.startsWith('my:') || deckId === GENERAL;
export const getUserDeck = (deckId: string) => getState().kv[key(deckId)] as UserDeck | undefined;
export const findMine = (deckId: string) => (deckId.startsWith('my:') ? getUserDeck(deckId) : undefined);
export const deckName = (deckId: string) => (deckId === GENERAL ? GENERAL_NAME : getUserDeck(deckId)?.name ?? deckId);
const lc = (s: string) => s.trim().toLowerCase();

/** Bỏ từ trùng (không phân biệt hoa thường), giữ bản đầu. */
export function uniqWords(words: DeckWord[]): DeckWord[] {
  const seen = new Set<string>();
  return words.filter((w) => { const k = lc(w.word); if (!k || seen.has(k)) return false; seen.add(k); return true; });
}

export async function createDeck(meta: DeckMeta & { name: string; ref?: string }, words: DeckWord[] = []): Promise<string> {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const now = Date.now();
  const n = Object.keys(getState().kv).filter((k) => k.startsWith('udeck:')).length;
  const d: UserDeck = { color: COLORS[n % COLORS.length], emoji: '📚', source: 'custom', ...meta, id, name: meta.name.trim() || `Bộ ${n + 1}`, words: uniqWords(words), at: now, createdAt: now, updatedAt: now };
  await setKv(key(id), d);
  await linkCards(`my:${id}`, d.words);
  return `my:${id}`;
}

export async function updateDeck(deckId: string, patch: Partial<UserDeck>) {
  const d = getUserDeck(deckId);
  if (!d) return;
  await setKv(key(deckId), { ...d, ...patch, updatedAt: Date.now() });
}

/** Thẻ đã có cùng từ → gắn thêm id bộ. */
async function linkCards(deckId: string, words: DeckWord[]) {
  const set = new Set(words.map((w) => lc(w.word)));
  const cs = Object.values(getState().vocab).filter((c) => c.kind !== 'sentence' && set.has(lc(c.word)) && !(c.decks ?? []).includes(deckId));
  if (cs.length) await saveCards(cs.map((c) => ({ ...c, decks: [...(c.decks ?? []), deckId] })));
}

/** Thêm từ vào bộ của tôi; trả số từ thêm được / bị trùng. */
export async function addWords(deckId: string, words: DeckWord[]): Promise<{ added: number; dup: number }> {
  if (deckId === GENERAL) {
    let added = 0;
    for (const w of uniqWords(words)) { const r = await saveWordTo(GENERAL, { word: w.word, pos: w.pos, meaning: w.vi, example: w.ex, ipa: w.ipa, meaningEn: w.en }); if (r.added) added++; }
    return { added, dup: words.length - added };
  }
  const d = getUserDeck(deckId);
  if (!d) return { added: 0, dup: 0 };
  const have = new Set(d.words.map((w) => lc(w.word)));
  const fresh = uniqWords(words).filter((w) => !have.has(lc(w.word)));
  await updateDeck(deckId, { words: [...d.words, ...fresh] });
  await linkCards(deckId, fresh);
  return { added: fresh.length, dup: words.length - fresh.length };
}

/** Sửa một từ trong bộ (và thẻ tương ứng nếu đã học). */
export async function editWord(deckId: string, old: string, w: DeckWord) {
  const d = getUserDeck(deckId);
  if (d) await updateDeck(deckId, { words: d.words.map((x) => (lc(x.word) === lc(old) ? w : x)) });
  const c = findCard(old);
  if (c) await saveCard({ ...c, word: w.word, pos: w.pos || undefined, meaning: w.vi, example: w.ex || c.example, ipa: w.ipa || c.ipa });
}

export async function removeWords(deckId: string, words: string[]) {
  const set = new Set(words.map(lc));
  const d = getUserDeck(deckId);
  if (d) await updateDeck(deckId, { words: d.words.filter((w) => !set.has(lc(w.word))) });
  const cs = Object.values(getState().vocab).filter((c) => set.has(lc(c.word)) && ((c.decks ?? []).includes(deckId) || (deckId === GENERAL && !(c.decks ?? []).length)));
  if (cs.length) await saveCards(cs.map((c) => ({ ...c, decks: (c.decks ?? []).filter((x) => x !== deckId) })));
}

/** Chép / chuyển từ sang bộ khác. */
export async function copyWords(from: Deck, to: string, words: string[], move = false) {
  const set = new Set(words.map(lc));
  const list = deckWordsOf(from).filter((w) => set.has(lc(w.word)));
  const r = await addWords(to, list);
  if (move && isMine(from.id)) await removeWords(from.id, words);
  return r;
}

/** Từ của một bộ (kể cả thẻ gắn bộ mà không có trong danh sách – vd Sổ chung). */
export function deckWordsOf(d: Deck): DeckWord[] {
  const out = [...d.words];
  if (d.kind === 'saved' || d.kind === 'custom') {
    const have = new Set(out.map((w) => lc(w.word)));
    for (const c of Object.values(getState().vocab)) {
      if (c.kind === 'sentence' || have.has(lc(c.word))) continue;
      const inIt = d.kind === 'saved' ? isGeneral(c) : (c.decks ?? []).includes(d.id);
      if (inIt) { out.push(wordOfCard(c)); have.add(lc(c.word)); }
    }
  }
  return out;
}
export const wordOfCard = (c: VocabCard): DeckWord => ({ word: c.word, pos: c.pos ?? '', vi: c.meaning, ex: c.example, ipa: c.ipa, en: c.meaningEn, exVi: c.exampleVi, colloc: c.colloc });
/** Thẻ thuộc Sổ chung: gắn 'saved', hoặc tự lưu (id không phải d-) mà không thuộc bộ nào của tôi. */
export const isGeneral = (c: VocabCard) => c.kind !== 'sentence' && ((c.decks ?? []).includes(GENERAL) || (!c.id.startsWith('d-') && !(c.decks ?? []).some((d) => d.startsWith('my:'))));

/** Xoá bộ: giữ từ vào Sổ chung, hoặc xoá luôn thẻ chỉ thuộc bộ này. */
export async function deleteDeck(deckId: string, keepWords: boolean) {
  const d = getUserDeck(deckId);
  const cards = Object.values(getState().vocab).filter((c) => (c.decks ?? []).includes(deckId));
  if (keepWords) {
    await saveCards(cards.map((c) => ({ ...c, decks: [...new Set([...(c.decks ?? []).filter((x) => x !== deckId), GENERAL])] })));
    // Từ trong bộ chưa thành thẻ → thêm vào Sổ chung (chưa học).
    const have = new Set(Object.values(getState().vocab).map((c) => lc(c.word)));
    const rest = (d?.words ?? []).filter((w) => !have.has(lc(w.word)));
    if (rest.length) await saveCards(rest.map((w) => ({ ...cardFromDeck(w, GENERAL), from: undefined })));
  } else {
    for (const c of cards) {
      const others = (c.decks ?? []).filter((x) => x !== deckId);
      if (others.length) await saveCard({ ...c, decks: others }); else await deleteCard(c.id);
    }
  }
  await setKv(key(deckId), undefined);
}

/** Gộp bộ `src` vào `dst` rồi xoá `src`. */
export async function mergeDecks(src: string, dst: string) {
  const s = getUserDeck(src);
  if (!s || src === dst) return;
  const cards = Object.values(getState().vocab).filter((c) => (c.decks ?? []).includes(src));
  await addWords(dst, [...s.words, ...cards.map(wordOfCard)]);
  await saveCards(cards.map((c) => ({ ...c, decks: [...new Set([...(c.decks ?? []).filter((x) => x !== src), dst])] })));
  await setKv(key(src), undefined);
}

export function copyBuiltin(d: Deck) {
  return createDeck({ name: `${d.name} (của tôi)`, emoji: d.emoji, color: d.color, description: d.description ?? d.vi, source: 'custom', topic: d.kind === 'topic' ? d.vi : undefined }, d.words);
}

// ---------- Lưu từ khi đọc/nghe ----------
export interface SaveFields { word: string; pos?: string; meaning: string; ipa?: string; meaningEn?: string; example?: string; exampleVi?: string; note?: string; from?: string; context?: CardContext }
/** Lưu từ vào một bộ: thẻ đã có → gắn thêm bộ (điền trường còn thiếu); chưa có → thẻ mới. */
export async function saveWordTo(deckId: string, f: SaveFields): Promise<{ card: VocabCard; added: boolean }> {
  const old = findCard(f.word);
  const dw: DeckWord = { word: f.word, pos: f.pos ?? '', vi: f.meaning, ex: f.example, ipa: f.ipa, en: f.meaningEn, exVi: f.exampleVi };
  if (deckId.startsWith('my:')) {
    const d = getUserDeck(deckId);
    if (d && !d.words.some((w) => lc(w.word) === lc(f.word))) await updateDeck(deckId, { words: [...d.words, dw] });
  }
  if (old) {
    const had = (old.decks ?? []).includes(deckId) || (deckId === GENERAL && isGeneral(old));
    const c: VocabCard = { ...old, decks: had ? old.decks : [...(old.decks ?? []), deckId], pos: old.pos ?? f.pos, ipa: old.ipa ?? f.ipa, meaningEn: old.meaningEn ?? f.meaningEn,
      example: old.example ?? f.example, exampleVi: old.exampleVi ?? f.exampleVi, note: old.note ?? f.note, context: old.context ?? f.context, meaning: old.meaning || f.meaning };
    await saveCard(c);
    return { card: c, added: !had };
  }
  const c = newCard({ id: `v-${lc(f.word).replace(/\s+/g, '-')}-${Date.now().toString(36)}`, word: f.word, pos: f.pos || undefined, meaning: f.meaning, ipa: f.ipa || undefined, meaningEn: f.meaningEn || undefined,
    example: f.example || undefined, exampleVi: f.exampleVi || undefined, note: f.note || undefined, from: f.from, decks: [deckId], context: f.context });
  await saveCard(c);
  return { card: c, added: true };
}
/** Các bộ (của tôi) đang chứa thẻ. */
export const decksOfCard = (c: VocabCard) => [...new Set([...(c.decks ?? []).filter(isMine), ...(isGeneral(c) && !(c.decks ?? []).includes(GENERAL) ? [GENERAL] : [])])];

// ---------- Bộ theo đề: nhớ testId → bộ ----------
const MAP_KEY = 'ielts:deck-for-test';
const LAST_KEY = 'ielts:last-deck';
/** "vol5-t7-r1" → { id: 'vol5-t7', name: 'VOL 5 · Test 7' }. */
export function testOf(from?: string): { id: string; name: string } | null {
  const m = from?.match(/^vol(\d+)-t(\d+)/);
  return m ? { id: `vol${m[1]}-t${m[2]}`, name: `VOL ${m[1]} · Test ${m[2]}` } : null;
}
const readMap = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(MAP_KEY) ?? '{}'); } catch { return {}; } };
export function rememberDeck(from: string | undefined, deckId: string) {
  try {
    const t = testOf(from);
    if (t) localStorage.setItem(MAP_KEY, JSON.stringify({ ...readMap(), [t.id]: deckId }));
    localStorage.setItem(LAST_KEY, deckId);
  } catch { /* */ }
}
/** Bộ mặc định khi lưu từ ở một bài: bộ đã chọn cho đề này → bộ dùng gần nhất → Sổ chung. */
export function defaultDeck(from?: string): string {
  const exists = (id?: string | null) => !!id && (id === GENERAL || !!getUserDeck(id));
  const t = testOf(from);
  const byTest = t ? readMap()[t.id] : undefined;
  if (exists(byTest)) return byTest!;
  if (t) return GENERAL; // đề mới: chưa chọn bộ → Sổ chung (gợi ý "Tạo bộ VOL N · Test M")
  let last: string | null = null; try { last = localStorage.getItem(LAST_KEY); } catch { /* */ }
  return exists(last) ? last! : GENERAL;
}

// ---------- Dán danh sách / CSV ----------
export function csvRow(line: string, sep = ','): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}
const csvCell = (s = '') => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
export const toCsv = (words: DeckWord[]) => ['word,pos,meaning,example,ipa', ...words.map((w) => [w.word, w.pos, w.vi, w.ex, w.ipa].map(csvCell).join(','))].join('\n');

/** Một dòng: "từ", "từ - nghĩa", "từ<TAB>nghĩa", "từ; loại; nghĩa; ví dụ", "từ | nghĩa", CSV "từ,loại,nghĩa,ví dụ,ipa". */
export function parseLine(line: string): DeckWord | null {
  const l = line.trim();
  if (!l || l.startsWith('#')) return null;
  if (l.includes('\t')) { const [word, a = '', b = '', c = ''] = l.split('\t').map((x) => x.trim()); return b || c ? { word, pos: a, vi: b, ex: c || undefined } : { word, pos: '', vi: a }; }
  if (l.includes(';')) { const [word, pos = '', vi = '', ex = ''] = l.split(';').map((x) => x.trim()); return { word, pos, vi, ex: ex || undefined }; }
  if (l.includes('|')) { const [word, vi = ''] = l.split('|').map((x) => x.trim()); return { word, pos: '', vi }; }
  const m = l.match(/^(.+?)\s+[-–:]\s+(.*)$/);
  if (m) return { word: m[1].trim(), pos: '', vi: m[2].trim() };
  if (l.includes(',')) { const [word, pos = '', vi = '', ex = '', ipa = ''] = csvRow(l); return { word, pos, vi, ex: ex || undefined, ipa: ipa || undefined }; }
  return { word: l, pos: '', vi: '' };
}
export interface Row { line: number; raw: string; w?: DeckWord; err?: string; dup?: 'list' | 'deck' }
/** Đọc từng dòng; đánh dấu dòng lỗi và dòng trùng (trong danh sách / đã có trong bộ). */
export function parseList(text: string, existing: Iterable<string> = []): Row[] {
  const have = new Set([...existing].map(lc));
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  if (/^\s*word\s*[,;\t]/i.test(lines[0] ?? '')) lines[0] = '';
  return lines.map((raw, i): Row | null => {
    if (!raw.trim() || raw.trim().startsWith('#')) return null;
    const w = parseLine(raw);
    if (!w || !w.word) return { line: i + 1, raw, err: 'Không đọc được' };
    if (w.word.length > 60 || !/[a-z]/i.test(w.word)) return { line: i + 1, raw, err: 'Từ không hợp lệ' };
    if (/[^\x20-\x7e’'éèàçñ-]/i.test(w.word)) return { line: i + 1, raw, w, err: 'Cột đầu phải là từ tiếng Anh' };
    const k = lc(w.word);
    const dup = have.has(k) ? 'deck' as const : seen.has(k) ? 'list' as const : undefined;
    seen.add(k);
    return { line: i + 1, raw, w, dup };
  }).filter((r): r is Row => !!r);
}

/** File: CSV/TSV `word,pos,meaning,example,ipa` hoặc JSON (một bộ, danh sách bộ, mảng từ). */
export function parseFile(name: string, text: string): { name: string; words: DeckWord[]; meta?: DeckMeta }[] {
  const base = name.replace(/\.(json|csv|tsv|txt)$/i, '');
  const t = text.replace(/^﻿/, '').trim();
  if (/\.json$/i.test(name) || t.startsWith('[') || t.startsWith('{')) {
    const j = JSON.parse(t);
    type In = { name?: string; words: (DeckWord | string | string[])[] } & DeckMeta;
    const list: In[] = Array.isArray(j) ? (j.length && (typeof j[0] === 'string' || Array.isArray(j[0]) || 'word' in j[0]) ? [{ name: base, words: j }] : j) : j.decks ?? [j];
    return list.map((d) => ({
      name: d.name ?? base, meta: { emoji: d.emoji, description: d.description, color: d.color, topic: d.topic, level: d.level },
      words: (d.words ?? []).map((w): DeckWord => (typeof w === 'string' ? { word: w, pos: '', vi: '' } : Array.isArray(w) ? { word: w[0], pos: w[1] ?? '', vi: w[2] ?? '', ex: w[3] || undefined, ipa: w[4] || undefined } : { ...w, pos: w.pos ?? '', vi: w.vi ?? (w as { meaning?: string }).meaning ?? '' })).filter((w) => w.word),
    }));
  }
  const sep = /\.tsv$/i.test(name) || (t.split('\n')[0].includes('\t') && !t.split('\n')[0].includes(',')) ? '\t' : ',';
  const lines = t.split(/\r?\n/);
  if (/^word\s*[,\t]/i.test(lines[0])) lines.shift();
  const words = lines.filter((l) => l.trim()).map((l) => { const [word, pos = '', vi = '', ex = '', ipa = ''] = csvRow(l, sep); return { word, pos, vi, ex: ex || undefined, ipa: ipa || undefined }; }).filter((w) => w.word);
  return [{ name: base, words }];
}

export function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const deckFileName = (name: string, ext: string) => `${name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'bo-tu'}.${ext}`;
export const deckJson = (d: Pick<Deck, 'name' | 'emoji' | 'description' | 'topic' | 'level'>, words: DeckWord[]) =>
  JSON.stringify({ app: 'ielts-practice', kind: 'deck', name: d.name, emoji: d.emoji, description: d.description, topic: d.topic, level: d.level, words }, null, 1);

// ---------- Tự điền phần còn thiếu ----------
/** Điền loại từ, IPA, nghĩa Việt/Anh, ví dụ: bộ có sẵn → từ điển miễn phí → dịch máy. Tối đa `max` từ. */
export async function fillMissing(words: DeckWord[], onProgress: (n: number, total: number) => void, max = 100): Promise<DeckWord[]> {
  const known = new Map((await loadDecks()).flatMap((d) => d.words.map((w) => [lc(w.word), w] as const)));
  const out: DeckWord[] = [];
  const todo = Math.min(words.length, max);
  let i = 0;
  for (const w of words) {
    if (i >= todo) { out.push(w); continue; }
    const k = known.get(lc(w.word));
    let n: DeckWord = k ? { ...k, ...Object.fromEntries(Object.entries(w).filter(([, v]) => v)) } as DeckWord : { ...w };
    if (!n.pos || !n.ipa || !n.en || !n.ex) {
      const d = await dictInfo(n.word).catch(() => ({} as Awaited<ReturnType<typeof dictInfo>>));
      n = { ...n, pos: n.pos || d.pos || '', ipa: n.ipa || d.ipa, en: n.en || d.en, ex: n.ex || d.ex };
    }
    if (!n.vi) { try { n = { ...n, vi: (await freeTranslate(n.word)).trim() }; } catch { /* để trống */ } }
    out.push(n); onProgress(++i, todo);
  }
  return out;
}

/**
 * Điền nghĩa còn trống cho từ trong bộ của tôi và thẻ đã học (từ dán/gõ mà chưa bấm "Tự điền").
 * `deckId` có → chỉ bộ đó; không → mọi bộ của tôi + mọi thẻ. Trả số từ điền được nghĩa.
 */
export async function fillMeanings(deckId?: string, onProgress: (n: number, total: number) => void = () => {}, max = 100): Promise<number> {
  const st = getState();
  const inScope = (c: VocabCard) => !deckId || (deckId === GENERAL ? isGeneral(c) : (c.decks ?? []).includes(deckId) || c.from === deckId);
  const cards = Object.values(st.vocab).filter((c) => c.kind !== 'sentence' && !c.meaning?.trim() && inScope(c));
  const deckKeys = Object.keys(st.kv).filter((k) => k.startsWith('udeck:') && (!deckId || k === key(deckId)));
  const todo = new Map<string, DeckWord>();
  for (const c of cards) todo.set(lc(c.word), wordOfCard(c));
  for (const k of deckKeys) for (const w of (st.kv[k] as UserDeck).words ?? []) if (!w.vi?.trim() && !todo.has(lc(w.word))) todo.set(lc(w.word), w);
  if (!todo.size) return 0;
  const filled = new Map((await fillMissing([...todo.values()], onProgress, max)).filter((w) => w.vi?.trim()).map((w) => [lc(w.word), w]));
  if (!filled.size) return 0;
  const merge = (w: DeckWord): DeckWord => { const f = filled.get(lc(w.word)); return f && !w.vi?.trim() ? { ...w, vi: f.vi, pos: w.pos || f.pos, ipa: w.ipa || f.ipa, en: w.en || f.en, ex: w.ex || f.ex } : w; };
  const now = getState();
  const fix = cards.map((c) => now.vocab[c.id] ?? c).filter((c) => !c.meaning?.trim() && filled.has(lc(c.word))).map((c) => {
    const f = filled.get(lc(c.word))!;
    return { ...c, meaning: f.vi, pos: c.pos || f.pos || undefined, ipa: c.ipa || f.ipa, meaningEn: c.meaningEn || f.en, example: c.example || f.ex };
  });
  if (fix.length) await saveCards(fix);
  for (const k of deckKeys) {
    const d = getState().kv[k] as UserDeck | undefined;
    if (d?.words?.some((w) => !w.vi?.trim() && filled.has(lc(w.word)))) await setKv(k, { ...d, words: d.words.map(merge) });
  }
  return filled.size;
}
/** Số từ còn trống nghĩa trong một bộ (danh sách + thẻ). */
export const missingMeanings = (d: Deck) => deckWordsOf(d).filter((w) => !(findCard(w.word)?.meaning?.trim() || w.vi?.trim())).length;

// ---------- Link chia sẻ ----------
// JSON gọn → deflate (CompressionStream) → base64url. Không kèm tiến độ học.
// TODO (sau này): thư viện bộ từ cộng đồng – đăng bộ lên máy chủ chung thay vì gửi link/file.
export const SHARE_MAX_WORDS = 200;
export const SHARE_MAX_URL = 8000;
type ShareData = { n: string; e?: string; d?: string; t?: string; l?: string; w: (string | undefined)[][] };
const b64u = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  return new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());
}
export const shareSupported = () => typeof CompressionStream !== 'undefined';
export async function encodeShare(d: Pick<Deck, 'name' | 'emoji' | 'description' | 'topic' | 'level'>, words: DeckWord[]): Promise<string> {
  const data: ShareData = { n: d.name, e: d.emoji, d: d.description, t: d.topic, l: d.level, w: words.slice(0, SHARE_MAX_WORDS).map((w) => { const a = [w.word, w.pos, w.vi, w.ex, w.ipa]; while (a.length > 3 && !a.at(-1)) a.pop(); return a; }) };
  return b64u(await pipe(new TextEncoder().encode(JSON.stringify(data)), new CompressionStream('deflate')));
}
export async function decodeShare(s: string): Promise<{ meta: DeckMeta & { name: string }; words: DeckWord[] }> {
  const j = JSON.parse(new TextDecoder().decode(await pipe(unb64u(s), new DecompressionStream('deflate')))) as ShareData;
  if (!j || typeof j.n !== 'string' || !Array.isArray(j.w)) throw new Error('Link không đúng định dạng.');
  return {
    meta: { name: j.n.slice(0, 80), emoji: j.e, description: j.d, topic: j.t, level: j.l },
    words: uniqWords(j.w.filter((a) => Array.isArray(a) && typeof a[0] === 'string').slice(0, SHARE_MAX_WORDS).map((a) => ({ word: String(a[0]).slice(0, 60), pos: String(a[1] ?? ''), vi: String(a[2] ?? ''), ex: a[3] ? String(a[3]) : undefined, ipa: a[4] ? String(a[4]) : undefined }))),
  };
}
export const shareUrl = (code: string) => `${location.origin}${location.pathname}#/vocab/share?d=${code}`;

// ---------- Tiến độ một bộ ----------
export type DeckCounts = Record<WordState, number>;
export interface DeckProgress { n: DeckCounts; total: number; learned: number; due: number; pct: number }
/** Tiến độ bộ: thẻ đã có theo trạng thái FSRS + từ chưa thành thẻ (Sẽ học); `due` = thẻ đã học đến hạn hôm nay. */
export function deckProgress(d: Deck, byWord: Map<string, VocabCard>): DeckProgress {
  const n: DeckCounts = { new: 0, learning: 0, review: 0, known: 0 };
  let due = 0;
  const end = new Date().setHours(23, 59, 59, 999);
  for (const w of deckWordsOf(d)) {
    const c = byWord.get(lc(w.word));
    if (!c) { n.new++; continue; }
    n[cardState(c)]++;
    if (isLearned(c) && c.due <= end) due++;
  }
  const total = n.new + n.learning + n.review + n.known;
  const learned = n.review + n.known;
  return { n, total, learned, due, pct: total ? Math.round((learned / total) * 100) : 0 };
}

/** Từ đã lưu ở một đề (thẻ lưu từ bài của đề + bộ tạo cho đề) và bộ nên mở. */
export function savedForTest(tid: string): { n: number; deck: string } {
  const st = getState();
  const ref = Object.values(st.kv).find((v): v is UserDeck => !!v && typeof v === 'object' && (v as UserDeck).ref === tid && Array.isArray((v as UserDeck).words));
  const mapped = readMap()[tid];
  const deck = ref ? `my:${ref.id}` : mapped && (mapped === GENERAL || getUserDeck(mapped)) ? mapped : GENERAL;
  const words = new Set<string>();
  for (const c of Object.values(st.vocab)) if (c.kind !== 'sentence' && c.from?.startsWith(`${tid}-`)) words.add(lc(c.word));
  for (const w of ref?.words ?? []) words.add(lc(w.word));
  return { n: words.size, deck };
}
