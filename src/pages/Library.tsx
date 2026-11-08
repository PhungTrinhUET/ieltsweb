// Tài liệu: nạp hàng loạt file (JSON / Markdown / audio + SRT / ảnh), tạo đề bằng AI, quản lý & xuất.
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, FileJson, FileUp, Loader2, Sparkles, Trash2, Upload } from 'lucide-react';
import type { ListeningMaterial, Material, Skill, WritingType } from '../types';
import { deleteMaterial, restoreSamples, saveBlob, saveMaterial, saveMaterials, uid, useDb } from '../db';
import { parseJsonMaterials, parseReadingMarkdown, parseSubtitles } from '../lib/importers';
import { aiReady, getAiConfig, useAiConfig } from '../store';
import { AiGate } from '../components/misc';
import { SKILL_META, subtitle } from './SkillList';
import { SAMPLE_MATERIALS } from '../content/samples';

const AUDIO = /\.(mp3|m4a|wav|ogg|aac|webm|flac)$/i;
const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i;
// Hiện danh sách theo trang để trang không dựng hàng nghìn dòng một lúc.
const PAGE = 60;

export default function Library() {
  const db = useDb();
  const cfg = useAiConfig();
  const [params] = useSearchParams();
  const [skill, setSkill] = useState<Skill | 'all'>((params.get('skill') as Skill) || 'all');
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Form tạo Listening thủ công
  const [lis, setLis] = useState({ title: '', transcript: '', audio: null as File | null, subs: null as File | null, section: 1, ai: true });
  // AI
  const [gen, setGen] = useState({ kind: 'reading' as 'reading' | 'listening' | 'listening-topic' | 'speaking' | 'writing', text: '', topic: '', task: 2 as 1 | 2, type: 'opinion' as WritingType, module: 'academic' as 'academic' | 'general', section: 1 });

  const push = (s: string) => setLog((l) => [s, ...l].slice(0, 30));
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  const needle = q.trim().toLowerCase();
  const items = Object.values(db.materials)
    .filter((m) => (skill === 'all' || m.skill === skill) && (!needle || m.title.toLowerCase().includes(needle) || m.id.toLowerCase().includes(needle)))
    .sort((a, b) => b.addedAt - a.addedAt);

  /** Nạp nhiều file: JSON → materials; .md → reading; audio + .srt/.txt cùng tên → listening; ảnh → chỉ lưu khi JSON tham chiếu "file:<tên>". */
  const importFiles = async (files: File[]) => {
    setBusy(true);
    try {
      const byName = new Map(files.map((f) => [f.name, f]));
      const blobKeys = new Map<string, string>();
      const blobFor = async (name: string) => {
        if (blobKeys.has(name)) return blobKeys.get(name)!;
        const f = byName.get(name); if (!f) return null;
        const k = await saveBlob(f); blobKeys.set(name, k); return k;
      };
      const handled = new Set<string>();
      const out: Material[] = [];
      for (const f of files) {
        if (/\.json$/i.test(f.name)) {
          try {
            const ms = parseJsonMaterials(await f.text());
            for (const m of ms) {
              // Tham chiếu file cục bộ: "file:ten.mp3"
              const a = (m as ListeningMaterial).audio;
              if (a?.startsWith('file:')) { const k = await blobFor(a.slice(5)); if (k) { (m as ListeningMaterial).audio = k; handled.add(a.slice(5)); } else push(`⚠ ${m.title}: không thấy file ${a.slice(5)}`); }
              if (m.skill === 'writing' && m.image?.startsWith('file:')) { const k = await blobFor(m.image.slice(5)); if (k) { m.image = k; handled.add(m.image); } }
              if (m.skill === 'listening' && !m.segments) { const sub = byName.get(f.name.replace(/\.json$/i, '.srt')) ?? byName.get(f.name.replace(/\.json$/i, '.vtt')); if (sub) { m.segments = parseSubtitles(await sub.text()); handled.add(sub.name); } }
              out.push(m);
            }
            push(`✓ ${f.name}: ${ms.length} bài`);
          } catch (e) { push(`✗ ${f.name}: ${e instanceof Error ? e.message : e}`); }
          handled.add(f.name);
        } else if (/\.md$/i.test(f.name)) {
          try { const m = parseReadingMarkdown(await f.text()); out.push(m); push(`✓ ${f.name}: Reading "${m.title}" (${m.groups.reduce((n, g) => n + g.questions.length, 0)} câu)`); }
          catch (e) { push(`✗ ${f.name}: ${e instanceof Error ? e.message : e}`); }
          handled.add(f.name);
        }
      }
      // Audio đi kèm transcript cùng tên (.txt / .srt / .vtt)
      for (const f of files) {
        if (!AUDIO.test(f.name) || handled.has(f.name)) continue;
        const base = f.name.replace(/\.[^.]+$/, '');
        const txt = byName.get(`${base}.txt`); const srt = byName.get(`${base}.srt`) ?? byName.get(`${base}.vtt`);
        if (!txt && !srt) { push(`⚠ ${f.name}: thiếu ${base}.txt hoặc .srt (transcript) – bỏ qua`); continue; }
        const segments = srt ? parseSubtitles(await srt.text()) : undefined;
        const transcript = txt ? await txt.text() : segments!.map((s) => s.text).join('\n');
        const audio = await blobFor(f.name);
        out.push({ id: uid(), skill: 'listening', title: base.replace(/[-_]+/g, ' '), transcript: transcript.trim(), segments, audio: audio!, groups: [], addedAt: Date.now(), source: 'Nạp file' });
        push(`✓ ${f.name}: Listening (chưa có câu hỏi – có thể nhờ AI tạo sau)`);
        handled.add(f.name); txt && handled.add(txt.name); srt && handled.add(srt.name);
      }
      for (const f of files) if (!handled.has(f.name) && !IMAGE.test(f.name) && !/\.(txt|srt|vtt)$/i.test(f.name)) push(`⚠ ${f.name}: không hỗ trợ`);
      if (out.length) await saveMaterials(out);
    } finally { setBusy(false); }
  };

  const createListening = async () => {
    if (!lis.transcript.trim() && !lis.subs) return;
    setBusy(true);
    try {
      const segments = lis.subs ? parseSubtitles(await lis.subs.text()) : undefined;
      const transcript = lis.transcript.trim() || segments!.map((s) => s.text).join('\n');
      let m: ListeningMaterial = { id: uid(), skill: 'listening', title: lis.title || 'Listening', transcript, segments, section: lis.section as 1, groups: [], addedAt: Date.now(), source: 'Nạp thủ công' };
      if (lis.ai && aiReady(cfg)) {
        const { generateListening } = await import('../ai/assist');
        const g = await generateListening(transcript, getAiConfig());
        m = { ...g, id: m.id, title: lis.title || g.title, transcript, segments, section: lis.section as 1 };
      }
      if (lis.audio) m.audio = await saveBlob(lis.audio);
      await saveMaterial(m);
      push(`✓ Đã tạo Listening "${m.title}"`);
      setLis({ title: '', transcript: '', audio: null, subs: null, section: 1, ai: true });
    } catch (e) { push(`✗ ${e instanceof Error ? e.message : e}`); } finally { setBusy(false); }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const a = await import('../ai/assist');
      const c = getAiConfig();
      let m: Material;
      if (gen.kind === 'reading') m = await a.generateReading(gen.text, c);
      else if (gen.kind === 'listening') m = await a.generateListening(gen.text, c);
      else if (gen.kind === 'listening-topic') m = await a.generateListeningFromTopic(gen.topic, gen.section, c);
      else if (gen.kind === 'speaking') m = await a.generateSpeaking(gen.topic, c);
      else m = await a.generateWriting(gen.task, gen.type, gen.topic, gen.module, c);
      await saveMaterial(m);
      push(`✓ AI đã tạo ${SKILL_META[m.skill].label}: "${m.title}"`);
      setGen((g) => ({ ...g, text: '', topic: '' }));
    } catch (e) { push(`✗ ${e instanceof Error ? e.message : e}`); } finally { setBusy(false); }
  };

  const exportJson = (ms: Material[], name: string) => {
    const blob = new Blob([JSON.stringify(ms.map(({ builtin: _b, ...m }) => m), null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  };
  const genTypes: WritingType[] = gen.task === 2 ? ['opinion', 'discussion', 'advantage', 'problem', 'double'] : gen.module === 'general' ? ['letter-formal', 'letter-semi', 'letter-informal'] : ['line', 'bar', 'pie', 'table', 'process', 'map', 'mixed'];

  return (
    <div className="page">
      <div className="page-head"><div><h1>Tài liệu</h1><p>Nạp hàng loạt đề của bạn, hoặc nhờ AI soạn đề từ bất kỳ văn bản / transcript / chủ đề nào.</p></div></div>

      <section className="card pad">
        <h2 className="h2"><FileUp size={18} /> Nạp file</h2>
        <div className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); importFiles([...e.dataTransfer.files]); }} onClick={() => fileRef.current?.click()}>
          <Upload size={28} />
          <p><strong>Kéo thả nhiều file vào đây</strong> hoặc bấm để chọn</p>
          <p className="small muted">JSON (một hoặc nhiều bài, mọi kỹ năng) · Markdown bài Reading · Audio (.mp3/.m4a/.wav) kèm transcript cùng tên (.txt hoặc .srt/.vtt) · ảnh biểu đồ cho Writing (tham chiếu "file:tên.png" trong JSON)</p>
          <input ref={fileRef} type="file" multiple hidden accept=".json,.md,.txt,.srt,.vtt,audio/*,image/*" onChange={(e) => { if (e.target.files) importFiles([...e.target.files]); e.target.value = ''; }} />
        </div>
        <div className="row wrap">
          <button className="btn btn--ghost btn--sm" onClick={() => exportJson(SAMPLE_MATERIALS, 'ielts-samples.json')}><FileJson size={15} /> Tải JSON mẫu (xem cấu trúc)</button>
          <a className="btn btn--ghost btn--sm" href="./CONTENT.md" target="_blank" rel="noreferrer">Hướng dẫn định dạng</a>
          <button className="btn btn--ghost btn--sm" onClick={() => exportJson(items.filter((m) => !m.builtin), 'ielts-materials.json')} disabled={!items.some((m) => !m.builtin)}><Download size={15} /> Xuất tài liệu của tôi</button>
        </div>
        {log.length > 0 && <ul className="log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      </section>

      <section className="card pad">
        <h2 className="h2">Tạo bài Listening từ audio + transcript</h2>
        <div className="form-grid">
          <input className="input" placeholder="Tiêu đề" value={lis.title} onChange={(e) => setLis({ ...lis, title: e.target.value })} />
          <label className="field-row"><span>Section</span><div className="seg">{[1, 2, 3, 4].map((s) => <button key={s} className={`seg__btn${lis.section === s ? ' is-selected' : ''}`} onClick={() => setLis({ ...lis, section: s })}>{s}</button>)}</div></label>
          <label className="file-row"><span>File audio (tuỳ chọn – không có thì dùng giọng máy)</span><input type="file" accept="audio/*" onChange={(e) => setLis({ ...lis, audio: e.target.files?.[0] ?? null })} /></label>
          <label className="file-row"><span>File phụ đề .srt/.vtt (tuỳ chọn – để chép chính tả theo đúng mốc thời gian)</span><input type="file" accept=".srt,.vtt" onChange={(e) => setLis({ ...lis, subs: e.target.files?.[0] ?? null })} /></label>
          <textarea className="textarea" rows={6} placeholder="Dán transcript (mỗi lượt lời một dòng, 'Tên: câu nói' nếu là hội thoại). Bỏ trống nếu đã có .srt" value={lis.transcript} onChange={(e) => setLis({ ...lis, transcript: e.target.value })} />
          <label className="setting--toggle"><div><strong>Nhờ AI soạn câu hỏi, dịch, từ vựng</strong><p className="small muted">Cần cấu hình AI. Không bật thì bài chỉ dùng để chép chính tả / điền từ / học transcript.</p></div><input type="checkbox" className="switch" checked={lis.ai} onChange={(e) => setLis({ ...lis, ai: e.target.checked })} /></label>
          <button className="btn btn--primary" onClick={createListening} disabled={busy || (!lis.transcript.trim() && !lis.subs)}>{busy ? <Loader2 size={16} className="spin" /> : null} Tạo bài Listening</button>
        </div>
      </section>

      <section className="card pad">
        <h2 className="h2"><Sparkles size={18} /> AI soạn đề</h2>
        <AiGate feature="Sinh đề">
          <div className="tabs">
            {([['reading', 'Reading từ văn bản'], ['listening', 'Listening từ transcript'], ['listening-topic', 'Listening từ chủ đề'], ['speaking', 'Speaking từ chủ đề'], ['writing', 'Writing từ dạng + chủ đề']] as const).map(([k, l]) => <button key={k} className={`tabs__btn${gen.kind === k ? ' is-on' : ''}`} onClick={() => setGen({ ...gen, kind: k })}>{l}</button>)}
          </div>
          <div className="form-grid">
            {(gen.kind === 'reading' || gen.kind === 'listening') && <textarea className="textarea" rows={8} placeholder={gen.kind === 'reading' ? 'Dán bài báo / đoạn văn tiếng Anh (500–900 từ). AI sẽ chia đoạn, soạn 10–14 câu hỏi đủ dạng, dịch và trích từ vựng.' : 'Dán transcript tiếng Anh. AI soạn 8–12 câu hỏi theo thứ tự bài nghe, dịch và từ vựng. Bài sẽ được đọc bằng giọng máy (hoặc nạp thêm audio ở mục trên).'} value={gen.text} onChange={(e) => setGen({ ...gen, text: e.target.value })} />}
            {gen.kind === 'listening-topic' && <><input className="input" placeholder="Chủ đề, vd. Booking a hotel room / A lecture on urban planning" value={gen.topic} onChange={(e) => setGen({ ...gen, topic: e.target.value })} /><label className="field-row"><span>Section</span><div className="seg">{[1, 2, 3, 4].map((s) => <button key={s} className={`seg__btn${gen.section === s ? ' is-selected' : ''}`} onClick={() => setGen({ ...gen, section: s })}>{s}</button>)}</div></label></>}
            {gen.kind === 'speaking' && <input className="input" placeholder="Chủ đề, vd. Travel / Music / Environment / A person who inspired you" value={gen.topic} onChange={(e) => setGen({ ...gen, topic: e.target.value })} />}
            {gen.kind === 'writing' && (
              <>
                <div className="row wrap">
                  <div className="seg">{([1, 2] as const).map((t) => <button key={t} className={`seg__btn${gen.task === t ? ' is-selected' : ''}`} onClick={() => setGen({ ...gen, task: t, type: t === 2 ? 'opinion' : gen.module === 'general' ? 'letter-formal' : 'line' })}>Task {t}</button>)}</div>
                  <div className="seg">{(['academic', 'general'] as const).map((md) => <button key={md} className={`seg__btn${gen.module === md ? ' is-selected' : ''}`} onClick={() => setGen({ ...gen, module: md, type: gen.task === 2 ? gen.type : md === 'general' ? 'letter-formal' : 'line' })}>{md === 'academic' ? 'Academic' : 'General'}</button>)}</div>
                </div>
                <div className="row wrap">{genTypes.map((t) => <button key={t} className={`chip${gen.type === t ? ' is-on' : ''}`} onClick={() => setGen({ ...gen, type: t })}>{t}</button>)}</div>
                <input className="input" placeholder="Chủ đề (tuỳ chọn), vd. technology and education" value={gen.topic} onChange={(e) => setGen({ ...gen, topic: e.target.value })} />
              </>
            )}
            <button className="btn btn--primary" onClick={generate} disabled={busy || ((gen.kind === 'reading' || gen.kind === 'listening') ? gen.text.trim().length < 100 : gen.kind !== 'writing' && !gen.topic.trim())}>{busy ? <><Loader2 size={16} className="spin" /> AI đang soạn (30–90 giây)…</> : <><Sparkles size={16} /> Tạo đề</>}</button>
          </div>
        </AiGate>
      </section>

      <section>
        <div className="row-between">
          <h2 className="h2">Tất cả tài liệu ({items.length})</h2>
          <div className="seg">{(['all', 'reading', 'listening', 'speaking', 'writing'] as const).map((k) => <button key={k} className={`seg__btn${skill === k ? ' is-selected' : ''}`} onClick={() => { setSkill(k); setShown(PAGE); }}>{k === 'all' ? 'Tất cả' : SKILL_META[k].label}</button>)}</div>
        </div>
        <input className="input lib-search" type="search" placeholder="Tìm theo tên hoặc mã bài (vd. vol5-t6)" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} />
        <ul className="items items--1">
          {items.slice(0, shown).map((m) => (
            <li key={m.id} className="item">
              <div className="item__no" style={{ color: SKILL_META[m.skill].color }}>{SKILL_META[m.skill].label.slice(0, 1)}</div>
              <div className="item__body"><Link to={`/${m.skill}/${m.id}`} className="item__title">{m.title}</Link><div className="item__sub">{subtitle(m)}{m.builtin && ' · mẫu'}{m.source && ` · ${m.source}`}</div></div>
              <button className="icon-btn" onClick={() => exportJson([m], `${m.id}.json`)} aria-label="Xuất"><Download size={16} /></button>
              <button className="icon-btn" onClick={() => confirm(`Xoá "${m.title}"?`) && deleteMaterial(m.id)} aria-label="Xoá"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        {items.length > shown && <button className="btn btn--ghost btn--sm lib-more" onClick={() => setShown((n) => n + PAGE)}>Hiện thêm {Math.min(PAGE, items.length - shown)} bài (còn {items.length - shown})</button>}
        {needle && !items.length && <p className="muted small">Không có bài nào khớp "{q}".</p>}
        {!needle && items.length < SAMPLE_MATERIALS.length && <button className="btn btn--text btn--sm" onClick={restoreSamples}>Khôi phục nội dung mẫu</button>}
      </section>
    </div>
  );
}
