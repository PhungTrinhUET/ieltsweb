import { useSyncExternalStore } from 'react';
import { DEFAULT_EFFORT, DEFAULT_MODEL, type Effort } from './ai/models';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  /** Tốc độ phát audio. */
  speed: number;
  /** Giọng đọc máy (TTS) khi tài liệu không có audio. */
  ttsVoice: string;
  ttsRate: number;
  /** Mục tiêu band. */
  targetBand: number;
  /** Mỗi ngày học bao nhiêu từ mới. */
  newCardsPerDay: number;
  /** Module Reading mặc định. */
  module: 'academic' | 'general';
}

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch { return fallback; }
}
function write(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }

export function createStore<T>(key: string, initial: T) {
  let state = read(key, initial);
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(next: T) { state = next; write(key, next); subs.forEach((f) => f()); },
    subscribe(f: () => void) { subs.add(f); return () => subs.delete(f); },
  };
}

const settingsStore = createStore<Settings>('ielts:settings:v1', { theme: 'system', speed: 1, ttsVoice: 'en-GB', ttsRate: 0.95, targetBand: 7, newCardsPerDay: 15, module: 'academic' });
export const useSettings = () => useSyncExternalStore(settingsStore.subscribe, settingsStore.get);
export const getSettings = settingsStore.get;
export function updateSettings(patch: Partial<Settings>) {
  const next = { ...settingsStore.get(), ...patch };
  settingsStore.set(next);
  if (patch.theme) applyTheme(next.theme);
}
export function applyTheme(theme: Settings['theme']) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('ielts:theme', theme); } catch { /* ignore */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e1120' : '#0f766e');
}

// ---------- Cấu hình AI (Claude) ----------
export interface AiConfig {
  mode: 'key' | 'proxy';
  apiKey: string;
  proxyUrl: string;
  accessCode: string;
  model: string;
  effort: Effort;
  /** Model rẻ cho tác vụ nhẹ (dịch câu, tra từ). */
  lightModel: string;
}
const aiStore = createStore<AiConfig>('ielts:ai:v1', { mode: 'key', apiKey: '', proxyUrl: '', accessCode: '', model: DEFAULT_MODEL, effort: DEFAULT_EFFORT, lightModel: 'claude-haiku-5-5' });
export const useAiConfig = () => useSyncExternalStore(aiStore.subscribe, aiStore.get);
export const getAiConfig = aiStore.get;
export const updateAiConfig = (patch: Partial<AiConfig>) => aiStore.set({ ...aiStore.get(), ...patch });
export const aiReady = (c: AiConfig) => (c.mode === 'key' ? c.apiKey.trim().length > 0 : /^https?:\/\//.test(c.proxyUrl.trim()));

// ---------- Streak học tập ----------
export function touchStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const s = read<{ last: string; count: number; days: string[] }>('ielts:streak', { last: '', count: 0, days: [] });
  if (s.last === today) return s;
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const next = { last: today, count: s.last === y ? s.count + 1 : 1, days: [...s.days.slice(-60), today] };
  write('ielts:streak', next);
  return next;
}
export const getStreak = () => read<{ last: string; count: number; days: string[] }>('ielts:streak', { last: '', count: 0, days: [] });

// ---------- Bài đang học dở (cho nút "Tiếp tục" ở trang chủ) ----------
export interface LastOpen { id: string; path: string; mode: 'practice' | 'test'; at: number }
export const setLastOpen = (id: string, path: string, mode: LastOpen['mode']) => write('ielts:last', { id, path, mode, at: Date.now() });
export const getLastOpen = () => read<LastOpen | null>('ielts:last', null);
