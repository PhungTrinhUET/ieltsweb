import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

/** Hiển thị văn bản giải thích: in đậm **x**, xuống dòng trước "1. ", "Giải thích:", "Dịch:"... */
export function RichText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const lines = text
    .replace(/\s+(?=(?:\d{1,2})\.\s+\S)/g, '\n')
    .replace(/\s+(?=(?:Giải thích|Dịch|Đáp án|Ví dụ|Mẹo|Lưu ý|Công thức):)/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <div className={`rich ${className ?? ''}`}>
      {lines.map((l, i) => (
        <p key={i}>{bold(l)}</p>
      ))}
    </div>
  );
}

/** Markdown inline tối giản: **đậm** và *nghiêng*. */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((seg, i) =>
        seg.startsWith('**') && seg.endsWith('**') && seg.length > 4 ? <strong key={i}>{seg.slice(2, -2)}</strong>
          : seg.startsWith('*') && seg.endsWith('*') && seg.length > 2 ? <em key={i}>{seg.slice(1, -1)}</em>
            : seg,
      )}
    </>
  );
}

function bold(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
    seg.startsWith('**') && seg.endsWith('**') ? <strong key={i}>{seg.slice(2, -2)}</strong> : seg,
  );
}

export function Collapse({ title, icon, children, defaultOpen = false, tone }: {
  title: string; icon?: ReactNode; children: ReactNode; defaultOpen?: boolean; tone?: 'tip' | 'info';
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`collapse${open ? ' is-open' : ''}${tone ? ` collapse--${tone}` : ''}`}>
      <button className="collapse__head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {icon}
        <span>{title}</span>
        <ChevronDown size={18} className="collapse__chev" />
      </button>
      {open && <div className="collapse__body">{children}</div>}
    </div>
  );
}

const LETTERS = 'ABCDEFGHIJKL';

export function Options({ options, value, onChange, checked, correct, name }: {
  options: string[]; value: number | null; onChange: (i: number) => void;
  checked: boolean; correct: number; name?: string;
}) {
  return (
    <div className="options" role="radiogroup" aria-label={name}>
      {options.map((o, i) => {
        let state = '';
        if (checked) {
          if (i === correct) state = ' is-correct';
          else if (i === value) state = ' is-wrong';
          else state = ' is-dim';
        } else if (i === value) state = ' is-selected';
        return (
          <button key={i} className={`option${state}`} onClick={() => !checked && onChange(i)} role="radio" aria-checked={i === value} disabled={checked && i !== correct && i !== value}>
            <span className="option__letter">{LETTERS[i]}</span>
            <span className="option__text">{o === '-' ? '— (không cần từ)' : o}</span>
            {checked && i === correct && <Check size={18} className="option__icon" />}
            {checked && i === value && i !== correct && <X size={18} className="option__icon" />}
          </button>
        );
      })}
    </div>
  );
}

