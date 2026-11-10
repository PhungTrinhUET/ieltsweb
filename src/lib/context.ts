// A4. Câu ngữ cảnh thật cho từ vựng: chỉ mục public/data/context.json (build-data) + tìm trực tiếp trong đề đã tải
// cho từ không nằm trong chỉ mục (từ tự lưu, bộ tự tạo).
import type { Material } from '../types';
import { resolveUrl } from '../db';
import { stopAudio } from '../components/AudioPlayer';
import { stopSpeak } from './tts';

export interface CtxSent { mid: string; text: string; start?: number; end?: number }
interface CtxFile { s: [string, string, number?, number?][]; w: Record<string, number[]> }

let pending: Promise<CtxFile> | null = null;
export function loadContext(): Promise<CtxFile> {
  pending ??= fetch('./data/context.json').then((r) => (r.ok ? r.json() : { s: [], w: {} })).catch(() => { pending = null; return { s: [], w: {} }; });
  return pending;
}

/** Các dạng biến đổi thường gặp (giống scripts/build-data.mjs). */
export function forms(w: string): string[] {
  const f = new Set([w, w + 's', w + 'es', w + 'ed', w + 'ing', w + 'd']);
  if (/[^aeiou]y$/.test(w)) { const b = w.slice(0, -1); f.add(b + 'ies'); f.add(b + 'ied'); }
  if (/e$/.test(w)) { const b = w.slice(0, -1); f.add(b + 'ing'); f.add(b + 'ed'); }
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(w) && w.length <= 6) { const d = w + w.at(-1); f.add(d + 'ed'); f.add(d + 'ing'); }
  return [...f];
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** RegExp tìm từ/cụm từ (từ cuối được biến đổi) trong câu. */
export function wordRe(word: string, flags = 'i') {
  const t = word.toLowerCase().trim().split(/\s+/);
  const last = forms(t.at(-1)!).map(esc).join('|');
  return new RegExp(`(?<![A-Za-z])(${[...t.slice(0, -1).map(esc), `(?:${last})`].join('\\s+')})(?![A-Za-z])`, flags);
}

function splitSentences(text: string) {
  return text.replace(/\s+/g, ' ').split(/(?<=[.!?]["”’)]?)\s+(?=["“‘(]?[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);
}
/** Tìm trực tiếp trong đề (chậm hơn chỉ mục; chỉ dùng cho từ ngoài chỉ mục). */
function scan(word: string, materials: Record<string, Material>, max: number): CtxSent[] {
  const re = wordRe(word);
  const out: CtxSent[] = []; const seen = new Set<string>();
  for (const m of Object.values(materials)) {
    if (!m.builtin || seen.has(m.id)) continue;
    if (m.skill === 'reading') {
      for (const s of splitSentences(m.passage ?? '')) { const n = s.split(' ').length; if (n >= 6 && n <= 34 && re.test(s)) { out.push({ mid: m.id, text: s }); seen.add(m.id); break; } }
    } else if (m.skill === 'listening' && m.segments?.length && m.audio) {
      const g = m.segments.find((x) => re.test(x.text) && x.text.split(' ').length >= 5);
      if (g) { out.push({ mid: m.id, text: g.text, start: g.start, end: g.end }); seen.add(m.id); }
    }
    if (out.length >= max) break;
  }
  return out;
}

/** 1–max câu thật có chứa từ, kèm nguồn. */
export async function contextFor(word: string, materials: Record<string, Material>, max = 3): Promise<CtxSent[]> {
  const ctx = await loadContext();
  const key = word.toLowerCase().trim();
  const idx = ctx.w[key];
  if (idx?.length) return idx.slice(0, max).map((i) => { const [mid, text, start, end] = ctx.s[i]; return { mid, text, start, end }; });
  return scan(key, materials, max);
}

/** "VOL 3 · Test 2 · Reading P1" / "… · Listening S2". */
export function srcLabel(mid: string) {
  const m = mid.match(/^vol(\d+)-t(\d+)-([rlw])(\d+)$/);
  if (!m) return mid;
  return `VOL ${m[1]} · Test ${m[2]} · ${m[3] === 'r' ? `Reading P${m[4]}` : m[3] === 'l' ? `Listening S${m[4]}` : `Writing ${m[4]}`}`;
}
export const matHref = (mid: string) => (/-l\d+$/.test(mid) ? `/listening/${mid}/study` : `/reading/${mid}/study`);

// Phát một đoạn audio đề gốc (dùng chung, mỗi lúc một đoạn).
let clip: HTMLAudioElement | null = null; let clipTok = 0;
export async function playClip(src: string, start: number, end: number, rate = 1) {
  const url = await resolveUrl(src); if (!url) return;
  stopAudio(); stopSpeak();
  if (!clip || clip.dataset.src !== url) { clip?.pause(); clip = new Audio(url); clip.dataset.src = url; }
  const a = clip; const my = ++clipTok;
  const go = () => {
    a.currentTime = Math.max(0, start - 0.3); a.playbackRate = rate; a.play().catch(() => {});
    const tick = () => { if (my !== clipTok) return; if (a.currentTime >= end + 0.3 || a.paused) { a.pause(); return; } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
}
export function stopClip() { clipTok++; clip?.pause(); }
/** Audio của material (chỉ Listening có). */
export const matAudio = (m?: Material): string | undefined => (m && m.skill === 'listening' ? m.audio : undefined);
