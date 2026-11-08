// Ảnh bấm để phóng to (bản đồ, sơ đồ, biểu đồ). Esc / bấm nền để đóng.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn } from 'lucide-react';

export default function ZoomImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);
  return (
    <>
      <button type="button" className={`zoomimg${className ? ` ${className}` : ''}`} onClick={() => setOpen(true)} title="Bấm để phóng to">
        <img src={src} alt={alt} loading="lazy" />
        <span className="zoomimg__hint"><ZoomIn size={14} /> Phóng to</span>
      </button>
      {open && createPortal(
        <div className="zoombox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
          <button type="button" className="zoombox__close" aria-label="Đóng" onClick={() => setOpen(false)}><X size={20} /></button>
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
        </div>,
        document.body,
      )}
    </>
  );
}

/** Đường dẫn ảnh tĩnh trong public/ (img/…) → URL theo BASE_URL; URL tuyệt đối giữ nguyên. */
export const publicUrl = (p: string) => (/^(https?:|data:|blob:|\/)/.test(p) ? p : import.meta.env.BASE_URL + p);
