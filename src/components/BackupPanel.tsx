// Sao lưu / khôi phục (Cài đặt) + trạng thái "lưu lâu dài" + thanh nhắc sao lưu ở Trang chủ + mục "Giữ dữ liệu không bị mất".
import { useEffect, useState } from 'react';
import { AlertTriangle, Download, HardDrive, ShieldCheck, Upload, X } from 'lucide-react';
import { useDb } from '../db';
import { Link } from 'react-router-dom';
import { useCloud } from '../lib/cloud';
import { downloadBackup, importBackup, lastBackupAt, mediaSize, parseBackup, summarize, type BackupFile, type BackupSummary } from '../lib/backup';

const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const fmtDay = (t: number) => new Date(t).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function KeepDataTips() {
  return (
    <div className="keepdata" data-testid="keepdata">
      <h3 className="h4"><ShieldCheck size={16} /> Giữ dữ liệu không bị mất</h3>
      <ul className="small">
        <li>Chưa đăng nhập thì mọi kết quả, từ vựng, bài viết, bản ghi âm <strong>chỉ nằm trong trình duyệt này, trên máy này</strong>. <strong>Đăng nhập</strong> (mục Tài khoản ở trên) để tự đồng bộ lên mây – trừ bản ghi âm.</li>
        <li>Đừng học trong <strong>tab ẩn danh</strong>; bấm "Xoá dữ liệu trang web / cookie" cho trang này là <strong>mất hết</strong>.</li>
        <li>iPhone/iPad (Safari) có thể tự xoá dữ liệu của trang sau <strong>7 ngày không mở</strong> → bấm Chia sẻ → <em>Thêm vào MH chính</em> để mở như app, và vẫn nên sao lưu đều.</li>
        <li><strong>Mỗi tuần xuất sao lưu một lần</strong>, cất vào Google Drive hoặc Zalo "Cloud của tôi".</li>
        <li>Đổi máy / đổi trình duyệt: máy cũ <em>Xuất sao lưu</em> → máy mới <em>Nhập sao lưu</em> → chọn <strong>Gộp</strong>.</li>
      </ul>
    </div>
  );
}

function PersistStatus() {
  const [st, setSt] = useState<{ persisted: boolean | null; usage?: number; quota?: number }>({ persisted: null });
  const load = async () => {
    try {
      const persisted = (await navigator.storage?.persisted?.()) ?? null;
      const e = await navigator.storage?.estimate?.();
      setSt({ persisted, usage: e?.usage, quota: e?.quota });
    } catch { setSt({ persisted: null }); }
  };
  useEffect(() => { load(); }, []);
  const ask = async () => {
    const ok = await navigator.storage?.persist?.().catch(() => false);
    await load();
    if (!ok) alert('Trình duyệt chưa đồng ý "lưu lâu dài". Thường do trang chưa được dùng nhiều hoặc chưa cài lên màn hình chính – cứ sao lưu đều đặn là an toàn.');
  };
  return (
    <div className="persist row wrap" data-testid="persist">
      <HardDrive size={16} />
      <span className="small">Lưu lâu dài: {st.persisted === null ? <span className="muted">trình duyệt không hỗ trợ</span> : st.persisted ? <strong className="bk-ok">đã bật</strong> : <strong className="bk-warn">chưa bật</strong>}
        {st.usage !== undefined && <> · Đang dùng <strong>{fmtSize(st.usage)}</strong>{st.quota ? <span className="muted"> / {fmtSize(st.quota)}</span> : null}</>}
      </span>
      {st.persisted === false && <button className="btn btn--ghost btn--sm" onClick={ask}>Bật lưu lâu dài</button>}
    </div>
  );
}

