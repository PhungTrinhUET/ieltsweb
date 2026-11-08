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
export function englishVoices() {
  return (voices.length ? voices : speechSynthesis.getVoices()).filter((v) => v.lang.toLowerCase().startsWith('en'));
}

function pickVoice(lang: string) {
  const all = englishVoices();
  const byName = all.find((v) => v.name === lang);
  if (byName) return byName;
  const l = lang.toLowerCase();
  return all.find((v) => v.lang.toLowerCase().replace('_', '-') === l && /google|natural|premium|enhanced/i.test(v.name))
    ?? all.find((v) => v.lang.toLowerCase().replace('_', '-') === l)
    ?? all.find((v) => v.lang.toLowerCase().startsWith(l.slice(0, 2)))
    ?? null;
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
