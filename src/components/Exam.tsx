// Khung giao diện mô phỏng màn hình thi IELTS trên máy tính:
// thanh trên (số báo danh, đồng hồ "N minutes left", Help / Hide / Options), khung "Part N" hướng dẫn,
// thân bài (chia đôi kéo được), thanh điều hướng dưới (Part + số câu, Review, ← →, nộp bài ✓).
// Chữ trên khung giữ tiếng Anh như máy thi thật; phần riêng của app (thoát, công cụ luyện tập) tiếng Việt.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp, EyeOff, Menu, Volume2, Wifi, X } from 'lucide-react';
import type { Question, QuestionGroup } from '../types';
import type { Answers } from './Questions';

/** Câu đang hiển thị trong khung thi: dùng cho nút radio/ô điền kiểu máy thi. */
export const ExamCtx = createContext(false);
export const useExamStyle = () => useContext(ExamCtx);

// ---------- Tuỳ chọn hiển thị (Options) ----------
type Size = 'standard' | 'large' | 'xlarge';
type Contrast = 'bw' | 'wb' | 'yb';
interface Prefs { size: Size; contrast: Contrast; volume: number }
const PREF_KEY = 'ielts:exam-prefs';
function readPrefs(): Prefs {
  try { return { size: 'standard', contrast: 'bw', volume: 0.9, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') }; } catch { return { size: 'standard', contrast: 'bw', volume: 0.9 }; }
}
let prefs = readPrefs();
const subs = new Set<() => void>();
export function setExamPrefs(p: Partial<Prefs>) {
  prefs = { ...prefs, ...p };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}
export function useExamPrefs() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return prefs;
}

/** Số báo danh giả, cố định theo máy. */
function candidateNo() {
  try {
    let v = localStorage.getItem('ielts:candidate');
    if (!v) { v = `${Math.floor(10000 + Math.random() * 89999)}-${Math.floor(100000 + Math.random() * 899999)}`; localStorage.setItem('ielts:candidate', v); }
    return v;
  } catch { return '00000-000000'; }
}

/** Các số câu mà một câu hỏi chiếm (câu `multi` Choose TWO = 2 số). */
export function qNos(q: Question): number[] {
  return q.type === 'multi' ? Array.from({ length: Math.max(1, q.answer.length) }, (_, i) => q.no + i) : [q.no];
}
export function groupNos(groups: QuestionGroup[]) { return groups.flatMap((g) => g.questions.flatMap(qNos)); }
const filled = (a: Answers[number] | undefined) => a !== null && a !== undefined && a !== '' && !(Array.isArray(a) && !a.length);
/** Số câu đã trả lời: câu multi tính theo số lựa chọn đã chọn (tối đa số câu nó chiếm). */
export function answeredNos(groups: QuestionGroup[], answers: Answers): Set<number> {
  const s = new Set<number>();
  for (const g of groups) for (const q of g.questions) {
    const a = answers[q.no];
    if (!filled(a)) continue;
    const nos = qNos(q);
    const k = Array.isArray(a) ? Math.min(a.length, nos.length) : nos.length;
    nos.slice(0, k).forEach((n) => s.add(n));
  }
  return s;
}

/** Cuộn tới câu `no` (hoặc câu multi chứa nó) và đặt con trỏ vào ô trả lời. */
export function focusQuestion(no: number) {
  let el: HTMLElement | null = null;
  for (let n = no; n >= Math.max(1, no - 3) && !el; n--) el = document.getElementById(`q-${n}`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const input = el.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled]), textarea');
  input?.focus({ preventScroll: true });
}

