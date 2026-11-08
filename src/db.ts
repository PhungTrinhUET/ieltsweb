// Lưu trữ trên trình duyệt bằng IndexedDB: tài liệu, file audio/ảnh, kết quả, từ vựng, ghi chú.
// Toàn bộ được nạp vào bộ nhớ khi mở app (useSyncExternalStore) – ghi xuống IndexedDB ở nền.
import { useSyncExternalStore } from 'react';
import type { Attempt, Material, Note, Skill, VocabCard } from './types';
import { SAMPLE_MATERIALS } from './content/samples';

const DB = 'ielts-practice';
const VERSION = 1;
const STORES = ['materials', 'blobs', 'attempts', 'vocab', 'notes', 'drafts'] as const;
type StoreName = (typeof STORES)[number];

let dbp: Promise<IDBDatabase> | null = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return dbp;
}
async function tx<T>(store: StoreName, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const r = f(t.objectStore(store));
    t.oncomplete = () => res((r as IDBRequest<T> | undefined)?.result as T);
    t.onerror = () => rej(t.error);
  });
}
const put = (store: StoreName, key: string, v: unknown) => tx(store, 'readwrite', (s) => { s.put(v, key); });
const del = (store: StoreName, key: string) => tx(store, 'readwrite', (s) => { s.delete(key); });
async function all<T>(store: StoreName): Promise<Record<string, T>> {
  const d = await open();
  return new Promise((res, rej) => {
    const out: Record<string, T> = {};
    const req = d.transaction(store).objectStore(store).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return res(out);
      out[String(c.key)] = c.value as T;
      c.continue();
    };
    req.onerror = () => rej(req.error);
  });
}

// ---------- state trong bộ nhớ ----------
export interface State {
  ready: boolean;
  materials: Record<string, Material>;
  attempts: Attempt[];
  vocab: Record<string, VocabCard>;
  notes: Record<string, Note>;
  drafts: Record<string, string>;
}
let state: State = { ready: false, materials: {}, attempts: [], vocab: {}, notes: {}, drafts: {} };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; emit(); };
export const useDb = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
export const getState = () => state;

export async function init() {
  if (state.ready) return;
  try {
    const [materials, attempts, vocab, notes, drafts] = await Promise.all([
      all<Material>('materials'), all<Attempt>('attempts'), all<VocabCard>('vocab'), all<Note>('notes'), all<string>('drafts'),
    ]);
    // Nội dung mẫu + bộ đề đóng gói sẵn (public/data) luôn có mặt (có thể ẩn) – không ghi đè bản người dùng đã sửa.
    const hidden = new Set<string>(JSON.parse(localStorage.getItem('ielts:hidden-samples') || '[]'));
    for (const m of [...SAMPLE_MATERIALS, ...(await loadBundled())]) if (!materials[m.id] && !hidden.has(m.id)) materials[m.id] = m;
    set({ ready: true, materials, attempts: Object.values(attempts).sort((a, b) => b.at - a.at), vocab, notes, drafts });
  } catch (e) {
    console.error('IndexedDB không khả dụng', e);
    const materials: Record<string, Material> = {};
    for (const m of SAMPLE_MATERIALS) materials[m.id] = m;
    set({ ready: true, materials });
  }
}

/** Bộ đề đóng gói sẵn trong public/data (sinh bởi scripts/build-data.mjs). */
async function loadBundled(): Promise<Material[]> {
  try {
    const idx = await fetch('./data/index.json').then((r) => (r.ok ? r.json() : null));
    if (!idx?.files) return [];
    const lists = await Promise.all((idx.files as { file: string }[]).map((f) => fetch(`./data/${f.file}`).then((r) => (r.ok ? r.json() : [])).catch(() => [])));
    return lists.flat();
  } catch { return []; }
}
export const bundledCount = async () => (await loadBundled()).length;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---------- Materials ----------
export async function saveMaterial(m: Material) {
  set({ materials: { ...state.materials, [m.id]: m } });
  if (!m.builtin) await put('materials', m.id, m);
  else await put('materials', m.id, { ...m, builtin: false });
}
export async function saveMaterials(ms: Material[]) {
  const next = { ...state.materials };
  for (const m of ms) next[m.id] = m;
  set({ materials: next });
  for (const m of ms) await put('materials', m.id, m);
}
export async function deleteMaterial(id: string) {
  const m = state.materials[id];
  const next = { ...state.materials };
  delete next[id];
  set({ materials: next });
  await del('materials', id);
  if (m?.builtin) {
    const hidden = new Set<string>(JSON.parse(localStorage.getItem('ielts:hidden-samples') || '[]'));
    hidden.add(id);
    localStorage.setItem('ielts:hidden-samples', JSON.stringify([...hidden]));
  }
  // dọn blob đi kèm
  const blobKeys = ['audio' in (m ?? {}) ? (m as { audio?: string }).audio : undefined, 'image' in (m ?? {}) ? (m as { image?: string }).image : undefined];
  for (const k of blobKeys) if (k?.startsWith('idb:')) await del('blobs', k.slice(4)).catch(() => {});
}
export async function restoreSamples() {
  localStorage.removeItem('ielts:hidden-samples');
  const next = { ...state.materials };
  for (const m of SAMPLE_MATERIALS) if (!next[m.id]) next[m.id] = m;
  set({ materials: next });
}
export const materialsOf = (skill: Skill) => Object.values(state.materials).filter((m) => m.skill === skill).sort((a, b) => a.addedAt - b.addedAt);

