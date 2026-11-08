import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Check, Loader2, Sparkles } from 'lucide-react';
import { wordDiff } from '../lib/text';
import { aiReady, useAiConfig } from '../store';
import { fmtBand, bandColor } from '../lib/band';
import type { WritingMaterial } from '../types';

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
      <span>{feature} cần Claude API. Vào <Link to="/settings"><strong>Cài đặt → AI</strong></Link> để nhập API key hoặc địa chỉ proxy.</span>
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

/** Vẽ biểu đồ Task 1 từ dữ liệu (line / bar / pie / table) bằng SVG, không cần ảnh. */
export function ChartView({ chart }: { chart: NonNullable<WritingMaterial['chart']> }) {
  const { labels, series, unit, kind = 'bar' } = chart;
  const colors = ['#0f766e', '#d97706', '#4f46e5', '#db2777', '#059669', '#0284c7'];
  if (kind === 'table') {
    return (
      <div className="table-wrap"><table className="table">
        <thead><tr><th></th>{labels.map((l) => <th key={l}>{l}</th>)}</tr></thead>
        <tbody>{series.map((s) => <tr key={s.name}><td><strong>{s.name}</strong></td>{s.values.map((v, i) => <td key={i}>{v}{unit && unit.startsWith('%') ? '%' : ''}</td>)}</tr>)}</tbody>
      </table>{unit && <p className="small muted">Đơn vị: {unit}</p>}</div>
    );
  }
  if (kind === 'pie') {
    const s = series[0];
    const total = s.values.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return (
      <div className="chart chart--pie">
        <svg viewBox="0 0 120 120" width={200} height={200}>
          {s.values.map((v, i) => {
            const a0 = (acc / total) * 2 * Math.PI; acc += v; const a1 = (acc / total) * 2 * Math.PI;
            const x0 = 60 + 55 * Math.sin(a0), y0 = 60 - 55 * Math.cos(a0), x1 = 60 + 55 * Math.sin(a1), y1 = 60 - 55 * Math.cos(a1);
            return <path key={i} d={`M60 60 L${x0} ${y0} A55 55 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`} fill={colors[i % colors.length]} />;
          })}
        </svg>
        <ul className="chart__legend">{labels.map((l, i) => <li key={l}><i style={{ background: colors[i % colors.length] }} /> {l}: {s.values[i]}{unit?.startsWith('%') ? '%' : ''}</li>)}</ul>
      </div>
    );
  }
  const W = 520, H = 280, px = 48, py = 24;
  const max = Math.max(...series.flatMap((s) => s.values)) * 1.1 || 1;
  const x = (i: number) => px + (i / Math.max(1, labels.length - 1)) * (W - px - 16);
  const y = (v: number) => H - py - (v / max) * (H - 2 * py);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg">
        {ticks.map((t) => <g key={t}><line x1={px} x2={W - 16} y1={y(t)} y2={y(t)} className="chart__grid" /><text x={px - 6} y={y(t) + 4} textAnchor="end" className="chart__tick">{t}</text></g>)}
        {kind === 'line' ? series.map((s, si) => (
          <g key={s.name}>
            <polyline fill="none" stroke={colors[si % colors.length]} strokeWidth={2.5} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={colors[si % colors.length]} />)}
          </g>
        )) : (() => {
          const gw = (W - px - 16) / labels.length; const bw = (gw * 0.7) / series.length;
          return series.map((s, si) => s.values.map((v, i) => <rect key={`${si}-${i}`} x={px + i * gw + gw * 0.15 + si * bw} y={y(v)} width={bw - 2} height={H - py - y(v)} fill={colors[si % colors.length]} rx={2} />));
        })()}
        {labels.map((l, i) => <text key={l} x={kind === 'line' ? x(i) : px + (i + 0.5) * ((W - px - 16) / labels.length)} y={H - 6} textAnchor="middle" className="chart__tick">{l}</text>)}
      </svg>
      <ul className="chart__legend">{series.map((s, i) => <li key={s.name}><i style={{ background: colors[i % colors.length] }} /> {s.name}</li>)}{unit && <li className="muted">({unit})</li>}</ul>
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
