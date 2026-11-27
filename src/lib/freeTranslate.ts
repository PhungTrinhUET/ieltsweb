// Dịch Anh → Việt miễn phí, không cần API key:
// 1) Google Translate (clients5.google.com, cổng của tiện ích từ điển Chrome; CORS mở) – chuẩn hơn nhiều, có nghĩa theo từ loại;
// 2) dự phòng MyMemory (api.mymemory.translated.net, ~5000 ký tự/ngày/IP, mỗi lượt ≤ 500 byte; với từ đơn hay trả nghĩa lạc).
// Tách theo câu, cache trong localStorage.

const CACHE_KEY = 'ielts-free-tr-v2'; // v1 chứa bản dịch từ đơn kém của MyMemory → bỏ
try { localStorage.removeItem('ielts-free-tr-v1'); } catch { /* */ }
let cache: Record<string, string> | null = null;
function load(): Record<string, string> {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { cache = {}; }
  return cache!;
}
function store(k: string, v: string) {
  const c = load();
  c[k] = v;
  try {
    const keys = Object.keys(c);
    if (keys.length > 3000) for (const old of keys.slice(0, 500)) delete c[old];
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch { /* bộ nhớ đầy / chế độ riêng tư → bỏ qua cache */ }
}

export class QuotaError extends Error {}

/** Nghĩa theo từ loại (Google): [{ pos: 'v', terms: ['cấm', 'ngăn trở'] }]. */
export interface ViSense { pos: string; terms: string[] }
const GPOS: Record<string, string> = { noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv', preposition: 'prep', conjunction: 'conj', pronoun: 'pron', interjection: 'interj', phrase: 'phr', abbreviation: 'abbr' };
const senseCache = new Map<string, ViSense[]>();

async function google(text: string): Promise<{ text: string; senses: ViSense[] }> {
  const r = await fetch(`https://clients5.google.com/translate_a/single?client=dict-chrome-ex&sl=en&tl=vi&dt=t&dt=bd&dj=1&q=${encodeURIComponent(text)}`);
  if (!r.ok) throw new Error(`Google ${r.status}`);
  const d = await r.json() as { sentences?: { trans?: string }[]; dict?: { pos: string; terms: string[] }[] };
  const out = (d.sentences ?? []).map((x) => x.trans ?? '').join('').trim();
  if (!out) throw new Error('Google: rỗng');
  return { text: out, senses: (d.dict ?? []).map((x) => ({ pos: GPOS[x.pos] ?? x.pos, terms: x.terms.slice(0, 5) })) };
}

async function one(text: string): Promise<string> {
  const key = text.trim();
  const hit = load()[key];
  if (hit) return hit.replace(/\s+([,;:.!?])/g, '$1').replace(/([,;])(?=[^\s\d])/g, '$1 ');
  try {
    const g = await google(key);
    let out = g.text;
    if (!/\s/.test(key) && key === key.toLowerCase()) out = out.toLowerCase();
    if (g.senses.length) senseCache.set(key.toLowerCase(), g.senses);
    store(key, out);
    return out;
  } catch { /* Google chặn/lỗi → MyMemory */ }
  const r = await fetch(`https://api.mymemory.translated.net/get?langpair=en|vi&q=${encodeURIComponent(key)}`);
  if (!r.ok) throw new Error(`Dịch miễn phí lỗi (${r.status})`);
  const d = await r.json();
  if (d.quotaFinished || d.responseStatus === 429) throw new QuotaError('Đã hết lượt dịch miễn phí hôm nay. Cấu hình AI trong Cài đặt để dịch tiếp.');
  if (d.responseStatus !== 200) throw new Error(String(d.responseDetails || 'Dịch miễn phí lỗi'));
  let out: string = d.responseData?.translatedText ?? '';
  // Với từ đơn, MyMemory hay trả chữ HOA hoặc viết hoa đầu → đưa về chữ thường như từ điển.
  if (!/\s/.test(key) && key === key.toLowerCase()) out = out.toLowerCase();
  // MyMemory hay trả "tơ ,lụa" → chuẩn hoá dấu câu.
  out = out.replace(/\s+([,;:.!?])/g, '$1').replace(/([,;])(?=[^\s\d])/g, '$1 ').replace(/\s{2,}/g, ' ').trim();
  if (!/\p{L}/u.test(out)) out = '';
  store(key, out);
  return out;
}

/** Tách văn bản thành các khúc ≤ ~450 ký tự theo ranh giới câu. */
function chunks(text: string): string[] {
  const sents = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…]["”’)]?)\s+/);
  const out: string[] = [];
  let buf = '';
  for (const s of sents) {
    if (buf && (buf + ' ' + s).length > 450) { out.push(buf); buf = s; } else buf = buf ? `${buf} ${s}` : s;
  }
  if (buf) out.push(buf);
  return out.flatMap((c) => (c.length <= 480 ? [c] : c.match(/.{1,450}(\s|$)/g) ?? [c]));
}

export async function freeTranslate(text: string): Promise<string> {
  const parts = chunks(text);
  const out: string[] = [];
  for (const p of parts) out.push(await one(p));
  return out.join(' ');
}

/** Nghĩa Việt của một từ/cụm + các nghĩa theo từ loại (nếu nguồn có). */
export async function freeWordVi(word: string): Promise<{ vi: string; senses: ViSense[] }> {
  const k = word.trim().toLowerCase();
  let senses = senseCache.get(k);
  if (!senses) {
    try { const g = await google(word.trim()); senses = g.senses; senseCache.set(k, senses); if (!load()[word.trim()]) store(word.trim(), /\s/.test(k) ? g.text : g.text.toLowerCase()); }
    catch { senses = []; }
  }
  return { vi: await freeTranslate(word), senses };
}

/** Dịch: ưu tiên AI nếu đã cấu hình (chính xác hơn), không thì dùng bản miễn phí. */
export async function translateText(text: string): Promise<string> {
  const { aiReady, getAiConfig } = await import('../store');
  if (aiReady(getAiConfig())) {
    const { translateMany } = await import('../ai/assist');
    const [vi] = await translateMany([text], getAiConfig());
    return vi;
  }
  return freeTranslate(text);
}

const linesCache = new Map<string, string>();
/** Dịch nhiều dòng ngắn (đề bài, phương án): AI dịch một lượt; bản miễn phí dịch từng dòng (có cache). */
export async function translateLines(lines: string[]): Promise<string[]> {
  const todo = [...new Set(lines.filter((l) => l.trim() && !linesCache.has(l)))];
  if (todo.length) {
    const { aiReady, getAiConfig } = await import('../store');
    if (aiReady(getAiConfig())) {
      const { translateMany } = await import('../ai/assist');
      const vi = await translateMany(todo, getAiConfig());
      todo.forEach((l, i) => vi[i] && linesCache.set(l, vi[i]));
    } else {
      // 4 lượt song song cho nhanh; lỗi hết lượt thì dừng.
      let i = 0;
      const worker = async () => { while (i < todo.length) { const l = todo[i++]; linesCache.set(l, await freeTranslate(l)); } };
      await Promise.all([worker(), worker(), worker(), worker()]);
    }
  }
  return lines.map((l) => linesCache.get(l) ?? '');
}
