// Tài khoản (email + mật khẩu) và đồng bộ dữ liệu học qua Supabase – gọi REST bằng fetch, không cần thư viện.
// - Trên mây: Storage `userdata/<uid>/state.json.gz` = bản sao lưu v2 (không kèm audio/ảnh, không kèm API key), nén gzip;
//   bảng `user_sync(user_id, updated_at, size, device)` để biết máy khác vừa đẩy bản mới chưa, khỏi tải cả file.
// - Trên máy: IndexedDB vẫn là bản làm việc (chạy được khi mất mạng). Đồng bộ = kéo bản mới hơn về → gộp (backup.ts,
//   giữ bản sửa gần hơn, "bia mộ" cho mục đã xoá) → đẩy lên nếu máy này có thay đổi chưa đẩy.
// - Quyền: RLS trên Supabase – mỗi người chỉ đọc/ghi được thư mục/hàng mang id của mình. Khoá publishable để công khai được.
import { useSyncExternalStore } from 'react';
import { _low, getState, subscribe } from '../db';
import { exportAll, importBackup, parseBackup } from './backup';

const BASE = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const KEY = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '');
export const cloudEnabled = !!(BASE && KEY);

// Không mang tiền tố `ielts:` → không lọt vào file sao lưu.
const SESS = 'sb:ieltsweb:session';
const META = 'sb:ieltsweb:sync';
const PUSH_DELAY = 8000;
const PULL_EVERY = 60_000;

export interface CloudUser { id: string; email: string }
interface Session { access_token: string; refresh_token: string; expires_at: number; user: CloudUser }
/** pulled: updated_at (ms) của bản trên mây đã gộp vào máy; dirty: lúc có thay đổi chưa đẩy (0 = không). */
interface Meta { uid?: string; pulled: number; dirty: number; last?: number }
export interface CloudState {
  user: CloudUser | null;
  status: 'idle' | 'syncing' | 'ok' | 'error' | 'offline';
  lastSync?: number; error?: string;
  /** Vừa bấm link "đặt lại mật khẩu" trong email → hiện form mật khẩu mới. */
  recovery?: boolean;
  /** Thông báo sau khi quay lại từ link trong email. */
  notice?: string;
}

// ---------- lưu trữ nhỏ ----------
const ls = {
  get<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : null; } catch { return null; } },
  set(k: string, v: unknown) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* bị chặn */ } },
};
let sess: Session | null = ls.get<Session>(SESS);
const meta = (): Meta => { const m = ls.get<Meta>(META); return m && m.uid === sess?.user.id ? m : { uid: sess?.user.id, pulled: 0, dirty: 0 }; };
const setMeta = (p: Partial<Meta>) => ls.set(META, { ...meta(), ...p, uid: sess?.user.id });

let cs: CloudState = { user: sess?.user ?? null, status: 'idle', lastSync: meta().last };
const subs = new Set<() => void>();
const setCs = (p: Partial<CloudState>) => { cs = { ...cs, ...p }; subs.forEach((f) => f()); };
export const getCloud = () => cs;
/** Đã chọn "Dùng không cần tài khoản" ở màn hình chào → không hiện lại màn hình đăng nhập. */
const GUEST = 'sb:ieltsweb:guest';
export const isGuest = () => { try { return localStorage.getItem(GUEST) === '1'; } catch { return true; } };
export const setGuest = (on: boolean) => { try { if (on) localStorage.setItem(GUEST, '1'); else localStorage.removeItem(GUEST); } catch { /* */ } setCs({}); };
export const useCloud = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => cs);
export const clearNotice = () => setCs({ notice: undefined, error: cs.status === 'error' ? cs.error : undefined });

// ---------- gọi API ----------
export class CloudError extends Error { constructor(msg: string, public status = 0) { super(msg); } }

