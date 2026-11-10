// Từ điển miễn phí (không cần key): Datamuse (IPA, loại từ, định nghĩa Anh), dictionaryapi.dev dự phòng.
export interface DictEntry { phonetic?: string; phonetics?: { text?: string }[]; meanings: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[] }
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
export function freeDict(word: string): Promise<DictEntry | null> {
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
export const POS_VI: Record<string, string> = { noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv', preposition: 'prep', conjunction: 'conj', pronoun: 'pron', interjection: 'interj' };

/** Thông tin gọn cho một từ: loại từ ngắn, IPA, định nghĩa Anh, ví dụ (nếu có). */
export async function dictInfo(word: string): Promise<{ pos?: string; ipa?: string; en?: string; ex?: string }> {
  const d = await freeDict(word).catch(() => null);
  if (!d) return {};
  const m = d.meanings[0];
  const ipa = d.phonetic || d.phonetics?.find((p) => p.text)?.text;
  const ex = d.meanings.flatMap((x) => x.definitions).find((x) => x.example)?.example;
  return { pos: m ? POS_VI[m.partOfSpeech] ?? m.partOfSpeech : undefined, ipa: ipa || undefined, en: m?.definitions[0]?.definition, ex };
}