// ---------- Đồng hồ ----------
/** Đồng hồ đếm ngược kiểu máy thi: "59 minutes left"; dưới 2 phút hiện giây. Báo ở 10 và 5 phút. */
export function ExamClock({ seconds, onEnd, stopped, running = true, overtime }: { seconds: number; onEnd?: () => void; stopped?: boolean; running?: boolean; overtime?: boolean }) {
  const startRef = useRef<number | null>(running ? Date.now() : null);
  const [, tick] = useState(0);
  const [toast, setToast] = useState('');
  const ended = useRef(false);
  const warned = useRef(new Set<number>());
  const endRef = useRef(onEnd); endRef.current = onEnd;
  const frozen = useRef<number | null>(null);
  if (running && startRef.current === null) startRef.current = Date.now();
  const elapsed = frozen.current ?? (startRef.current ? (Date.now() - startRef.current) / 1000 : 0);
  const left = Math.max(0, seconds - elapsed);
  useEffect(() => {
    if (stopped) { frozen.current = elapsed; return; }
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [stopped]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stopped || !startRef.current) return;
    for (const w of [600, 300]) if (seconds > w && left <= w && left > 0 && !warned.current.has(w)) { warned.current.add(w); setToast(`${w / 60} minutes remaining`); }
    if (left === 0 && !ended.current) { ended.current = true; setToast(overtime ? 'Hết giờ – bạn vẫn có thể viết tiếp' : 'Time is up'); endRef.current?.(); }
  });
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(''), 6000); return () => window.clearTimeout(t); }, [toast]);
  const low = left > 0 && left <= 300;
  const min = Math.ceil(left / 60);
  const text = !startRef.current ? `${Math.round(seconds / 60)} minutes left`
    : left === 0 ? (overtime ? `Time is up · +${Math.floor((elapsed - seconds) / 60)}:${String(Math.floor((elapsed - seconds) % 60)).padStart(2, '0')}` : 'Time is up')
      : left < 120 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} left` : `${min} minutes left`;
  return (
    <>
      <span className={`timer xclock${low ? ' is-low' : ''}${left === 0 ? ' is-out' : ''}${startRef.current && !stopped ? ' is-run' : ''}`} role="timer" aria-live="off" data-left={Math.ceil(left)}>
        <span className="timer__num">{text}</span>
      </span>
      {toast && <div className="xtoast" role="status">{toast}</div>}
    </>
  );
}

// ---------- Khung ----------
export interface FramePart { label: string; nos: number[]; href?: string }

export function ExamFrame({ status, tools, onExit, exitLabel = 'Thoát', banner, children, footer, volume, className }: {
  /** Giữa thanh trên: đồng hồ hoặc trạng thái audio. */
  status?: ReactNode;
  /** Nút riêng của app (Luyện tập: transcript, dịch…). */
  tools?: ReactNode;
  onExit: () => void; exitLabel?: string;
  banner?: { title: string; text: ReactNode } | null;
  children: ReactNode;
  footer?: ReactNode;
  /** Có thanh âm lượng (Listening). */
  volume?: boolean;
  className?: string;
}) {
  const p = useExamPrefs();
  const [menu, setMenu] = useState<'options' | 'help' | 'volume' | null>(null);
  const [hidden, setHidden] = useState(false);
  const cand = useState(candidateNo)[0];
  useEffect(() => {
    document.documentElement.classList.add('exam-open');
    return () => document.documentElement.classList.remove('exam-open');
  }, []);
  return (
    <ExamCtx.Provider value={true}>
      <div className={`exam${className ? ` ${className}` : ''}`} data-size={p.size} data-contrast={p.contrast}>
        <header className="xhead">
          <div className="xhead__left">
            <button className="xbtn xbtn--exit" onClick={onExit} title={exitLabel} aria-label={exitLabel}><X size={18} /></button>
            <span className="xhead__cand">{cand}</span>
          </div>
          <div className="xhead__mid">{status}</div>
          <div className="xhead__right">
            {tools}
            <Wifi size={18} className="xhead__wifi" aria-hidden />
            {volume && <button className="xbtn" onClick={() => setMenu(menu === 'volume' ? null : 'volume')} aria-label="Volume" title="Volume"><Volume2 size={19} /></button>}
            <button className="xbtn" onClick={() => setMenu(menu === 'help' ? null : 'help')} aria-label="Help" title="Help"><CircleHelp size={19} /></button>
            <button className="xbtn" onClick={() => setHidden(true)} aria-label="Hide" title="Hide screen"><EyeOff size={19} /></button>
            <button className="xbtn" onClick={() => setMenu(menu === 'options' ? null : 'options')} aria-label="Options" title="Options"><Menu size={20} /></button>
          </div>
          {menu === 'volume' && (
            <div className="xpop xpop--vol">
              <label>Volume <input type="range" min={0} max={1} step={0.05} value={p.volume} onChange={(e) => setExamPrefs({ volume: +e.target.value })} /></label>
            </div>
          )}
          {menu === 'options' && (
            <div className="xpop">
              <div className="xpop__h">Options</div>
              <div className="xpop__sec">Text size</div>
              {([['standard', 'Standard'], ['large', 'Large'], ['xlarge', 'Extra large']] as const).map(([v, l]) => (
                <label key={v} className="xradio"><input type="radio" name="xsize" checked={p.size === v} onChange={() => setExamPrefs({ size: v })} /> {l}</label>
              ))}
              <div className="xpop__sec">Contrast</div>
              {([['bw', 'Black on white'], ['wb', 'White on black'], ['yb', 'Yellow on black']] as const).map(([v, l]) => (
                <label key={v} className="xradio"><input type="radio" name="xcontrast" checked={p.contrast === v} onChange={() => setExamPrefs({ contrast: v })} /> {l}</label>
              ))}
              <button className="xbtn-text" onClick={() => setMenu(null)}>Close</button>
            </div>
          )}
          {menu === 'help' && (
            <div className="xpop xpop--help">
              <div className="xpop__h">Help</div>
              <ul>
                <li>Bấm số câu ở thanh dưới để tới câu đó; <b>←</b> <b>→</b> để sang câu trước/sau.</li>
                <li>Đánh dấu <b>Review</b> để nhớ câu cần xem lại (số câu có viền tròn trên).</li>
                <li>Bôi đen chữ trong bài đọc để <b>highlight</b>.</li>
                <li>Kéo vạch giữa hai cột để đổi độ rộng.</li>
                <li><b>Options</b> (☰): cỡ chữ và màu nền. <b>Hide</b>: che màn hình.</li>
                <li>Nút <b>✓</b> góc phải dưới: nộp bài.</li>
              </ul>
              <button className="xbtn-text" onClick={() => setMenu(null)}>Close</button>
            </div>
          )}
        </header>
        {banner && (
          <div className="xbanner">
            <strong>{banner.title}</strong>
            <span>{banner.text}</span>
          </div>
        )}
        <div className="xbody">{children}</div>
        {footer}
        {hidden && (
          <div className="xhide">
            <p>Your screen is hidden.</p>
            <button className="xbtn-solid" onClick={() => setHidden(false)}>Show screen</button>
          </div>
        )}
      </div>
    </ExamCtx.Provider>
  );
}

/** Thanh điều hướng dưới: các Part, số câu của Part đang mở, Review, ← →, nộp bài. */
export function ExamNav({ parts, cur, curNo, answered, flagged, results, onPart, onGo, onFlag, onSubmit, submitLabel = 'Nộp bài', canSubmit = true, extra }: {
  parts: FramePart[]; cur: number; curNo: number | null;
  /** Số câu đã trả lời, theo từng Part. */
  answered: Set<number>[];
  /** Câu đánh dấu Review của Part đang mở. */
  flagged: Set<number>;
  /** Sau khi chấm: đúng/sai theo số câu (Part đang mở). */
  results?: Map<number, boolean>;
  onPart: (i: number) => void; onGo: (no: number, part: number) => void; onFlag: (no: number) => void;
  onSubmit?: () => void; submitLabel?: string; canSubmit?: boolean;
  extra?: ReactNode;
}) {
  const all = parts.flatMap((p, pi) => p.nos.map((no) => ({ no, pi })));
  const at = curNo === null ? -1 : all.findIndex((x) => x.no === curNo && x.pi === cur);
  const step = (d: number) => {
    const first = all.findIndex((x) => x.pi === cur);
    const i = at < 0 ? first : at + d;
    const t = all[Math.max(0, Math.min(all.length - 1, i))];
    if (t) onGo(t.no, t.pi);
  };
  const ans = (pi: number) => answered[pi] ?? new Set<number>();
  return (
    <footer className="xnav">
      <label className={`xnav__review${curNo === null ? ' is-off' : ''}`}>
        <input type="checkbox" disabled={curNo === null} checked={curNo !== null && flagged.has(curNo)} onChange={() => curNo !== null && onFlag(curNo)} /> Review
      </label>
      <div className="xnav__parts parttabs">
        {parts.map((p, pi) => {
          const n = p.nos.filter((x) => ans(pi).has(x)).length;
          if (pi !== cur) {
            const inner = <><strong>{p.label}</strong> <span>{n} of {p.nos.length}</span></>;
            return p.href
              ? <a key={pi} className="xnav__part" href={p.href} onClick={(e) => { e.preventDefault(); onPart(pi); }}>{inner}</a>
              : <button key={pi} className="xnav__part" onClick={() => onPart(pi)}>{inner}</button>;
          }
          return (
            <div key={pi} className="xnav__part is-on" aria-current="step">
              <strong>{p.label}</strong>
              <div className="xnav__nos">
                {p.nos.map((no) => {
                  const r = results?.get(no);
                  return (
                    <button key={no} className={`xnav__no${ans(pi).has(no) ? ' is-ans' : ''}${flagged.has(no) ? ' is-flag' : ''}${curNo === no ? ' is-cur' : ''}${r === true ? ' is-right' : r === false ? ' is-wrong' : ''}`}
                      onClick={() => onGo(no, pi)} aria-label={`Question ${no}${ans(pi).has(no) ? ' (answered)' : ''}${flagged.has(no) ? ' (review)' : ''}`}>{no}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="xnav__right">
        {extra}
        <button className="xnav__arrow" onClick={() => step(-1)} aria-label="Previous"><ArrowLeft size={20} /></button>
        <button className="xnav__arrow" onClick={() => step(1)} aria-label="Next"><ArrowRight size={20} /></button>
        {onSubmit && <button className="xnav__submit" onClick={onSubmit} disabled={!canSubmit} aria-label={submitLabel} title={submitLabel}><Check size={22} /></button>}
      </div>
    </footer>
  );
}

/** Hai cột kéo được vạch giữa (desktop); điện thoại: 2 tab. */
export function ExamSplit({ left, right, labels = ['Text', 'Questions'], storeKey = 'ielts:exam-split' }: { left: ReactNode; right: ReactNode; labels?: [string, string]; storeKey?: string }) {
  const [w, setW] = useState(() => { try { return +(localStorage.getItem(storeKey) ?? 50) || 50; } catch { return 50; } });
  const [tab, setTab] = useState<0 | 1>(0);
  const box = useRef<HTMLDivElement>(null);
  const drag = (e: React.PointerEvent) => {
    e.preventDefault();
    const r = box.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => setW(Math.max(25, Math.min(75, ((ev.clientX - r.left) / r.width) * 100)));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setW((v) => { try { localStorage.setItem(storeKey, String(Math.round(v))); } catch { /* ignore */ } return v; }); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return (
    <>
      <div className="xtabs tabs--mobile">
        {labels.map((l, i) => <button key={l} className={`tabs__btn${tab === i ? ' is-on' : ''}`} onClick={() => setTab(i as 0 | 1)}>{l}</button>)}
      </div>
      <div className="xsplit" ref={box} style={{ ['--xl' as string]: `${w}%` }}>
        <section className={`xsplit__pane xsplit__pane--left${tab !== 0 ? ' hide-sm' : ''}`}>{left}</section>
        <div className="xsplit__bar" onPointerDown={drag} role="separator" aria-orientation="vertical" aria-label="Kéo để đổi độ rộng"><span>⇔</span></div>
        <section className={`xsplit__pane xsplit__pane--right${tab !== 1 ? ' hide-sm' : ''}`}>{right}</section>
      </div>
    </>
  );
}

/** Màn trước giờ thi: hướng dẫn chung (và kiểm tra âm thanh cho Listening). */
export function ExamIntro({ title, time, instructions, info, sound, onStart, onExit, startLabel = 'Start test' }: {
  title: string; time: string; instructions: string[]; info: string[]; sound?: boolean;
  onStart: () => void; onExit: () => void; startLabel?: string;
}) {
  const p = useExamPrefs();
  const [heard, setHeard] = useState(!sound); // chỉ để nhắc, không khoá nút Start
  const beep = () => {
    try {
      const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 660; g.gain.value = 0.15 * p.volume; o.connect(g).connect(ctx.destination); o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 700);
    } catch { /* ignore */ }
    setHeard(true);
  };
  return (
    <ExamFrame onExit={onExit} status={<span className="xhead__status">{time}</span>} volume={sound}>
      <div className="xintro">
        <h1>{title}</h1>
        <p className="xintro__time">Time: {time}</p>
        {sound && (
          <section className="xintro__box">
            <h2>Sound check</h2>
            <p>Put on your headphones and click <b>Play sound</b>. Adjust the volume until you can hear clearly.</p>
            <div className="row wrap">
              <button className="xbtn-solid" onClick={beep}><Volume2 size={16} /> Play sound</button>
              <label className="xvol">Volume <input type="range" min={0} max={1} step={0.05} value={p.volume} onChange={(e) => setExamPrefs({ volume: +e.target.value })} /></label>
            </div>
          </section>
        )}
        <section className="xintro__box">
          <h2>INSTRUCTIONS TO CANDIDATES</h2>
          <ul>{instructions.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <h2>INFORMATION FOR CANDIDATES</h2>
          <ul>{info.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </section>
        <button className="xbtn-solid xbtn-solid--big" onClick={onStart}>{startLabel}</button>
        {!heard && <p className="small">Nên bấm <b>Play sound</b> để kiểm tra tai nghe trước khi bắt đầu: audio chỉ phát một lần.</p>}
      </div>
    </ExamFrame>
  );
}

/** Bảng kết quả nổi sau khi nộp. */
export function ExamSheet({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="xsheet" role="dialog" aria-modal="true">
      <div className="xsheet__card">
        {onClose && <button className="xbtn xsheet__x" onClick={onClose} aria-label="Đóng"><X size={18} /></button>}
        {children}
      </div>
    </div>
  );
}