const VI: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/invalid login credentials/i, 'Sai email hoặc mật khẩu.'],
  [/already (been )?registered|user_already_exists/i, 'Email này đã có tài khoản – hãy đăng nhập (hoặc bấm "Quên mật khẩu").'],
  [/password should be at least (\d+)/i, (m) => `Mật khẩu cần ít nhất ${m[1]} ký tự.`],
  [/weak.?password|password is known to be weak/i, 'Mật khẩu quá dễ đoán – hãy chọn mật khẩu khác.'],
  [/rate limit|too many/i, 'Thao tác quá nhiều lần, hãy thử lại sau ít phút.'],
  [/invalid format|validate email/i, 'Email không hợp lệ.'],
  [/email not confirmed/i, 'Email chưa được xác nhận – mở link trong hộp thư rồi đăng nhập lại.'],
  [/same.?password|different from the old/i, 'Mật khẩu mới phải khác mật khẩu cũ.'],
  [/signups? not allowed|signup.*disabled/i, 'Hiện chưa mở đăng ký tài khoản mới.'],
  [/jwt expired|invalid jwt|refresh token/i, 'Phiên đăng nhập đã hết hạn – hãy đăng nhập lại.'],
  [/payload too large|maximum allowed size/i, 'Dữ liệu quá lớn để đồng bộ (giới hạn 10 MB sau khi nén).'],
];
export const viError = (raw: string) => {
  for (const [re, out] of VI) { const m = raw.match(re); if (m) return typeof out === 'string' ? out : out(m); }
  return raw;
};
async function errOf(r: Response) {
  let raw = `${r.status} ${r.statusText}`;
  try { const j = await r.json(); raw = j.msg ?? j.message ?? j.error_description ?? j.error ?? raw; } catch { /* không phải JSON */ }
  return new CloudError(viError(String(raw)), r.status);
}

async function api(path: string, init: RequestInit & { auth?: boolean } = {}) {
  const h = new Headers(init.headers);
  h.set('apikey', KEY);
  if (init.auth) h.set('Authorization', `Bearer ${await token()}`);
  if (typeof init.body === 'string' && !h.has('Content-Type')) h.set('Content-Type', 'application/json');
  let r: Response;
  try { r = await fetch(BASE + path, { ...init, headers: h, cache: 'no-store' }); }
  catch { throw new CloudError('Không kết nối được máy chủ – kiểm tra mạng rồi thử lại.'); }
  if (!r.ok) throw await errOf(r);
  return r;
}

// ---------- phiên đăng nhập ----------
function jwtUser(t: string): CloudUser | null {
  try {
    const b = atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'));
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))));
    return p.sub ? { id: p.sub, email: p.email ?? '' } : null;
  } catch { return null; }
}
interface TokenRes { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; user?: { id: string; email?: string } }
function setSession(t: TokenRes | null) {
  const prev = sess?.user.id;
  if (t) {
    const user = t.user?.id ? { id: t.user.id, email: t.user.email ?? '' } : jwtUser(t.access_token);
    if (!user) throw new CloudError('Phản hồi đăng nhập không hợp lệ.');
    sess = { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at ?? Math.floor(Date.now() / 1000) + (t.expires_in || 3600), user };
  } else sess = null;
  ls.set(SESS, sess);
  if (sess?.user.id !== prev) setCs({ user: sess?.user ?? null, lastSync: meta().last, status: 'idle', error: undefined });
}

let refreshing: Promise<void> | null = null;
async function token(): Promise<string> {
  if (!sess) throw new CloudError('Chưa đăng nhập.');
  if (sess.expires_at - 60 > Date.now() / 1000) return sess.access_token;
  refreshing ??= (async () => {
    try {
      const r = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: sess!.refresh_token }) });
      setSession(await r.json());
    } catch (e) {
      // Mất mạng thì giữ phiên, lần sau thử lại; máy chủ từ chối (4xx) thì đăng xuất.
      if (e instanceof CloudError && e.status >= 400 && e.status < 500) { setSession(null); setCs({ status: 'error', error: 'Phiên đăng nhập đã hết hạn – hãy đăng nhập lại.' }); }
      throw e;
    } finally { refreshing = null; }
  })();
  await refreshing;
  return sess!.access_token;
}

const checkCreds = (email: string, password: string) => {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new CloudError('Email không hợp lệ.');
  if (password.length < 8) throw new CloudError('Mật khẩu cần ít nhất 8 ký tự.');
};

