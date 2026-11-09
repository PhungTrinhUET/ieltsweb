// Chuyển content/<vol>/<test>.json (đề gốc đã bóc tách) → public/data/*.json (Material của app) + public/data/index.json.
// Chạy: node scripts/build-data.mjs   (tự chạy trước `npm run dev` / `npm run build`)
// Audio: đặt mp3 vào public/<audioDir>/s1.mp3 … s4.mp3 (xem scripts/copy-audio.mjs). Thiếu file → bài dùng giọng máy.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname;
const CONTENT = join(ROOT, 'content');
// Audio đã đẩy lên S3/MinIO (npm run audio:upload): máy build không cần có file mp3 trong public/audio.
const AUDIO_MANIFEST = new Set(existsSync(join(CONTENT, 'audio-manifest.json')) ? JSON.parse(readFileSync(join(CONTENT, 'audio-manifest.json'), 'utf8')).files : []);
const OUT = join(ROOT, 'public', 'data');
mkdirSync(OUT, { recursive: true });

const ts = (s) => { const [m, sec] = s.split(':').map(Number); return m * 60 + sec; };
const ABBR = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|No)\.$/i;
function sentences(text) {
  const out = []; let buf = '';
  for (const p of text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…]["”’)]?)\s+(?=["“‘(]?[A-Z0-9])/)) {
    buf = buf ? `${buf} ${p}` : p;
    if (ABBR.test(buf) || /\b\d+\.$/.test(buf)) continue;
    out.push(buf); buf = '';
  }
  if (buf) out.push(buf);
  return out;
}

/** "[mm:ss] Speaker: text" mỗi dòng → { transcript, segments } (giây tính từ đầu file section). */
function parseTimed(raw, offset) {
  const turns = raw.split('\n').map((l) => l.match(/^\[(\d+:\d{2})\]\s*([^:]+):\s*(.*)$/)).filter(Boolean)
    .map((m) => ({ t: ts(m[1]) - offset, speaker: m[2].trim(), text: m[3].trim() }));
  const segments = [];
  turns.forEach((u, i) => {
    const next = turns[i + 1]?.t ?? u.t + Math.max(4, u.text.length / 14);
    const sents = sentences(u.text);
    const total = sents.reduce((n, s) => n + s.length, 0) || 1;
    let cur = Math.max(0, u.t);
    for (const s of sents) {
      const dur = ((next - u.t) * s.length) / total;
      segments.push({ start: +cur.toFixed(1), end: +(cur + dur).toFixed(1), text: s, speaker: u.speaker });
      cur += dur;
    }
  });
  return { transcript: turns.map((u) => `${u.speaker}: ${u.text}`).join('\n'), segments };
}

