// Cài đặt → Tài khoản & đồng bộ: đăng ký / đăng nhập email + mật khẩu, quên mật khẩu, đồng bộ, đăng xuất.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, CloudOff, Eye, EyeOff, Loader2, LogOut, RefreshCw, UserRound } from 'lucide-react';
import { clearNotice, cloudEnabled, sendReset, signIn, signOut, signUp, syncNow, updatePassword, useCloud } from '../lib/cloud';

const fmtTime = (t: number) => {
  const d = new Date(t), today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString('vi-VN', today ? { hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
};

function Pw({ value, onChange, auto, label = 'Mật khẩu', testid }: { value: string; onChange: (v: string) => void; auto: string; label?: string; testid?: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="small acc__f">{label}
      <span className="acc__pw">
        <input className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={auto} minLength={8} required data-testid={testid} />
        <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
      </span>
    </label>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (f: () => Promise<string | void>) => async (e?: FormEvent) => {
    e?.preventDefault(); setBusy(true); setMsg(null);
    try { const t = await f(); if (t) setMsg({ ok: true, text: t }); } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) }); }
    setBusy(false);
  };
  return { busy, msg, setMsg, run };
}
const Msg = ({ m }: { m: { ok: boolean; text: string } | null }) => (m ? <p className={`small ${m.ok ? 'ok-text' : 'no-text'}`} role="status" data-testid="acc-msg">{m.text}</p> : null);

export function LoginForm() {
  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const { busy, msg, setMsg, run } = useAction();
  const submit = run(async () => {
    if (mode === 'forgot') { await sendReset(email); return 'Đã gửi email đặt lại mật khẩu (nếu email có tài khoản). Mở link trong thư trên máy này. Không thấy thì xem mục Spam.'; }
    if (mode === 'up') {
      if (pw !== pw2) throw new Error('Hai mật khẩu không khớp.');
      return (await signUp(email, pw)) === 'confirm' ? 'Đã tạo tài khoản. Mở link xác nhận trong email rồi quay lại đăng nhập.' : undefined;
    }
    await signIn(email, pw);
  });
  const tab = (m: typeof mode, label: string) => <button type="button" className={`seg__btn${mode === m ? ' is-selected' : ''}`} onClick={() => { setMode(m); setMsg(null); }} data-testid={`acc-tab-${m}`}>{label}</button>;
  return (
    <form className="acc__form" onSubmit={submit} data-testid="acc-login">
      {mode !== 'forgot' && <div className="seg">{tab('in', 'Đăng nhập')}{tab('up', 'Tạo tài khoản')}</div>}
      {mode === 'forgot' && <p className="small"><strong>Quên mật khẩu</strong> – nhập email đã đăng ký, app gửi link đặt mật khẩu mới.</p>}
      <label className="small acc__f">Email<input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required data-testid="acc-email" /></label>
      {mode !== 'forgot' && <Pw value={pw} onChange={setPw} auto={mode === 'up' ? 'new-password' : 'current-password'} testid="acc-pw" />}
      {mode === 'up' && <Pw value={pw2} onChange={setPw2} auto="new-password" label="Nhập lại mật khẩu" testid="acc-pw2" />}
      <div className="row wrap">
        <button className="btn btn--primary btn--sm" disabled={busy} data-testid="acc-submit">
          {busy && <Loader2 size={15} className="spin" />} {mode === 'in' ? 'Đăng nhập' : mode === 'up' ? 'Tạo tài khoản' : 'Gửi email'}
        </button>
        {mode === 'in' && <button type="button" className="btn btn--text btn--sm" onClick={() => { setMode('forgot'); setMsg(null); }} data-testid="acc-forgot">Quên mật khẩu?</button>}
        {mode === 'forgot' && <button type="button" className="btn btn--text btn--sm" onClick={() => { setMode('in'); setMsg(null); }}>Quay lại đăng nhập</button>}
      </div>
      <Msg m={msg} />
    </form>
  );
}