export function BackupPanel() {
  const [media, setMedia] = useState(false);
  const [apiKey, setApiKey] = useState(false);
  const [size, setSize] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState<{ file: BackupFile; sum: BackupSummary } | null>(null);
  const [last, setLast] = useState(lastBackupAt());
  useEffect(() => { mediaSize().then(setSize).catch(() => setSize(0)); }, []);

  const doExport = async () => {
    setBusy(true);
    try { await downloadBackup({ media, apiKey }); setLast(lastBackupAt()); setMsg('Đã tải file sao lưu.'); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const pick = async (f: File) => {
    try { const file = parseBackup(await f.text()); setPending({ file, sum: summarize(file) }); setMsg(''); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };
  const run = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    if (mode === 'replace' && !confirm('Thay thế toàn bộ: xoá kết quả, từ vựng, ghi chú, bản nháp hiện có trên máy này rồi dùng dữ liệu trong file. Tiếp tục?')) return;
    setBusy(true);
    try { await importBackup(pending.file, mode); setMsg(`Đã ${mode === 'merge' ? 'gộp' : 'thay thế'} dữ liệu từ bản sao lưu.${pending.sum.counts.settings ? ' Tải lại trang để áp dụng cài đặt.' : ''}`); setPending(null); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const c = pending?.sum.counts;

  return (
    <div className="setting setting--col" data-testid="backup">
      <div className="setting__title"><strong>Sao lưu</strong>{last ? <span className="small muted">Lần cuối: {fmtDay(last)}</span> : <span className="small bk-warn">Chưa sao lưu lần nào</span>}</div>
      <p className="small muted">File gồm: kết quả và bài làm, từ vựng + tiến độ ôn, bộ từ, ghi chú, bản nháp, tiến độ nghe-chép, tài liệu tự nạp và cài đặt.</p>
      <label className="row small"><input type="checkbox" checked={media} onChange={(e) => setMedia(e.target.checked)} data-testid="bk-media" /> Kèm bản ghi âm Speaking và audio/ảnh đã nạp{size !== null && <span className="muted"> (≈ {size ? fmtSize(size * 1.37) : '0 KB'} thêm)</span>}</label>
      <label className="row small"><input type="checkbox" checked={apiKey} onChange={(e) => setApiKey(e.target.checked)} /> Kèm API key (không khuyến khích – ai có file là dùng được key)</label>
      <div className="row wrap">
        <button className="btn btn--primary btn--sm" disabled={busy} onClick={doExport} data-testid="bk-export"><Download size={15} /> Xuất sao lưu</button>
        <label className="btn btn--ghost btn--sm"><Upload size={15} /> Nhập sao lưu<input type="file" accept=".json,application/json" hidden data-testid="bk-file" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} /></label>
        {msg && <span className="small" data-testid="bk-msg">{msg}</span>}
      </div>
      {pending && c && (
        <div className="bk-sum" data-testid="bk-sum">
          <div className="row-between"><strong>Bản sao lưu {pending.sum.exportedAt ? `ngày ${fmtDay(Date.parse(pending.sum.exportedAt))}` : ''} (v{pending.sum.version})</strong><button className="icon-btn" aria-label="Huỷ" onClick={() => setPending(null)}><X size={16} /></button></div>
          <ul className="small bk-sum__list">
            <li><strong>{c.attempts}</strong> lượt làm bài</li><li><strong>{c.vocab}</strong> thẻ từ</li><li><strong>{c.decks}</strong> bộ từ tự tạo</li>
            <li><strong>{c.notes}</strong> ghi chú</li><li><strong>{c.drafts}</strong> bản nháp</li><li><strong>{c.materials}</strong> tài liệu tự nạp</li>
            {c.blobs > 0 && <li><strong>{c.blobs}</strong> file audio/ảnh</li>}{c.settings > 0 && <li>cài đặt</li>}
          </ul>
          {pending.sum.hasApiKey && <p className="small bk-warn"><AlertTriangle size={14} /> File có kèm API key.</p>}
          <div className="row wrap">
            <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => run('merge')} data-testid="bk-merge">Gộp</button>
            <button className="btn btn--danger btn--sm" disabled={busy} onClick={() => run('replace')} data-testid="bk-replace">Thay thế toàn bộ</button>
          </div>
          <p className="small muted"><strong>Gộp</strong>: giữ dữ liệu trên máy, thêm phần còn thiếu, chỗ trùng giữ bản mới hơn. <strong>Thay thế</strong>: xoá dữ liệu trên máy rồi dùng file.</p>
        </div>
      )}
      <PersistStatus />
      <KeepDataTips />
    </div>
  );
}

const SNOOZE = 'ielts:backup-snooze';
/** Thanh nhắc ở Trang chủ: có dữ liệu và ≥ 7 ngày chưa sao lưu. */
export function BackupReminder() {
  const db = useDb();
  const cloud = useCloud();
  const [hide, setHide] = useState(false);
  if (!db.ready || hide) return null;
  if (cloud.user && cloud.lastSync && Date.now() - cloud.lastSync < 7 * 864e5) return null; // đã đồng bộ lên mây
  const n = db.attempts.length + Object.keys(db.vocab).length;
  if (!n) return null;
  const oldest = Math.min(db.attempts.at(-1)?.at ?? Infinity, ...Object.values(db.vocab).map((c) => c.addedAt || Infinity));
  const since = lastBackupAt() || oldest;
  let snooze = 0; try { snooze = +(localStorage.getItem(SNOOZE) ?? 0) || 0; } catch { /* */ }
  const now = Date.now();
  if (now - since < 7 * 864e5 || now < snooze) return null;
  const days = Math.floor((now - since) / 864e5);
  return (
    <div className="bk-remind" role="status" data-testid="bk-remind">
      <ShieldCheck size={18} />
      <span className="small">{lastBackupAt() ? `Đã ${days} ngày chưa sao lưu.` : 'Bạn chưa sao lưu lần nào.'} Dữ liệu chỉ nằm trong trình duyệt này – tải file về{cloud.user ? '' : <> hoặc <Link to="/settings">đăng nhập để tự đồng bộ</Link></>} để không mất.</span>
      <button className="btn btn--primary btn--sm" onClick={async () => { await downloadBackup(); setHide(true); }}><Download size={15} /> Sao lưu ngay</button>
      <button className="btn btn--text btn--sm" onClick={() => { try { localStorage.setItem(SNOOZE, String(now + 3 * 864e5)); } catch { /* */ } setHide(true); }}>Nhắc sau</button>
    </div>
  );
}
