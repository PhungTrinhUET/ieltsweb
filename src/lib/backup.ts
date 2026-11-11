// Sao lưu / khôi phục toàn bộ dữ liệu người học (v2).
// v1: materials, attempts, vocab, notes, logs, kv.  v2 thêm: drafts, settings (localStorage, trừ API key), blobs (tuỳ chọn, base64).
// Nhập: đọc cả v1 lẫn v2; "Gộp" (giữ bản mới hơn, không nhân đôi) hoặc "Thay thế toàn bộ".
import type { Attempt, Material, Note, RevLog, VocabCard } from '../types';
import { TOMB, _low, getState, saveMaterials } from '../db';
import { migrate } from './srs';
import { SAMPLE_MATERIALS } from '../content/samples';

export interface BackupOpts { media?: boolean; apiKey?: boolean }
export interface BackupFile {
  app: 'ielts-practice'; version: 1 | 2; exportedAt: string;
  materials?: Material[]; attempts?: Attempt[]; vocab?: VocabCard[]; notes?: Note[]; logs?: RevLog[];
  kv?: Record<string, unknown>; drafts?: Record<string, string>;
  settings?: Record<string, string>; blobs?: Record<string, string>;
  hasApiKey?: boolean;
}
export interface BackupSummary {
  version: number; exportedAt?: string;
  counts: { attempts: number; vocab: number; notes: number; drafts: number; decks: number; materials: number; logs: number; blobs: number; settings: number };
  hasApiKey: boolean;
}

const LAST_KEY = 'ielts:lastBackupAt';
const AI_KEY = 'ielts:ai:v1';
/** Khoá localStorage không đưa vào sao lưu (cache, số báo danh giả…). */
const SKIP_LS = new Set(['ielts-free-tr-v1', LAST_KEY, 'ielts:backup-snooze']);
const SECRET_FIELDS = ['apiKey', 'keys', 'accessCode'] as const;

export const lastBackupAt = () => { try { return +(localStorage.getItem(LAST_KEY) ?? 0) || 0; } catch { return 0; } };
export const markBackedUp = () => { try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* bỏ qua */ } };

function readSettings(withKey: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (!/^ielts[:-]/.test(k) || SKIP_LS.has(k)) continue;
      let v = localStorage.getItem(k) ?? '';
      if (k === AI_KEY && !withKey) {
        try { const o = JSON.parse(v); for (const f of SECRET_FIELDS) delete o[f]; v = JSON.stringify(o); } catch { continue; }
      }
      out[k] = v;
    }
  } catch { /* localStorage bị chặn */ }
  return out;
}

const toB64 = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
const fromB64 = async (s: string) => (await fetch(s)).blob();

/** Dung lượng audio/ảnh đã lưu (byte) – để báo trước khi người dùng chọn kèm vào file. */
export async function mediaSize() {
  const blobs = await _low.all<Blob>('blobs');
  return Object.values(blobs).reduce((n, b) => n + (b?.size ?? 0), 0);
}

export async function exportAll(opts: BackupOpts = {}) {
  const s = getState();
  const out: BackupFile = {
    app: 'ielts-practice', version: 2, exportedAt: new Date().toISOString(),
    materials: Object.values(s.materials).filter((m) => !m.builtin),
    attempts: s.attempts, vocab: Object.values(s.vocab), notes: Object.values(s.notes), logs: s.logs, kv: s.kv,
    drafts: s.drafts, settings: readSettings(!!opts.apiKey), hasApiKey: !!opts.apiKey,
  };
  if (opts.media) {
    out.blobs = {};
    for (const [k, b] of Object.entries(await _low.all<Blob>('blobs'))) if (b) out.blobs[k] = await toB64(b);
  }
  return JSON.stringify(out, null, opts.media ? 0 : 1);
}

