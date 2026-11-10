import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Check, Loader2, Sparkles } from 'lucide-react';
import { wordDiff } from '../lib/text';
import { aiReady, useAiConfig } from '../store';
import { fmtBand, bandColor } from '../lib/band';
import type { Chart } from '../types';

/** So sánh bản gốc và bản sửa theo từ. */
export function WordDiff({ from, to }: { from: string; to: string }) {
  const ops = wordDiff(from, to);
  return (
    <p className="wdiff">
      {ops.map((o, i) => o.op === 'eq' ? <span key={i}>{o.b} </span>
        : o.op === 'del' ? <del key={i}>{o.a} </del>
        : o.op === 'ins' ? <ins key={i}>{o.b} </ins>
        : <span key={i}><del>{o.a}</del> <ins>{o.b}</ins> </span>)}
    </p>
  );
}

/** Hiện khi tính năng cần AI mà chưa cấu hình. */
export function AiGate({ children, feature }: { children: ReactNode; feature: string }) {
  const cfg = useAiConfig();
  if (aiReady(cfg)) return <>{children}</>;
  return (
    <div className="banner banner--link">
      <Bot size={18} />
      <span>{feature} cần cấu hình AI (Claude, DeepSeek, OpenAI, Gemini…). Vào <Link to="/settings"><strong>Cài đặt → AI</strong></Link> để nhập API key hoặc địa chỉ proxy.</span>
    </div>
  );
}

export function Busy({ label }: { label: string }) {
  return <div className="busy"><Loader2 size={18} className="spin" /> {label}</div>;
}

export function BandPill({ band, label }: { band: number; label?: string }) {
  return <span className="bandpill" style={{ ['--c' as string]: bandColor(band) }}>{label && <small>{label}</small>}<strong>{fmtBand(band)}</strong></span>;
}

export function CriteriaBars({ items }: { items: { label: string; band: number; reason?: string }[] }) {
  return (
    <div className="crit">
      {items.map((c) => (
        <div key={c.label} className="crit__row">
          <div className="crit__head"><span>{c.label}</span><strong style={{ color: bandColor(c.band) }}>{c.band ? fmtBand(c.band) : '–'}</strong></div>
          <div className="bar"><div className="bar__fill" style={{ width: `${(c.band / 9) * 100}%`, background: bandColor(c.band) }} /></div>
          {c.reason && <p className="small muted">{c.reason}</p>}
        </div>
      ))}
    </div>
  );
}

const COLORS = ['#0f766e', '#d97706', '#4f46e5', '#db2777', '#059669', '#0284c7', '#7c3aed', '#64748b'];
const fmtNum = (v: number | null | undefined, d?: number) => (v == null ? '–' : d != null ? v.toFixed(d) : String(v));
const pctUnit = (c: Chart) => !!c.percent || (c.unit ?? '').trim().startsWith('%');
/** Bước trục y "tròn": 1/2/5 × 10ⁿ, khoảng 4–6 vạch. */
export function niceTicks(max: number, target = 5): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / target; const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? 10 * p;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(10));
}
/** Nhãn dài → chia thành tối đa 3 dòng ~maxCh ký tự. */
function wrapLabel(l: string, maxCh: number): string[] {
  if (l.length <= maxCh) return [l];
  const out: string[] = []; let cur = '';
  for (const w of l.split(/\s+/)) { if (cur && (cur + ' ' + w).length > maxCh) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w; }
  if (cur) out.push(cur);
  return out.length > 3 ? [...out.slice(0, 2), out.slice(2).join(' ')] : out;
}

