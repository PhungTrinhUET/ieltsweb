import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Hàng chip cuộn ngang: mờ dần ở mép còn nội dung, nút mũi tên (desktop) để cuộn. */
export default function ScrollRow({ children, className = 'tabs', label }: { children: ReactNode; className?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const upd = () => setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    upd();
    el.addEventListener('scroll', upd, { passive: true });
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => { el.removeEventListener('scroll', upd); ro.disconnect(); };
  }, [children]);
  const by = (d: number) => ref.current?.scrollBy({ left: d * Math.max(160, (ref.current?.clientWidth ?? 300) * 0.7), behavior: 'smooth' });
  return (
    <div className={`srow${edge.l ? ' srow--l' : ''}${edge.r ? ' srow--r' : ''}`}>
      {edge.l && <button type="button" className="srow__btn srow__btn--l" aria-label="Cuộn trái" onClick={() => by(-1)}><ChevronLeft size={16} /></button>}
      <div ref={ref} className={className} role="tablist" aria-label={label}>{children}</div>
      {edge.r && <button type="button" className="srow__btn srow__btn--r" aria-label="Cuộn phải" onClick={() => by(1)}><ChevronRight size={16} /></button>}
    </div>
  );
}
