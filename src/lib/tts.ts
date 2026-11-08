// Giọng đọc máy (Web Speech API). Dùng cho: đọc bài Reading, Listening không có audio, chép chính tả theo câu.
import { getSettings } from '../store';

let voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices();
  if (!voices.length) speechSynthesis.addEventListener('voiceschanged', () => { voices = speechSynthesis.getVoices(); }, { once: true });
}
loadVoices();

export const ttsAvailable = () => 'speechSynthesis' in window;

// Giọng "novelty" của macOS/iOS và giọng Eloquence (Eddy, Flo, Grandma…) nghe như robot → loại hẳn. Giọng "Compact" chất lượng thấp → loại.
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|junior|ralph|fred|kathy|princess|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
const GOOD_GB = /\b(daniel|kate|serena|arthur|martha|libby|ryan|sonia|oliver|thomas|stephanie|maisie|hazel|george|susan)\b/i;
const FEMALE = /female|woman|\b(libby|sonia|kate|serena|martha|maisie|hazel|susan|stephanie|karen|samantha|catherine|natasha|aria|jenny|michelle|emma|ava|allison|susan|tessa|moira|fiona|victoria|zira|clara|nicole|olivia|amy|joanna|salli|kimberly|ivy|emily)\b/i;
const MALE = /\bmale\b|\bman\b|\b(daniel|arthur|ryan|oliver|thomas|george|lee|guy|davis|tony|eric|christopher|brian|william|james|alex|aaron|tom|fred|gordon|matthew|joey|justin|russell|mark|david|liam|william)\b/i;

const isBad = (v: SpeechSynthesisVoice) => NOVELTY.test(v.name) || /compact/i.test(v.name);
/** Điểm chất lượng: Natural/Neural/Online (Edge) → Google UK/US → Premium/Enhanced → giọng en-GB tốt → en-AU → en-US. */
function score(v: SpeechSynthesisVoice) {
  const n = v.name, l = v.lang.toLowerCase().replace('_', '-');
  let x = 0;
  if (/natural|neural|online/i.test(n)) x += 1000;
  else if (/^google (uk|us) english/i.test(n)) x += 800;
  else if (/premium/i.test(n)) x += 600;
  else if (/enhanced/i.test(n)) x += 550;
  if (GOOD_GB.test(n) && l === 'en-gb') x += 300;
  x += l === 'en-gb' ? 60 : l === 'en-au' ? 40 : l === 'en-us' ? 30 : 0;
  return x;
}
export const voiceGender = (v: SpeechSynthesisVoice): 'f' | 'm' | '' => (FEMALE.test(v.name) ? 'f' : MALE.test(v.name) ? 'm' : '');

/** Giọng tiếng Anh đã lọc, tốt nhất đứng đầu. */
export function englishVoices() {
  const all = (voices.length ? voices : ttsAvailable() ? speechSynthesis.getVoices() : []).filter((v) => v.lang.toLowerCase().startsWith('en') && !isBad(v));
  return all.map((v) => [v, score(v)] as const).sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

/** `pref` là tên giọng hoặc mã vùng (en-GB…: tự chọn giọng tốt nhất của vùng đó). */
function pickVoice(pref: string) {
  const all = englishVoices();
  const byName = all.find((v) => v.name === pref);
  if (byName) return byName;
  const l = pref.toLowerCase();
  return all.find((v) => v.lang.toLowerCase().replace('_', '-') === l)
    ?? all[0]
    ?? null;
}

/** Giọng cho các nhân vật (không phải người dẫn): 3–4 giọng tốt nhất, xen kẽ nam/nữ nếu đoán được. */
export function speakerVoices(narrator: string) {
  const all = englishVoices();
  const narr = pickVoice(narrator);
  const top = all.filter((v) => v !== narr).slice(0, 6);
  const f = top.filter((v) => voiceGender(v) === 'f'), m = top.filter((v) => voiceGender(v) === 'm'), u = top.filter((v) => !voiceGender(v));
  const out: SpeechSynthesisVoice[] = [];
  while (out.length < 4 && (f.length || m.length || u.length)) {
    const a = f.shift() ?? u.shift(); if (a) out.push(a);
    const b = m.shift() ?? u.shift(); if (b) out.push(b);
  }
  return out.slice(0, 4).map((v) => v.name);
}

let current: SpeechSynthesisUtterance | null = null;
export function stopSpeak() {
  if (!ttsAvailable()) return;
  speechSynthesis.cancel();
  current = null;
}

/** Đọc một đoạn; resolve khi đọc xong (hoặc bị huỷ). */
export function speak(text: string, opts: { rate?: number; voice?: string; onBoundary?: (charIndex: number) => void } = {}) {
  return new Promise<void>((resolve) => {
    if (!ttsAvailable() || !text.trim()) return resolve();
    speechSynthesis.cancel();
    const s = getSettings();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(opts.voice ?? s.ttsVoice);
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-GB';
    u.rate = opts.rate ?? s.ttsRate;
    u.onend = () => { if (current === u) current = null; resolve(); };
    u.onerror = () => { if (current === u) current = null; resolve(); };
    if (opts.onBoundary) u.onboundary = (e) => opts.onBoundary?.(e.charIndex);
    current = u;
    speechSynthesis.speak(u);
    // Chrome dừng TTS sau ~15 s với utterance dài – giữ sống bằng pause/resume.
    const keep = window.setInterval(() => { if (!speechSynthesis.speaking || current !== u) return window.clearInterval(keep); speechSynthesis.pause(); speechSynthesis.resume(); }, 10000);
  });
}
export const isSpeaking = () => ttsAvailable() && speechSynthesis.speaking;