/** Đăng ký. Trả 'confirm' nếu Supabase còn bật xác nhận email (chưa có phiên). */
export async function signUp(email: string, password: string): Promise<'ok' | 'confirm'> {
  checkCreds(email, password);
  const r = await api(`/auth/v1/signup?redirect_to=${encodeURIComponent(siteUrl())}`, { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
  const j = await r.json();
  if (!j.access_token) return 'confirm';
  setSession(j); markLocalDirty(); syncNow();
  return 'ok';
}
export async function signIn(email: string, password: string) {
  if (!email.trim() || !password) throw new CloudError('Nhập email và mật khẩu.');
  const r = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
  setSession(await r.json()); markLocalDirty(); syncNow();
}
const siteUrl = () => location.origin + location.pathname;
export async function sendReset(email: string) {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new CloudError('Email không hợp lệ.');
  await api(`/auth/v1/recover?redirect_to=${encodeURIComponent(siteUrl())}`, { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
}
export async function updatePassword(password: string) {
  if (password.length < 8) throw new CloudError('Mật khẩu cần ít nhất 8 ký tự.');
  await api('/auth/v1/user', { method: 'PUT', auth: true, body: JSON.stringify({ password }) });
  setCs({ recovery: false });
}

/** Đăng xuất; `wipe` = xoá luôn dữ liệu học trên máy này (máy dùng chung). */
export async function signOut(wipe = false) {
  if (sess && meta().dirty) await syncNow().catch(() => {});
  if (sess) await api('/auth/v1/logout', { method: 'POST', auth: true }).catch(() => {});
  setSession(null); ls.set(META, null); setGuest(false);
  setCs({ status: 'idle', lastSync: undefined, error: undefined, recovery: false });
  if (wipe) {
    for (const st of ['attempts', 'vocab', 'notes', 'drafts', 'revlog', 'kv', 'dict', 'blobs', 'materials'] as const) await _low.clear(st).catch(() => {});
    try { for (const k of Object.keys(localStorage)) if (/^ielts[:-]/.test(k)) localStorage.removeItem(k); } catch { /* */ }
    location.hash = '#/'; location.reload();
  }
}

/**
 * Link trong email (đặt lại mật khẩu, xác nhận) quay về `…/#access_token=…&type=recovery`, đụng với HashRouter →
 * đọc token rồi chuyển sang `#/settings` trước khi app vẽ. Gọi một lần ở main.tsx.
 */
export function consumeAuthRedirect() {
  if (!cloudEnabled) return;
  const h = location.hash;
  if (!/^#(access_token|error)=/.test(h) && !/[#&]error_code=/.test(h)) return;
  const p = new URLSearchParams(h.slice(1));
  const go = () => history.replaceState(null, '', `${location.pathname}${location.search}#/settings`);
  if (p.get('error')) {
    const d = p.get('error_description') ?? p.get('error') ?? '';
    go(); setCs({ status: 'error', error: /expired|invalid/i.test(d) ? 'Link trong email đã hết hạn hoặc đã dùng – hãy gửi lại.' : viError(d) });
    return;
  }
  try {
    setSession({ access_token: p.get('access_token')!, refresh_token: p.get('refresh_token') ?? '', expires_in: +(p.get('expires_in') ?? 3600), expires_at: +(p.get('expires_at') ?? 0) || undefined });
    const type = p.get('type');
    setCs(type === 'recovery' ? { recovery: true } : { notice: 'Đã xác nhận email và đăng nhập.' });
    markLocalDirty();
  } catch (e) { setCs({ status: 'error', error: e instanceof Error ? e.message : String(e) }); }
  go();
}

// ---------- đồng bộ ----------
const objPath = () => `userdata/${sess!.user.id}/state.json.gz`;
const gzip = (s: string) => new Response(new Blob([s]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
const gunzip = (b: Blob) => new Response(b.stream().pipeThrough(new DecompressionStream('gzip'))).text();
const hasLocalData = () => { const s = getState(); return s.attempts.length + Object.keys(s.vocab).length + Object.keys(s.notes).length + Object.keys(s.drafts).length > 0 || Object.keys(s.kv).some((k) => k.startsWith('udeck:')); };
/** Máy chưa đồng bộ lần nào mà đã có dữ liệu (vừa đăng nhập): coi như có thay đổi chưa đẩy, để gộp lên mây. */
function markLocalDirty() { const m = meta(); if (!m.dirty && !m.pulled && !m.last && getState().ready && hasLocalData()) setMeta({ dirty: Date.now() }); }

function device() {
  const u = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(u) ? (/iPad/.test(u) ? 'iPad' : 'iPhone') : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'Máy khác';
  const br = /Edg\//.test(u) ? 'Edge' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /FxiOS|Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : '';
  return [os, br].filter(Boolean).join(' · ');
}

let applying = 0;
async function push() {
  const t0 = Date.now();
  const body = await gzip(await exportAll({}));
  await api(`/storage/v1/object/${objPath()}`, { method: 'POST', auth: true, headers: { 'x-upsert': 'true', 'Content-Type': 'application/gzip', 'cache-control': 'no-cache' }, body });
  const at = new Date().toISOString();
  await api('/rest/v1/user_sync?on_conflict=user_id', {
    method: 'POST', auth: true, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: sess!.user.id, updated_at: at, size: body.size, device: device() }),
  });
  const d = meta().dirty;
  setMeta({ pulled: Date.parse(at), dirty: d > t0 ? d : 0 });
}

async function syncOnce() {
  if (!sess || !getState().ready) return;
  if (!navigator.onLine) { setCs({ status: 'offline' }); return; }
  setCs({ status: 'syncing', error: undefined });
  try {
    const rows = await (await api(`/rest/v1/user_sync?select=updated_at&user_id=eq.${sess.user.id}`, { auth: true })).json() as { updated_at: string }[];
    const remote = rows[0] ? Date.parse(rows[0].updated_at) : 0;
    if (remote && remote > meta().pulled) {
      let blob: Blob | null = null;
      try { blob = await (await api(`/storage/v1/object/authenticated/${objPath()}`, { auth: true })).blob(); }
      catch (e) { if (!(e instanceof CloudError) || (e.status !== 400 && e.status !== 404)) throw e; }
      if (blob) {
        applying++;
        try { await importBackup(parseBackup(await gunzip(blob)), 'merge'); } finally { applying--; }
      }
      setMeta({ pulled: remote });
    }
    if (!remote || meta().dirty) await push();
    const last = Date.now();
    setMeta({ last }); setCs({ status: 'ok', lastSync: last });
  } catch (e) {
    if (!sess) return;
    setCs({ status: navigator.onLine ? 'error' : 'offline', error: e instanceof Error ? e.message : String(e) });
  }
}

let running: Promise<void> | null = null;
let again = false;
/** Đồng bộ ngay (gọi chồng nhau thì gộp lại thành một lượt chạy tiếp theo). */
export function syncNow(): Promise<void> {
  if (!cloudEnabled || !sess) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => { try { do { again = false; await syncOnce(); } while (again && sess); } finally { running = null; } })();
  return running;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;
/** Gọi một lần sau khi IndexedDB nạp xong: theo dõi thay đổi → đẩy lên sau vài giây; mở lại tab → kéo bản mới. */
export function startCloud() {
  if (!cloudEnabled || started) return;
  const go = () => {
    if (started || !getState().ready) return;
    started = true; unsub();
    let prev = getState();
    subscribe(() => {
      const s = getState();
      const changed = s.attempts !== prev.attempts || s.vocab !== prev.vocab || s.notes !== prev.notes || s.drafts !== prev.drafts || s.logs !== prev.logs || s.kv !== prev.kv;
      prev = s;
      if (!changed || applying || !sess) return;
      setMeta({ dirty: Date.now() });
      clearTimeout(timer); timer = setTimeout(syncNow, PUSH_DELAY);
    });
    document.addEventListener('visibilitychange', () => {
      if (!sess) return;
      if (document.visibilityState === 'hidden') { if (meta().dirty) { clearTimeout(timer); syncNow(); } }
      else if (Date.now() - (meta().last ?? 0) > PULL_EVERY) syncNow();
    });
    addEventListener('online', () => { if (sess) syncNow(); });
    if (sess) { markLocalDirty(); syncNow(); }
  };
  const unsub = subscribe(go);
  go();
}
