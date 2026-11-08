// Dịch Anh → Việt miễn phí, không cần API key: MyMemory (api.mymemory.translated.net, CORS mở).
// Giới hạn ẩn danh ~5000 ký tự/ngày/IP, mỗi lượt ≤ 500 byte → tách theo câu, cache trong localStorage.

const CACHE_KEY = 'ielts-free-tr-v1';
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

async function one(text: string): Promise<string> {
  const key = text.trim();
  const hit = load()[key];
  if (hit) return hit.replace(/\s+([,;:.!?])/g, '$1').replace(/([,;])(?=[^\s\d])/g, '$1 ');
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