/** Vẽ biểu đồ Task 1 từ dữ liệu (line / bar / pie / table) bằng SVG. Hover/chạm vào điểm hoặc cột để xem số. */
export function ChartView({ chart }: { chart: Chart }) {
  const [tip, setTip] = useState('');
  const { labels, series, unit, kind = 'bar', title, decimals } = chart;
  const pct = pctUnit(chart);
  const val = (v: number | null) => `${fmtNum(v, decimals)}${pct ? '%' : ''}`;
  const head = title ? <p className="chart__title">{title}</p> : null;
  const tipEl = <p className="chart__tip small" aria-live="polite">{tip || <span className="muted">Chạm vào điểm/cột để xem số liệu</span>}</p>;
  if (kind === 'table') return <div className="chart">{head}<DataTable chart={chart} /></div>;
  if (kind === 'pie') {
    return (
      <div className="chart chart--pies">
        {head}
        <div className="chart__pies">
          {series.map((s) => {
            const total = s.values.reduce<number>((a, b) => a + (b ?? 0), 0) || 1;
            let acc = 0;
            return (
              <figure key={s.name} className="chart__pie">
                <svg viewBox="0 0 120 120" width={170} height={170} role="img" aria-label={`${s.name}: ${labels.map((l, i) => `${l} ${val(s.values[i])}`).join(', ')}`}>
                  {s.values.map((v, i) => {
                    const a0 = (acc / total) * 2 * Math.PI; acc += v ?? 0; const a1 = (acc / total) * 2 * Math.PI;
                    const x0 = 60 + 55 * Math.sin(a0), y0 = 60 - 55 * Math.cos(a0), x1 = 60 + 55 * Math.sin(a1), y1 = 60 - 55 * Math.cos(a1);
                    const t = `${s.name} · ${labels[i]}: ${val(v)}`;
                    return a1 - a0 >= 2 * Math.PI - 1e-6
                      ? <circle key={i} cx={60} cy={60} r={55} fill={COLORS[i % COLORS.length]} onClick={() => setTip(t)}><title>{t}</title></circle>
                      : <path key={i} d={`M60 60 L${x0} ${y0} A55 55 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={0.6} onClick={() => setTip(t)} onMouseEnter={() => setTip(t)}><title>{t}</title></path>;
                  })}
                </svg>
                <figcaption>{s.name}</figcaption>
              </figure>
            );
          })}
        </div>
        <ul className="chart__legend">{labels.map((l, i) => <li key={l}><i style={{ background: COLORS[i % COLORS.length] }} /> {l}</li>)}</ul>
        {tipEl}
      </div>
    );
  }
  const horiz = !!chart.horizontal && kind === 'bar';
  const stacked = !!chart.stacked && kind === 'bar';
  const vals = (i: number) => series.map((s) => s.values[i] ?? 0);
  const rawMax = stacked ? Math.max(...labels.map((_, i) => vals(i).reduce((a, b) => a + b, 0))) : Math.max(...series.flatMap((s) => s.values.map((v) => v ?? 0)));
  const ticks = niceTicks(pct && stacked ? 100 : rawMax);
  const max = ticks[ticks.length - 1] || 1;
  const longest = Math.max(...labels.map((l) => l.length));
  if (horiz) {
    const rowH = Math.max(26, 12 + series.length * 12), padL = Math.min(170, 14 + longest * 6.2), W = 560, padT = 10, padB = 34;
    const H = padT + padB + labels.length * rowH;
    const X = (v: number) => padL + (v / max) * (W - padL - 20);
    const bh = (rowH * 0.72) / (stacked ? 1 : series.length);
    return (
      <div className="chart">
        {head}
        <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg" role="img" aria-label={title ?? 'Biểu đồ cột ngang'}>
          {ticks.map((t) => <g key={t}><line y1={padT} y2={H - padB} x1={X(t)} x2={X(t)} className="chart__grid" /><text y={H - padB + 14} x={X(t)} textAnchor="middle" className="chart__tick">{t.toLocaleString('en-US')}</text></g>)}
          {labels.map((l, i) => {
            let accX = 0;
            return (
              <g key={l}>
                {wrapLabel(l, Math.floor(padL / 6.4)).map((ln, k, arr) => <text key={k} x={padL - 6} y={padT + i * rowH + rowH / 2 + 4 + (k - (arr.length - 1) / 2) * 12} textAnchor="end" className="chart__tick">{ln}</text>)}
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0; const t = `${l} · ${s.name}: ${val(s.values[i])}`;
                  const x0 = stacked ? X(accX) : padL; accX += v;
                  const y = padT + i * rowH + rowH * 0.14 + (stacked ? 0 : si * bh);
                  return <rect key={si} x={x0} y={y} width={Math.max(0, X(v) - padL)} height={bh - 1.5} fill={COLORS[si % COLORS.length]} rx={2} onClick={() => setTip(t)} onMouseEnter={() => setTip(t)}><title>{t}</title></rect>;
                })}
              </g>
            );
          })}
          {unit && <text x={(padL + W - 20) / 2} y={H - 4} textAnchor="middle" className="chart__axis">{unit}</text>}
        </svg>
        {series.length > 1 && <ul className="chart__legend">{series.map((s, i) => <li key={s.name}><i style={{ background: COLORS[i % COLORS.length] }} /> {s.name}</li>)}</ul>}
        {tipEl}
      </div>
    );
  }
  const tk = (t: number) => t.toLocaleString('en-US');
  const W = 560, padL = (unit ? 24 : 8) + Math.max(28, tk(max).length * 6.6 + 8), padR = 14, padT = 12;
  const n = labels.length;
  const slot = (W - padL - padR) / n;
  const tilt = longest * 6.2 > slot && longest > 6;
  const lines = tilt ? 1 : Math.max(...labels.map((l) => wrapLabel(l, Math.max(6, Math.floor(slot / 6.4))).length));
  const padB = tilt ? Math.min(90, 18 + longest * 4.6) : 10 + lines * 13;
  const H = 260 + padB;
  const Y = (v: number) => H - padB - (v / max) * (H - padB - padT);
  const X = (i: number) => (kind === 'line' ? padL + slot / 2 + i * slot : padL + i * slot);
  const projAt = chart.projectedFrom ? labels.indexOf(chart.projectedFrom) : -1;
  return (
    <div className="chart">
      {head}
      <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg" role="img" aria-label={title ?? 'Biểu đồ'}>
        {ticks.map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={Y(t)} y2={Y(t)} className="chart__grid" /><text x={padL - 6} y={Y(t) + 4} textAnchor="end" className="chart__tick">{tk(t)}{pct && stacked ? '%' : ''}</text></g>)}
        {unit && <text transform={`translate(12 ${(H - padB + padT) / 2}) rotate(-90)`} textAnchor="middle" className="chart__axis">{unit.length > 34 ? unit.slice(0, 33) + '…' : unit}</text>}
        {projAt >= 0 && projAt < n - 1 && <g><rect x={X(projAt)} y={padT} width={W - padR - X(projAt)} height={H - padB - padT} className="chart__proj" /><text x={W - padR - 4} y={padT + 12} textAnchor="end" className="chart__tick">Projected</text></g>}
        {kind === 'line' ? series.map((s, si) => {
          const pts = s.values.map((v, i) => (v == null ? null : [X(i), Y(v)] as const));
          const seg = (from: number, to: number) => pts.slice(from, to + 1).filter(Boolean).map((p) => `${p![0]},${p![1]}`).join(' ');
          const c = COLORS[si % COLORS.length];
          return (
            <g key={s.name}>
              <polyline fill="none" stroke={c} strokeWidth={2.5} points={seg(0, projAt >= 0 ? projAt : n - 1)} />
              {projAt >= 0 && <polyline fill="none" stroke={c} strokeWidth={2.5} strokeDasharray="6 5" points={seg(projAt, n - 1)} />}
              {s.values.map((v, i) => { if (v == null) return null; const t = `${s.name} · ${labels[i]}: ${val(v)}`; return <circle key={i} cx={X(i)} cy={Y(v)} r={4} fill={c} className="chart__pt" onClick={() => setTip(t)} onMouseEnter={() => setTip(t)}><title>{t}</title></circle>; })}
            </g>
          );
        }) : labels.map((l, i) => {
          let acc = 0;
          const bw = (slot * 0.72) / (stacked ? 1 : series.length);
          return <g key={l}>{series.map((s, si) => {
            const v = s.values[i] ?? 0; const t = `${l} · ${s.name}: ${val(s.values[i])}`;
            const y0 = stacked ? Y(acc + v) : Y(v); const h = stacked ? Y(acc) - Y(acc + v) : H - padB - Y(v); acc += v;
            return <rect key={si} x={X(i) + slot * 0.14 + (stacked ? 0 : si * bw)} y={y0} width={Math.max(1, bw - 2)} height={Math.max(0, h)} fill={COLORS[si % COLORS.length]} rx={stacked ? 0 : 2} onClick={() => setTip(t)} onMouseEnter={() => setTip(t)}><title>{t}</title></rect>;
          })}</g>;
        })}
        {labels.map((l, i) => {
          const cx = X(i) + (kind === 'line' ? 0 : slot / 2);
          return tilt
            ? <text key={l} transform={`translate(${cx} ${H - padB + 12}) rotate(-35)`} textAnchor="end" className="chart__tick">{l}</text>
            : <text key={l} x={cx} y={H - padB + 14} textAnchor="middle" className="chart__tick">{wrapLabel(l, Math.max(6, Math.floor(slot / 6.4))).map((ln, k) => <tspan key={k} x={cx} dy={k ? 12 : 0}>{ln}</tspan>)}</text>;
        })}
      </svg>
      <ul className="chart__legend">{series.map((s, i) => <li key={s.name}><i style={{ background: COLORS[i % COLORS.length] }} /> {s.name}</li>)}{projAt >= 0 && <li className="muted">- - - Projected (sau {chart.projectedFrom})</li>}</ul>
      {tipEl}
    </div>
  );
}

/** Bảng số liệu của một biểu đồ (có đơn vị). pie: hàng = các phần, cột = từng biểu đồ. */
export function DataTable({ chart }: { chart: Chart }) {
  const { labels, series, unit, decimals, kind } = chart;
  const pct = pctUnit(chart);
  const cell = (v: number | null) => `${fmtNum(v, decimals)}${pct && kind !== 'table' ? '%' : ''}`;
  const pie = kind === 'pie';
  const proj = chart.projectedFrom ? labels.indexOf(chart.projectedFrom) : -1;
  return (
    <div className="table-wrap">
      <table className="table table--data">
        {chart.title && <caption>{chart.title}{unit && !pct ? ` (${unit})` : pct ? ' (%)' : ''}</caption>}
        {pie ? <>
          <thead><tr><th></th>{series.map((s) => <th key={s.name}>{s.name}</th>)}</tr></thead>
          <tbody>{labels.map((l, i) => <tr key={l}><th scope="row">{l}</th>{series.map((s) => <td key={s.name}>{cell(s.values[i])}</td>)}</tr>)}</tbody>
        </> : <>
          <thead><tr><th></th>{labels.map((l, i) => <th key={l}>{l}{proj >= 0 && i > proj ? '*' : ''}</th>)}</tr></thead>
          <tbody>{series.map((s) => <tr key={s.name}><th scope="row">{s.name}</th>{s.values.map((v, i) => <td key={i}>{cell(v)}</td>)}</tr>)}</tbody>
        </>}
      </table>
      {!chart.title && unit && <p className="small muted">Đơn vị: {unit}</p>}
      {proj >= 0 && proj < labels.length - 1 && <p className="small muted">* Projected – số liệu dự báo</p>}
    </div>
  );
}

/** Nút sao chép / đã sao chép. */
export function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => { if (!ok) return; const t = setTimeout(() => setOk(false), 1500); return () => clearTimeout(t); }, [ok]);
  return <button className="btn btn--text btn--sm" onClick={() => navigator.clipboard?.writeText(text).then(() => setOk(true))}>{ok ? <><Check size={14} /> Đã chép</> : 'Sao chép'}</button>;
}

export function AiBadge() { return <span className="ai-badge"><Sparkles size={12} /> AI</span>; }
