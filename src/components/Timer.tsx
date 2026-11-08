// Đồng hồ đếm ngược dùng chung.
// - autoStart: chạy ngay khi hiện (Thi thử). start: chạy khi chuyển sang true (Writing: từ chữ đầu tiên).
// - Còn `warnAt` giây → đổi màu + báo "Còn 5 phút". Hết giờ → onEnd (tự nộp); `overtime` thì đếm tiếp "+m:ss".
// - Bấm vào đồng hồ để tạm dừng / chạy tiếp. Reset theo bài: đặt `key={id}` ở chỗ dùng. Rời trang → tự dừng (unmount).
// Tính theo Date.now() nên không bị trôi khi tab chạy nền.
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Timer as TimerIcon } from 'lucide-react';

export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export interface TimerProps {
  /** Tổng thời gian (phút). */
  minutes: number;
  autoStart?: boolean;
  /** Chạy khi giá trị chuyển thành true (chỉ lần đầu). */
  start?: boolean;
  onEnd?: () => void;
  /** Báo sắp hết giờ (giây còn lại). Mặc định 5 phút; 0 = không báo. */
  warnAt?: number;
  /** Hết giờ vẫn đếm thêm (luyện tập). */
  overtime?: boolean;
  /** Đã nộp bài: dừng hẳn, không bấm được. */
  stopped?: boolean;
  /** Chữ nhỏ cạnh số, vd "Chuẩn bị". */
  label?: string;
  className?: string;
}

export default function Timer({ minutes, autoStart, start, onEnd, warnAt = 300, overtime, stopped, label, className }: TimerProps) {
  const total = minutes * 60 * 1000;
  const [since, setSince] = useState<number | null>(() => (autoStart && !stopped ? Date.now() : null));
  const [spent, setSpent] = useState(0); // ms đã chạy trước lần chạy hiện tại
  const [, tick] = useState(0);
  const [toast, setToast] = useState('');
  const ended = useRef(false);
  const warned = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const elapsed = spent + (since !== null ? Date.now() - since : 0);
  const left = Math.max(0, total - elapsed);
  const over = elapsed - total;
  const running = since !== null && !stopped;

  useEffect(() => { if (start && since === null && spent === 0 && !stopped) setSince(Date.now()); }, [start]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (stopped && since !== null) { setSpent((s) => s + Date.now() - since); setSince(null); }
  }, [stopped]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!running) return;
    if (warnAt > 0 && total > warnAt * 1000 && left <= warnAt * 1000 && left > 0 && !warned.current) {
      warned.current = true;
      setToast(`Còn ${Math.round(warnAt / 60)} phút`);
    }
    if (left === 0 && !ended.current) {
      ended.current = true;
      if (!overtime) { setSpent(total); setSince(null); }
      setToast(overtime ? 'Hết giờ – bạn vẫn có thể viết tiếp' : 'Hết giờ');
      onEndRef.current?.();
    }
  });
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(''), 5000); return () => window.clearTimeout(t); }, [toast]);

  const toggle = () => {
    if (stopped || (left === 0 && !overtime)) return;
    if (since === null) setSince(Date.now());
    else { setSpent(elapsed); setSince(null); }
  };
  const low = left > 0 && warnAt > 0 && left <= warnAt * 1000;
  const out = left === 0;
  const state = stopped ? 'Đã dừng' : running ? 'Đang chạy' : elapsed > 0 ? 'Tạm dừng' : 'Chưa chạy';
  const text = out ? (overtime && over > 0 ? `+${fmtClock(over / 1000)}` : 'Hết giờ') : fmtClock(Math.ceil(left / 1000));
  return (
    <span className="timer-wrap">
      <button
        type="button"
        className={`timer${running ? ' is-run' : elapsed > 0 && !out ? ' is-paused' : ''}${low ? ' is-low' : ''}${out ? ' is-out' : ''}${className ? ` ${className}` : ''}`}
        onClick={toggle}
        disabled={stopped}
        title={`${state} – bấm để ${running ? 'tạm dừng' : 'chạy'}`}
        aria-label={`Đồng hồ ${text}, ${state}`}
      >
        {running ? <Pause size={15} /> : elapsed > 0 && !out ? <Play size={15} /> : <TimerIcon size={15} />}
        {label && <small className="timer__label">{label}</small>}
        <span className="timer__num">{text}</span>
        {!running && !stopped && !out && <small className="timer__state">{elapsed > 0 ? 'Tạm dừng' : 'Chưa chạy'}</small>}
      </button>
      {toast && <span className="timer__toast" role="status">{toast}</span>}
    </span>
  );
}
