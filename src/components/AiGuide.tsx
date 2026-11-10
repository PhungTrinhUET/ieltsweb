// Phần hướng dẫn cài AI dùng chung cho Cài đặt → AI và Cẩm nang.
import { Link } from 'react-router-dom';
import { Bot, ExternalLink, ShieldAlert } from 'lucide-react';
import { COMPARE, KEY_NOTES, KEY_STEPS, METHODS, QUICK_PICK, SOURCES, UPDATED, type MethodId } from '../ai/setup';

export function QuickPick() {
  return <p className="aiw-quick small"><strong>Chọn nhanh:</strong> {QUICK_PICK}</p>;
}

/** Các bước lấy key của một cách dùng + lưu ý chung. */
export function KeySteps({ method }: { method: MethodId }) {
  const g = KEY_STEPS[method];
  return (
    <div className="aiw-steps" data-testid="aiw-steps">
      <ol>{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      {g.url && <p className="small"><a href={g.url} target="_blank" rel="noreferrer">Mở {g.urlLabel} <ExternalLink size={12} /></a>{g.prefix && <> · key dạng <code>{g.prefix}</code></>}</p>}
      {g.notes?.map((n, i) => <p key={i} className="small muted">{n}</p>)}
      {method !== 'proxy' && method !== 'custom' && (
        <ul className="aiw-notes small"><ShieldAlert size={16} aria-hidden />{KEY_NOTES.map((n) => <li key={n}>{n}</li>)}</ul>
      )}
    </div>
  );
}

export function CompareTable() {
  return (
    <div className="aiw-compare" data-testid="aiw-compare">
      <p className="small muted">Cập nhật {UPDATED} – giá và hạn mức thay đổi thường xuyên, xem trang chính thức. Giá USD / 1 triệu token vào / ra; “1 bài” ≈ 3000 token vào + 2500 token ra (chưa tính token suy luận).</p>
      <div className="table-wrap">
        <table className="table aiw-table">
          <thead><tr><th>Cách</th><th>Miễn phí</th><th>Trả phí</th><th>~1 bài chấm</th></tr></thead>
          <tbody>{COMPARE.map((r) => (
            <tr key={r.name}>
              <td><strong>{r.name}</strong>{r.url && <> <a href={r.url} target="_blank" rel="noreferrer" aria-label={`Trang giá ${r.name}`}><ExternalLink size={12} /></a></>}</td>
              <td>{r.free}</td><td>{r.paid}</td><td>{r.essay}{r.note && <div className="small muted">{r.note}</div>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="small muted">Nguồn: {SOURCES.map(([l, u], i) => <span key={u}>{i > 0 && ' · '}<a href={u} target="_blank" rel="noreferrer">{l}</a></span>)}</p>
    </div>
  );
}

/** Bản tĩnh cho Cẩm nang: các cách + bước lấy key + bảng so sánh. */
export function AiSetupGuide() {
  return (
    <div className="stack">
      <p>App không kèm AI sẵn: bạn chọn một cách dưới đây rồi dán key ở <Link to="/settings?ai=1">Cài đặt → AI</Link> (mất khoảng 3 phút).</p>
      <QuickPick />
      {METHODS.map((m) => (
        <details key={m.id} className="aiw-guide">
          <summary><strong>{m.title}</strong> <span className={`aiw-tag${m.free ? ' is-free' : ''}`}>{m.tag}</span></summary>
          <p className="small">{m.desc}</p>
          <KeySteps method={m.id} />
        </details>
      ))}
      <CompareTable />
    </div>
  );
}

/** Dòng nhắc ở Writing/Speaking khi chưa cài AI. */
export function AiMissing() {
  return (
    <Link to="/settings?ai=1" className="ai-missing small" data-testid="ai-missing">
      <Bot size={16} /> Chưa cài AI chấm bài – xem hướng dẫn 3 phút →
    </Link>
  );
}