// ---------- Blobs (audio / ảnh) ----------
const urlCache = new Map<string, string>();
const AUDIO_BASE = String(import.meta.env.VITE_AUDIO_BASE ?? '').replace(/([^/])$/, '$1/');
export async function saveBlob(blob: Blob, key = uid()) {
  await put('blobs', key, blob);
  return `idb:${key}`;
}
/** Trả URL dùng được cho <audio>/<img>: URL thường giữ nguyên, idb:<key> → blob URL. */
export async function resolveUrl(src: string | undefined): Promise<string | null> {
  if (!src) return null;
  // Audio đề gốc có thể đặt ở host khác (R2, S3, Drive công khai…): VITE_AUDIO_BASE=https://…/ → https://…/vol5/test7/s1.mp3
  if (src.startsWith('audio/') && AUDIO_BASE) return AUDIO_BASE + src.slice('audio/'.length);
  if (!src.startsWith('idb:')) return src;
  const cached = urlCache.get(src);
  if (cached) return cached;
  const blob = await tx<Blob>('blobs', 'readonly', (s) => s.get(src.slice(4)));
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(src, url);
  return url;
}

// ---------- Attempts ----------
export async function addAttempt(a: Omit<Attempt, 'id' | 'at'>) {
  const full: Attempt = { ...a, id: uid(), at: Date.now() };
  set({ attempts: [full, ...state.attempts] });
  await put('attempts', full.id, full);
  return full;
}
export async function updateAttempt(id: string, patch: Partial<Attempt>) {
  const cur = state.attempts.find((a) => a.id === id);
  if (!cur) return;
  const full = { ...cur, ...patch };
  set({ attempts: state.attempts.map((a) => (a.id === id ? full : a)) });
  await put('attempts', id, full);
}
export async function clearAttempts() {
  set({ attempts: [] });
  for (const a of Object.keys(await all('attempts'))) await del('attempts', a);
}

// ---------- Vocab ----------
export async function saveCard(c: VocabCard) {
  set({ vocab: { ...state.vocab, [c.id]: c } });
  await put('vocab', c.id, c);
}
export async function deleteCard(id: string) {
  const next = { ...state.vocab };
  delete next[id];
  set({ vocab: next });
  await del('vocab', id);
}
export function findCard(word: string) {
  const w = word.trim().toLowerCase();
  return Object.values(state.vocab).find((c) => c.word.toLowerCase() === w);
}

// ---------- Notes & drafts ----------
export async function saveNote(n: Note) {
  set({ notes: { ...state.notes, [n.materialId]: n } });
  await put('notes', n.materialId, n);
}
export async function saveDraft(key: string, text: string) {
  set({ drafts: { ...state.drafts, [key]: text } });
  await put('drafts', key, text);
}

// ---------- Sao lưu ----------
export async function exportAll() {
  const materials = Object.values(state.materials).filter((m) => !m.builtin);
  return JSON.stringify({ app: 'ielts-practice', version: 1, exportedAt: new Date().toISOString(), materials, attempts: state.attempts, vocab: Object.values(state.vocab), notes: Object.values(state.notes) }, null, 1);
}
export async function importBackup(json: string) {
  const d = JSON.parse(json);
  if (d.app !== 'ielts-practice') throw new Error('File không phải bản sao lưu của IELTS Practice');
  if (Array.isArray(d.materials)) await saveMaterials(d.materials);
  if (Array.isArray(d.vocab)) for (const c of d.vocab) await saveCard(c);
  if (Array.isArray(d.notes)) for (const n of d.notes) await saveNote(n);
  if (Array.isArray(d.attempts)) {
    const ids = new Set(state.attempts.map((a) => a.id));
    const extra = (d.attempts as Attempt[]).filter((a) => !ids.has(a.id));
    set({ attempts: [...extra, ...state.attempts].sort((a, b) => b.at - a.at) });
    for (const a of extra) await put('attempts', a.id, a);
  }
}