/** Tải file sao lưu về máy + ghi nhớ thời điểm sao lưu. */
export async function downloadBackup(opts: BackupOpts = {}) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([await exportAll(opts)], { type: 'application/json' }));
  a.download = `ielts-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  markBackedUp();
}

export function parseBackup(json: string): BackupFile {
  let d: BackupFile;
  try { d = JSON.parse(json); } catch { throw new Error('File không đọc được (không phải JSON).'); }
  if (d?.app !== 'ielts-practice') throw new Error('File không phải bản sao lưu của IELTS Practice');
  return d;
}

export function summarize(d: BackupFile): BackupSummary {
  const kv = d.kv ?? {};
  return {
    version: d.version ?? 1, exportedAt: d.exportedAt,
    counts: {
      attempts: d.attempts?.length ?? 0, vocab: d.vocab?.length ?? 0, notes: d.notes?.length ?? 0,
      drafts: Object.keys(d.drafts ?? {}).length, decks: Object.keys(kv).filter((k) => k.startsWith('udeck:')).length,
      materials: d.materials?.length ?? 0, logs: d.logs?.length ?? 0, blobs: Object.keys(d.blobs ?? {}).length,
      settings: Object.keys(d.settings ?? {}).length,
    },
    hasApiKey: !!d.hasApiKey,
  };
}

const cardTime = (c: VocabCard) => Math.max(c.updatedAt ?? 0, c.lastReview ?? 0, c.addedAt ?? 0);
const deckTime = (d: unknown) => { const o = d as { updatedAt?: number; at?: number } | null; return o?.updatedAt ?? o?.at ?? 0; };

/**
 * Nhập sao lưu.
 * - merge: lượt làm bài, nhật ký theo id; thẻ trùng id hoặc trùng từ → giữ bản sửa/ôn gần hơn (gộp danh sách bộ);
 *   ghi chú, bản nháp → bản mới hơn; bộ từ theo id, không nhân đôi; cài đặt chỉ điền khoá còn thiếu.
 * - replace: xoá dữ liệu người học hiện có rồi ghi lại từ file.
 */
export async function importBackup(json: string | BackupFile, mode: 'merge' | 'replace' = 'merge') {
  const d = typeof json === 'string' ? parseBackup(json) : json;
  const s = getState();
  const { put, del, clear, set } = _low;

  if (mode === 'replace') {
    for (const st of ['attempts', 'vocab', 'notes', 'drafts', 'revlog', 'kv', 'dict'] as const) await clear(st);
    if (d.blobs) await clear('blobs');
    for (const m of Object.values(s.materials)) if (!m.builtin) await del('materials', m.id);
  }

  // Audio / ảnh trước, để tài liệu và bản ghi tham chiếu idb: dùng được ngay.
  for (const [k, v] of Object.entries(d.blobs ?? {})) {
    if (mode === 'merge' && (await _low.getBlob(k))) continue;
    try { await put('blobs', k, await fromB64(v)); } catch { /* bỏ file hỏng */ }
  }

  // Tài liệu tự nạp
  const mats = mode === 'replace' ? { ...Object.fromEntries(SAMPLE_MATERIALS.map((m) => [m.id, m])), ...Object.fromEntries(Object.entries(s.materials).filter(([, m]) => m.builtin)) } : { ...s.materials };
  set({ materials: mats });
  if (d.materials?.length) await saveMaterials(d.materials);

  // Mục đã xoá ở máy này hoặc máy kia (đồng bộ): không đưa vào, và xoá bản còn sót trên máy.
  const tombs: Record<string, number> = { ...(mode === 'replace' ? {} : (s.kv[TOMB] as Record<string, number> | undefined)) };
  for (const [k, t] of Object.entries((d.kv?.[TOMB] ?? {}) as Record<string, number>)) tombs[k] = Math.max(tombs[k] ?? 0, t);
  const dead = (k: string) => k in tombs;

  // Lượt làm bài
  const attempts = mode === 'replace' ? [] : s.attempts.filter((a) => !dead(`a:${a.id}`));
  for (const a of s.attempts) if (mode === 'merge' && dead(`a:${a.id}`)) await del('attempts', a.id);
  const aIds = new Set(attempts.map((a) => a.id));
  for (const a of d.attempts ?? []) if (!aIds.has(a.id) && !dead(`a:${a.id}`)) { attempts.push(a); aIds.add(a.id); await put('attempts', a.id, a); }
  attempts.sort((a, b) => b.at - a.at);

  // Nhật ký
  const logs = mode === 'replace' ? [] : [...s.logs];
  const lIds = new Set(logs.map((l) => l.id));
  for (const l of d.logs ?? []) if (!lIds.has(l.id)) { logs.push(l); lIds.add(l.id); await put('revlog', l.id, l); }
  logs.sort((a, b) => a.at - b.at);

  // Thẻ từ vựng
  const vocab: Record<string, VocabCard> = mode === 'replace' ? {} : { ...s.vocab };
  for (const id of Object.keys(vocab)) if (dead(`v:${id}`)) { delete vocab[id]; await del('vocab', id); }
  const byWord = new Map(Object.values(vocab).map((c) => [c.word.trim().toLowerCase(), c.id]));
  for (const raw of d.vocab ?? []) {
    const c = migrate(raw) ?? raw;
    if (dead(`v:${c.id}`)) continue;
    const hitId = vocab[c.id] ? c.id : byWord.get(c.word.trim().toLowerCase());
    const cur = hitId ? vocab[hitId] : undefined;
    let next: VocabCard;
    if (!cur) next = c;
    else {
      const newer = cardTime(c) > cardTime(cur) ? c : cur;
      const decks = [...new Set([...(cur.decks ?? []), ...(c.decks ?? [])])];
      next = { ...newer, id: cur.id, ...(decks.length ? { decks } : {}) };
      if (next === cur && decks.length === (cur.decks?.length ?? 0)) continue;
    }
    vocab[next.id] = next; byWord.set(next.word.trim().toLowerCase(), next.id);
    await put('vocab', next.id, next);
  }

  // Ghi chú
  const notes: Record<string, Note> = mode === 'replace' ? {} : { ...s.notes };
  for (const n of d.notes ?? []) {
    const cur = notes[n.materialId];
    if (cur && (cur.updatedAt ?? 0) >= (n.updatedAt ?? 0)) continue;
    notes[n.materialId] = n; await put('notes', n.materialId, n);
  }

  // kv: bộ từ, tiến độ nghe-chép, thời điểm bản nháp…
  const kv: Record<string, unknown> = mode === 'replace' ? {} : { ...s.kv };
  const inAt = (d.kv?.['meta:draftAt'] ?? {}) as Record<string, number>;
  const curAt = (kv['meta:draftAt'] ?? {}) as Record<string, number>;
  const putKv = (k: string, v: unknown) => (k.startsWith('dict:') ? put('dict', k.slice(5), v) : put('kv', k, v));
  for (const k of Object.keys(kv)) if (dead(`k:${k}`)) { delete kv[k]; await del('kv', k); }
  for (const [k, v] of Object.entries(d.kv ?? {})) {
    if (k === 'meta:draftAt' || k === TOMB || dead(`k:${k}`)) continue;
    if (k in kv) {
      if (!k.startsWith('udeck:')) continue; // giữ dữ liệu trên máy
      const cur = kv[k] as { words?: { w?: string; word?: string }[] };
      const inc = v as { words?: { w?: string; word?: string }[] };
      const keyOf = (x: { w?: string; word?: string }) => (x.word ?? x.w ?? JSON.stringify(x)).toLowerCase();
      const base = deckTime(inc) > deckTime(cur) ? inc : cur;
      const seen = new Set((base.words ?? []).map(keyOf));
      const words = [...(base.words ?? []), ...[...(cur.words ?? []), ...(inc.words ?? [])].filter((w) => { const kk = keyOf(w); if (seen.has(kk)) return false; seen.add(kk); return true; })];
      kv[k] = { ...base, words };
    } else kv[k] = v;
    await putKv(k, kv[k]);
  }

  // Bản nháp: giữ bản sửa gần hơn
  const drafts: Record<string, string> = mode === 'replace' ? {} : { ...s.drafts };
  const at = mode === 'replace' ? {} : { ...curAt };
  for (const [k, v] of Object.entries(d.drafts ?? {})) {
    if (k in drafts && drafts[k] && (at[k] ?? 0) >= (inAt[k] ?? 0)) continue;
    drafts[k] = v; at[k] = inAt[k] ?? Date.now();
    await put('drafts', k, v);
  }
  kv['meta:draftAt'] = at; await put('kv', 'meta:draftAt', at);
  if (Object.keys(tombs).length) { kv[TOMB] = tombs; await put('kv', TOMB, tombs); }

  set({ attempts, logs, vocab, notes, kv, drafts });

  // Cài đặt (localStorage): thay thế → ghi đè; gộp → chỉ điền khoá còn thiếu (API key: chỉ khi máy này chưa có).
  try {
    for (const [k, v] of Object.entries(d.settings ?? {})) {
      const cur = localStorage.getItem(k);
      if (k === AI_KEY && cur) {
        const o = JSON.parse(cur), inc = JSON.parse(v);
        const merged = mode === 'replace' ? { ...inc } : { ...inc, ...o };
        for (const f of SECRET_FIELDS) { // không bao giờ xoá key đang có trên máy
          const has = (x: unknown) => (typeof x === 'string' ? !!x : !!x && Object.values(x as object).some(Boolean));
          merged[f] = has(o[f]) ? (f === 'keys' ? { ...inc.keys, ...o.keys } : o[f]) : inc[f] ?? o[f];
        }
        localStorage.setItem(k, JSON.stringify(merged));
      } else if (mode === 'replace' || cur === null) localStorage.setItem(k, v);
    }
  } catch { /* bỏ qua */ }
  return summarize(d);
}