function NewPassword({ onDone, cancel }: { onDone?: () => void; cancel?: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const { busy, msg, run } = useAction();
  const submit = run(async () => { if (pw !== pw2) throw new Error('Hai mật khẩu không khớp.'); await updatePassword(pw); setPw(''); setPw2(''); onDone?.(); return 'Đã đổi mật khẩu.'; });
  return (
    <form className="acc__form" onSubmit={submit} data-testid="acc-newpw">
      <Pw value={pw} onChange={setPw} auto="new-password" label="Mật khẩu mới" testid="acc-newpw1" />
      <Pw value={pw2} onChange={setPw2} auto="new-password" label="Nhập lại mật khẩu mới" testid="acc-newpw2" />
      <div className="row wrap">
        <button className="btn btn--primary btn--sm" disabled={busy} data-testid="acc-newpw-save">{busy && <Loader2 size={15} className="spin" />} Lưu mật khẩu</button>
        {cancel && <button type="button" className="btn btn--text btn--sm" onClick={cancel}>Huỷ</button>}
      </div>
      <Msg m={msg} />
    </form>
  );
}

export function SyncBadge() {
  const c = useCloud();
  if (c.status === 'syncing') return <span className="small muted acc__st"><Loader2 size={14} className="spin" /> Đang đồng bộ…</span>;
  if (c.status === 'offline') return <span className="small muted acc__st"><CloudOff size={14} /> Mất mạng – sẽ đồng bộ khi có mạng lại</span>;
  if (c.status === 'error') return <span className="small no-text acc__st"><AlertTriangle size={14} /> {c.error}</span>;
  return c.lastSync ? <span className="small ok-text acc__st" data-testid="acc-synced"><Check size={14} /> Đã đồng bộ lúc {fmtTime(c.lastSync)}</span> : null;
}

export default function CloudPanel() {
  const c = useCloud();
  const [out, setOut] = useState(false);
  const [chg, setChg] = useState(false);
  if (!cloudEnabled) return null;
  return (
    <section className="card settings" id="account" data-testid="account">
      <div className="setting setting--col">
        <div className="setting__title"><UserRound size={18} /> <strong>Tài khoản & đồng bộ</strong></div>
        {c.notice && <p className="small ok-text" role="status"><Check size={14} /> {c.notice} <button className="btn btn--text btn--sm" onClick={clearNotice}>Ẩn</button></p>}
        {!c.user ? (
          <>
            <p className="small muted">Đang dùng không cần tài khoản – dữ liệu chỉ ở trình duyệt này. Đăng nhập để <strong>tự đồng bộ giữa các máy</strong> và không mất khi xoá dữ liệu trình duyệt.</p>
            {c.status === 'error' && c.error && <p className="small no-text"><AlertTriangle size={14} /> {c.error}</p>}
            <div className="row wrap"><Link className="btn btn--primary btn--sm" to="/login?next=%2Fsettings" data-testid="acc-go-login"><UserRound size={15} /> Đăng nhập / Tạo tài khoản</Link></div>
          </>
        ) : c.recovery ? (
          <>
            <p className="small">Đặt mật khẩu mới cho <strong>{c.user.email}</strong>:</p>
            <NewPassword />
          </>
        ) : (
          <>
            <div className="row wrap acc__who">
              <span className="small">Đang đăng nhập: <strong data-testid="acc-email-on">{c.user.email}</strong></span>
              <SyncBadge />
            </div>
            <div className="row wrap">
              <button className="btn btn--ghost btn--sm" onClick={() => syncNow()} disabled={c.status === 'syncing'} data-testid="acc-sync"><RefreshCw size={15} /> Đồng bộ ngay</button>
              <button className="btn btn--ghost btn--sm" onClick={() => setChg(!chg)}>Đổi mật khẩu</button>
              <button className="btn btn--ghost btn--sm" onClick={() => setOut(!out)} data-testid="acc-logout"><LogOut size={15} /> Đăng xuất</button>
            </div>
            {chg && <NewPassword onDone={() => setTimeout(() => setChg(false), 1500)} cancel={() => setChg(false)} />}
            {out && (
              <div className="acc__out" data-testid="acc-out">
                <p className="small">Đăng xuất xong, dữ liệu trên mây vẫn còn; đăng nhập lại là có.</p>
                <div className="row wrap">
                  <button className="btn btn--ghost btn--sm" onClick={() => { setOut(false); signOut(false); }} data-testid="acc-out-keep">Đăng xuất, giữ dữ liệu trên máy</button>
                  <button className="btn btn--danger btn--sm" onClick={() => confirm('Xoá toàn bộ dữ liệu học trên trình duyệt này (bản trên mây vẫn giữ)?') && signOut(true)} data-testid="acc-out-wipe">Đăng xuất và xoá dữ liệu trên máy này</button>
                  <button className="btn btn--text btn--sm" onClick={() => setOut(false)}>Huỷ</button>
                </div>
                <p className="small muted">Máy dùng chung (quán net, máy mượn) thì chọn xoá.</p>
              </div>
            )}
            <p className="small muted">Đồng bộ tự động vài giây sau mỗi thay đổi và khi mở lại app. Không đồng bộ: bản ghi âm Speaking, audio/ảnh tự tải lên, API key AI.</p>
          </>
        )}
      </div>
    </section>
  );
}