/** Ô chọn dạng dropdown dùng cho các bài ghép. value = chỉ số trong options. */
export function Pick({ options, value, onChange, checked, correct, placeholder = 'Chọn…', inline }: {
  options: string[]; value: number | null; onChange: (i: number | null) => void;
  checked: boolean; correct: number; placeholder?: string; inline?: boolean;
}) {
  const state = checked ? (value === correct ? ' is-correct' : ' is-wrong') : value !== null ? ' is-filled' : '';
  return (
    <span className={`pick${inline ? ' pick--inline' : ''}${state}`}>
      <span className="pick__box">
        <select
          value={value ?? ''}
          disabled={checked}
          onChange={(e) => onChange(e.target.value === '' ? null : +e.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((o, i) => (
            <option key={i} value={i}>{o}</option>
          ))}
        </select>
        <ChevronDown size={16} className="pick__chev" />
      </span>
      {checked && value !== correct && <span className="pick__fix"><Check size={14} /> {options[correct]}</span>}
    </span>
  );
}

export function Segmented<T extends string>({ options, value, onChange, checked, correct }: {
  options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; checked: boolean; correct: T;
}) {
  return (
    <div className="seg">
      {options.map((o) => {
        let st = '';
        if (checked) st = o.value === correct ? ' is-correct' : o.value === value ? ' is-wrong' : ' is-dim';
        else if (o.value === value) st = ' is-selected';
        return (
          <button key={o.value} className={`seg__btn${st}`} onClick={() => !checked && onChange(o.value)} aria-pressed={o.value === value}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Ring({ value, size = 56, stroke = 6, color = 'var(--primary)', children }: {
  value: number; size?: number; stroke?: number; color?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .5s ease' }}
        />
      </svg>
      <div className="ring__label">{children}</div>
    </div>
  );
}

export function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="bar">
      <div className="bar__fill" style={{ width: `${Math.round(Math.min(1, value) * 100)}%`, background: color }} />
    </div>
  );
}

/**
 * Dropdown tự vẽ (thay cho <select> của trình duyệt) để chọn được hướng xổ:
 * `prefer="up"` xổ lên trên – không che nội dung bên dưới; tự đổi hướng nếu không đủ chỗ.
 */
export function PickMenu({ options, value, onChange, checked, correct, placeholder = 'Chọn…', prefer = 'up', marked }: {
  options: string[]; value: number | null; onChange: (i: number | null) => void;
  checked: boolean; correct: number; placeholder?: string; prefer?: 'up' | 'down';
  /** Các lựa chọn đã dùng ở chỗ khác – hiển thị mờ kèm ghi chú. */
  marked?: Set<number>;
}) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<'up' | 'down'>(prefer);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', out);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = () => {
    if (checked) return;
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const need = Math.min(options.length * 46 + 60, 340);
      const above = r.top - 72; // chừa chỗ cho thanh tiêu đề dính trên đầu
      const below = window.innerHeight - r.bottom - 72;
      setDir(prefer === 'up' ? (above >= need || above > below ? 'up' : 'down') : (below >= need || below > above ? 'down' : 'up'));
    }
    setOpen((o) => !o);
  };
  const choose = (i: number | null) => { onChange(i); setOpen(false); };

  const state = checked ? (value === correct ? ' is-correct' : ' is-wrong') : value !== null ? ' is-filled' : '';
  return (
    <div className={`pick pmenu${state}`} ref={ref}>
      <button type="button" className="pmenu__btn" onClick={toggle} disabled={checked} aria-haspopup="listbox" aria-expanded={open}>
        <span className={value === null ? 'pmenu__ph' : ''}>{value === null ? placeholder : options[value]}</span>
        {!checked && <ChevronDown size={16} className={`pmenu__chev${open && dir === 'up' ? ' is-up' : ''}`} />}
      </button>
      {open && (
        <ul className={`pmenu__list is-${dir}`} role="listbox">
          {value !== null && (
            <li><button type="button" className="pmenu__opt pmenu__opt--clear" onClick={() => choose(null)}>Bỏ chọn</button></li>
          )}
          {options.map((o, i) => (
            <li key={i}>
              <button type="button" role="option" aria-selected={i === value} className={`pmenu__opt${i === value ? ' is-on' : ''}${marked?.has(i) && i !== value ? ' is-marked' : ''}`} onClick={() => choose(i)}>
                <span>{o}</span>
                {i === value ? <Check size={15} /> : marked?.has(i) ? <small>đã chọn</small> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {checked && value !== correct && <span className="pick__fix"><Check size={14} /> {options[correct]}</span>}
    </div>
  );
}

/**
 * Phím Tab / Shift+Tab để nhảy câu (hoặc part): trả về +1 / -1, hoặc 0 nếu không xử lý –
 * khi có tổ hợp Ctrl/Alt/Cmd, đang gõ chữ (ô nhập, textarea) hoặc đang mở popup.
 */
export function tabStep(e: KeyboardEvent): -1 | 0 | 1 {
  if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return 0;
  const el = e.target as HTMLElement | null;
  const typing = el?.tagName === 'TEXTAREA' || (el?.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'range') || el?.isContentEditable;
  if (typing || document.querySelector('[aria-modal="true"]')) return 0;
  return e.shiftKey ? -1 : 1;
}
