import { useEffect, useState } from 'react';
import { Pause, Timer as TimerIcon } from 'lucide-react';

/** Đồng hồ đếm ngược: bấm để chạy/dừng; hết giờ gọi onEnd. */
export default function Timer({ minutes, onEnd, stopped }: { minutes: number; onEnd?: () => void; stopped?: boolean }) {
  const [left, setLeft] = useState(minutes * 60);
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (!run || stopped) return;
    const id = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => window.clearInterval(id);
  }, [run, stopped]);
  useEffect(() => {
    if (left === 0 && run) {
      setRun(false);
      onEnd?.();
    }
  }, [left]);
  const toggle = () => {
    if (stopped) return;
    if (left === 0) setLeft(minutes * 60);
    setRun((r) => !r);
  };
  const label = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <button className={`timer${run ? ' is-run' : ''}${left === 0 ? ' is-out' : ''}`} onClick={toggle} title="Bấm giờ theo thời gian gợi ý">
      {run ? <Pause size={15} /> : <TimerIcon size={15} />} {left === 0 ? 'Hết giờ' : label}
    </button>
  );
}