/** Kiểm tra nhanh câu hỏi: số thứ tự, chỉ số đáp án nằm trong options/bank. */
function validate(id, groups) {
  const seen = new Set();
  for (const g of groups) for (const q of g.questions) {
    if (seen.has(q.no)) console.warn(`⚠ ${id}: câu ${q.no} trùng số`);
    seen.add(q.no);
    if (q.type === 'mcq' && (q.answer < 0 || q.answer >= q.options.length)) console.warn(`⚠ ${id}: câu ${q.no} đáp án ngoài options`);
    if (q.type === 'multi' && q.answer.some((a) => a < 0 || a >= q.options.length)) console.warn(`⚠ ${id}: câu ${q.no} đáp án ngoài options`);
    if (q.type === 'match') { const bank = q.options ?? g.bank ?? []; if (q.answer < 0 || q.answer >= bank.length) console.warn(`⚠ ${id}: câu ${q.no} đáp án ngoài bank`); }
    if (q.type === 'fill' && !/_{3,}/.test(q.text)) console.warn(`⚠ ${id}: câu ${q.no} thiếu ___`);
  }
  // Bảng (layout "table"): mỗi câu của nhóm xuất hiện đúng một lần dạng {{n}}, không có {{n}} lạ; số ô mỗi hàng = số cột.
  for (const g of groups) {
    if (g.layout === 'table' && !g.table) console.warn(`⚠ ${id}: layout "table" nhưng thiếu table`);
    if (!g.table) continue;
    const cells = g.table.rows.flat().join(' ');
    const refs = [...cells.matchAll(/\{\{(\d+)\}\}/g)].map((m) => +m[1]);
    const nos = g.questions.map((q) => q.no);
    for (const n of nos) { const c = refs.filter((r) => r === n).length; if (c !== 1) console.warn(`⚠ ${id}: bảng có {{${n}}} ${c} lần`); }
    for (const r of refs) if (!nos.includes(r)) console.warn(`⚠ ${id}: bảng có {{${r}}} không thuộc nhóm`);
    const w = g.table.columns?.length;
    if (w) g.table.rows.forEach((row, i) => { if (row.length !== w) console.warn(`⚠ ${id}: bảng hàng ${i + 1} có ${row.length} ô, cần ${w}`); });
  }
}
/** SRT/VTT đặt cạnh audio (public/audio/.../s1.srt) được ưu tiên hơn mốc ước lượng. */
function parseSrt(text) {
  const ts = (s) => { const m = s.trim().match(/(\d+):(\d+):(\d+)[.,](\d+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, '0') / 1000 : 0; };
  return text.replace(/\r/g, '').replace(/^WEBVTT[^\n]*\n/, '').split(/\n\s*\n/).map((b) => {
    const lines = b.split('\n').filter((l) => l.trim()); const ti = lines.findIndex((l) => l.includes('-->')); if (ti === -1) return null;
    const [a, c] = lines[ti].split('-->'); const t = lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    return t ? { start: ts(a), end: ts(c), text: t } : null;
  }).filter(Boolean);
}

// Số câu một câu hỏi chiếm: multi "Choose TWO" có no = số đầu, tính cho answer.length số.
const span = (q) => Array.from({ length: q.type === 'multi' ? Math.max(1, q.answer.length) : 1 }, (_, i) => q.no + i);
const index = [];
let total = 0;
for (const vol of readdirSync(CONTENT).filter((d) => statSync(join(CONTENT, d)).isDirectory())) {
  for (const f of readdirSync(join(CONTENT, vol)).filter((x) => x.endsWith('.json'))) {
    const t = JSON.parse(readFileSync(join(CONTENT, vol, f), 'utf8'));
    const id = t.id ?? `${vol}-t${t.test}`;
    const src = t.source ?? `VOL ${t.vol} Test ${t.test}`;
    const prefix = t.prefix ?? `VOL ${t.vol} Test ${t.test}`;
    const base = { source: src, builtin: true, addedAt: 1_600_000_000_000 + (t.vol ?? 0) * 1e8 + (t.test ?? 0) * 1e6, tags: t.tags ?? [`VOL ${t.vol}`, `Test ${t.test}`] };
    const out = [];
    for (const s of t.listening?.sections ?? []) {
      // `cut`: mốc bắt đầu section trong file mp3 gộp cả bài (m:ss) → mốc transcript được dời về 0 cho file s<N>.mp3 đã cắt.
      const toSec = (v) => typeof v === 'number' ? v : String(v).split(':').reduce((a, b) => a * 60 + +b, 0);
      const offset = s.cut != null ? toSec(s.cut) : (s.offset ?? 0);
      let { transcript, segments } = parseTimed(s.transcript ?? '', offset);
      const audioRel = `${t.listening.audioDir}/s${s.section}.mp3`;
      const hasAudio = existsSync(join(ROOT, 'public', audioRel)) || AUDIO_MANIFEST.has(audioRel);
      const srtPath = join(ROOT, 'public', audioRel.replace(/\.mp3$/, '.srt'));
      const segs = existsSync(srtPath) ? parseSrt(readFileSync(srtPath, 'utf8')) : segments;
      if (!transcript.trim()) {
        // Tài liệu gốc thiếu transcript: lấy từ SRT (whisper) nếu có, không thì ghi chú.
        transcript = existsSync(srtPath) ? segs.map((x) => x.text).join(' ') : (s.transcriptNote ?? 'Transcript chưa có trong tài liệu gốc. Chạy `npm run audio` (có cài whisper) để tự tạo từ file mp3.');
      }
      validate(`${id}-l${s.section}`, s.groups);
      out.push({ ...base, id: `${id}-l${s.section}`, skill: 'listening', title: `${prefix} · Section ${s.section} – ${s.title}`, topic: s.topic, section: s.section, level: s.section <= 2 ? 'medium' : 'hard',
        transcript, segments: hasAudio ? segs : undefined, audio: hasAudio ? audioRel : undefined, groups: s.groups, voice: 'en-GB' });
    }
    for (const r of t.reading ?? []) {
      validate(`${id}-r${r.passage}`, r.groups);
      out.push({ ...base, id: `${id}-r${r.passage}`, skill: 'reading', module: 'academic', title: `${prefix} · Passage ${r.passage} – ${r.title}`, topic: r.topic, level: r.level ?? 'medium', passage: r.passage_text, groups: r.groups, minutes: 20 });
    }
    for (const w of t.writing ?? []) {
      out.push({ ...base, id: `${id}-w${w.id ?? w.task}`, skill: 'writing', module: w.module ?? 'academic', task: w.task, type: w.type, title: `${prefix} · Task ${w.task} – ${w.title}`, topic: w.topic, prompt: w.prompt, chart: w.chart, image: w.image, imageAlt: w.imageAlt, sample: w.sample, outline: w.outline });
    }
    (t.speaking ?? []).forEach((sp, i) => {
      out.push({ ...base, id: `${id}-s${sp.id ?? i + 1}`, skill: 'speaking', title: `${prefix} · ${sp.title}`, topic: sp.topic, level: sp.level ?? 'medium',
        part1: sp.part1, part2: sp.part2, part3: sp.part3, vocab: sp.vocab, tags: [...base.tags, ...(sp.tags ?? [])] });
    });
    // `gaps`: câu thiếu ngay trong đề gốc (đã ghi rõ lý do) → gắn ghi chú vào bài, và không báo ⚠.
    const gaps = t.gaps ?? [];
    for (const g of gaps) {
      const m = out.find((x) => x.id === `${id}-${g.skill === 'reading' ? 'r' : 'l'}${g.passage ?? g.section}`);
      if (m) m.note = [m.note, g.note].filter(Boolean).join(' ');
      else console.warn(`⚠ ${id}: gaps trỏ tới bài không tồn tại (${g.skill} ${g.passage ?? g.section})`);
    }
    if (t.vol) for (const skill of ['reading', 'listening']) {
      const nos = new Set(out.filter((m) => m.skill === skill).flatMap((m) => m.groups.flatMap((g) => g.questions.flatMap(span))));
      if (!nos.size) continue;
      const known = new Set(gaps.filter((g) => g.skill === skill).flatMap((g) => g.nos));
      const miss = Array.from({ length: 40 }, (_, i) => i + 1).filter((n) => !nos.has(n) && !known.has(n));
      if (miss.length) console.warn(`⚠ ${id} ${skill}: thiếu câu ${miss.join(',')} (thêm câu hoặc ghi vào "gaps")`);
    }
    const name = `${id}.json`;
    const body = JSON.stringify(out);
    writeFileSync(join(OUT, name), body);
    // `hash`: app chỉ tải lại file có hash đổi (cache trong IndexedDB).
    index.push({ file: name, hash: createHash('sha1').update(body).digest('hex').slice(0, 12), vol: t.vol ?? 0, test: t.test ?? 0, count: out.length, ...(gaps.length ? { gaps: gaps.map((g) => ({ skill: g.skill, nos: g.nos })) } : {}) });
    total += out.length;
  }
}
index.sort((a, b) => a.vol - b.vol || a.test - b.test);
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), files: index }));
console.log(`build-data: ${index.length} test(s), ${total} materials → public/data/`);
