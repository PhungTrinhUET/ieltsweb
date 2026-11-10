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

/** Các dạng biến đổi thường gặp của một từ (số nhiều, quá khứ, -ing) để tìm trong câu. */
function forms(w) {
  const f = new Set([w]);
  const cvc = /[^aeiou][aeiou][bdgklmnprt]$/.test(w) && w.length <= 6;
  f.add(w + 's'); f.add(w + 'es'); f.add(w + 'ed'); f.add(w + 'ing'); f.add(w + 'd');
  if (/[^aeiou]y$/.test(w)) { const b = w.slice(0, -1); f.add(b + 'ies'); f.add(b + 'ied'); }
  if (/e$/.test(w)) { const b = w.slice(0, -1); f.add(b + 'ing'); f.add(b + 'ed'); }
  if (cvc) { const d = w + w.at(-1); f.add(d + 'ed'); f.add(d + 'ing'); }
  return [...f];
}
const tokens = (s) => s.toLowerCase().replace(/[’']/g, "'").match(/[a-z][a-z'-]*/g) ?? [];
/** Chọn tối đa `max` câu/ từ: câu 7–32 từ, mỗi bài một câu, xen Reading/Listening. */
function buildContext(mats, words, max = 5) {
  const S = []; // [mid, text, start?, end?, skill]
  for (const m of mats) {
    if (m.skill === 'reading') for (const p of String(m.passage ?? '').split(/\n+/)) for (const x of sentences(p.replace(/^[A-Z]\s+(?=[A-Z])/, ''))) S.push([m.id, x.trim()]);
    if (m.skill === 'listening') {
      if (m.segments?.length && m.audio) for (const g of m.segments) S.push([m.id, g.text.trim(), g.start, g.end]);
      else for (const line of String(m.transcript ?? '').split('\n')) for (const x of sentences(line.replace(/^[^:]{1,30}:\s*/, ''))) S.push([m.id, x.trim()]);
    }
  }
  const single = new Map(); const phrases = [];
  for (const w of words) {
    const t = tokens(w);
    if (t.length === 1) for (const f of forms(t[0])) { if (!single.has(f)) single.set(f, w); }
    else if (t.length > 1) phrases.push({ w, first: new Set(forms(t[0])), re: new RegExp(`\\b${t.slice(0, -1).join('\\s+')}\\s+(?:${forms(t.at(-1)).join('|')})\\b`, 'i') });
  }
  const hits = new Map();
  S.forEach(([mid, text], i) => {
    const tk = tokens(text);
    if (tk.length < 7 || tk.length > 32) return;
    const found = new Set();
    for (const x of tk) { const w = single.get(x); if (w) found.add(w); }
    const ts = new Set(tk);
    for (const p of phrases) if ([...p.first].some((f) => ts.has(f)) && p.re.test(text)) found.add(p.w);
    for (const w of found) (hits.get(w) ?? hits.set(w, []).get(w)).push(i);
  });
  const used = new Map(); const out = { s: [], w: {} };
  const keep = (i) => { if (!used.has(i)) { used.set(i, out.s.length); const [mid, text, a, b] = S[i]; out.s.push(a != null ? [mid, text, a, b] : [mid, text]); } return used.get(i); };
  for (const w of words) {
    const list = hits.get(w); if (!list) continue;
    // ưu tiên câu dài vừa (12–22 từ), mỗi bài lấy một câu, xen kẽ hai kỹ năng
    const score = (i) => Math.abs(tokens(S[i][1]).length - 17);
    const byMid = new Map();
    for (const i of [...list].sort((a, b) => score(a) - score(b))) if (!byMid.has(S[i][0])) byMid.set(S[i][0], i);
    const r = [...byMid.values()].filter((i) => /-r\d+$/.test(S[i][0])); const l = [...byMid.values()].filter((i) => !/-r\d+$/.test(S[i][0]));
    const pick = [];
    while (pick.length < max && (r.length || l.length)) { if (r.length) pick.push(r.shift()); if (l.length && pick.length < max) pick.push(l.shift()); }
    out.w[w] = pick.map(keep);
  }
  return { data: out, found: Object.keys(out.w).length, missing: words.filter((w) => !out.w[w]) };
}
/** Từ thêm vào chỉ mục ngoài bộ chủ đề (A5: bộ theo đề) – điền ở dưới. */
const EXTRA_CONTEXT_WORDS = [];

// Số câu một câu hỏi chiếm: multi "Choose TWO" có no = số đầu, tính cho answer.length số.
const span = (q) => Array.from({ length: q.type === 'multi' ? Math.max(1, q.answer.length) : 1 }, (_, i) => q.no + i);
const index = [];
const allMats = [];
let total = 0;
for (const vol of readdirSync(CONTENT).filter((d) => d !== 'vocab' && statSync(join(CONTENT, d)).isDirectory())) {
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
      const wid = `${id}-w${w.id ?? w.task}`;
      // Kiểm tra đề Writing: số liệu khớp nhãn, pie tổng 100, ảnh có thật, có đề + bài mẫu.
      for (const [ci, c] of [w.chart, ...(w.charts ?? [])].filter(Boolean).entries()) {
        for (const s of c.series ?? []) {
          if (s.values?.length !== c.labels?.length) console.warn(`⚠ ${wid}: biểu đồ ${ci} series "${s.name}" có ${s.values?.length} số, ${c.labels?.length} nhãn`);
          if (c.kind === 'pie') { const sum = s.values.reduce((a, b) => a + (b ?? 0), 0); if (Math.abs(sum - 100) > 0.51) console.warn(`⚠ ${wid}: pie "${s.name}" tổng ${sum} ≠ 100`); }
        }
      }
      if (w.image && !/^(https?:|idb:|data:)/.test(w.image) && !existsSync(join(ROOT, 'public', w.image))) console.warn(`⚠ ${wid}: thiếu ảnh public/${w.image}`);
      if (!w.prompt?.trim()) console.warn(`⚠ ${wid}: thiếu prompt`);
      if (!w.sample?.trim() && t.vol === 0) console.warn(`⚠ ${wid}: thiếu sample`);
      out.push({ ...base, id: wid, skill: 'writing', module: w.module ?? 'academic', task: w.task, type: w.type, title: `${prefix} · Task ${w.task} – ${w.title}`, topic: w.topic, prompt: w.prompt, chart: w.chart, charts: w.charts, image: w.image, imageAlt: w.imageAlt, sample: w.sample, outline: w.outline, vocab: w.vocab, purpose: w.purpose, tags: [...base.tags, ...(w.tags ?? [])] });
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
    allMats.push(...out);
    const name = `${id}.json`;
    const body = JSON.stringify(out);
    writeFileSync(join(OUT, name), body);
    // `hash`: app chỉ tải lại file có hash đổi (cache trong IndexedDB).
    index.push({ file: name, hash: createHash('sha1').update(body).digest('hex').slice(0, 12), vol: t.vol ?? 0, test: t.test ?? 0, count: out.length, ...(gaps.length ? { gaps: gaps.map((g) => ({ skill: g.skill, nos: g.nos })) } : {}) });
    total += out.length;
  }
}
index.sort((a, b) => a.vol - b.vol || a.test - b.test);
// Bộ từ vựng có sẵn: content/vocab/*.json → public/data/vocab-deck.json (trang Từ vựng tải khi cần).
let vocab;
{
  const dir = join(CONTENT, 'vocab');
  const topics = [];
  const seen = new Map();
  if (existsSync(dir)) for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    for (const t of JSON.parse(readFileSync(join(dir, f), 'utf8')).topics ?? []) {
      for (const w of t.words) {
        if (!Array.isArray(w) || w.length < 3 || w.slice(0, 3).some((x) => typeof x !== 'string' || !x.trim())) console.warn(`⚠ vocab ${t.id}: từ lỗi ${JSON.stringify(w)}`);
        const k = String(w[0]).toLowerCase();
        if (seen.has(k)) console.warn(`⚠ vocab: "${w[0]}" trùng ở ${seen.get(k)} và ${t.id}`);
        seen.set(k, t.id);
      }
      topics.push({ id: t.id, name: t.name, vi: t.vi, words: t.words });
    }
  }
  // A5. Bộ theo đề: 20–30 từ AWL xuất hiện nhiều nhất trong 3 bài Reading của mỗi đề; ví dụ là câu thật trong bài.
  const tests = [];
  const awlPath = join(dir, 'awl.json');
  if (existsSync(awlPath)) {
    const awl = JSON.parse(readFileSync(awlPath, 'utf8'));
    const skip = new Set(awl.skip ?? []);
    const list = awl.words.filter((w) => !skip.has(w[0]));
    // biến thể chính tả Anh–Mỹ: -ise/-ize, -our/-or, licence/license, analyse/analyze
    const variants = (w) => [w, w.replace(/ise$/, 'ize'), w.replace(/our$/, 'or'), w.replace(/ence$/, 'ense'), w.replace(/yse$/, 'yze')];
    const formOf = new Map();
    for (const w of list) for (const v of new Set(variants(w[0]))) for (const f of forms(v)) if (!formOf.has(f)) formOf.set(f, w);
    const byTest = new Map();
    for (const m of allMats) if (m.skill === 'reading' && /-r\d+$/.test(m.id)) { const k = m.id.replace(/-r\d+$/, ''); (byTest.get(k) ?? byTest.set(k, []).get(k)).push(m); }
    for (const [tid, mats] of [...byTest].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
      mats.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      const sents = mats.flatMap((m) => String(m.passage ?? '').split(/\n+/).flatMap((p) => sentences(p.replace(/^[A-Z]\s+(?=[A-Z])/, ''))).map((x) => x.trim()));
      const hit = new Map(); // từ → { w, n, ex, score }
      for (const x of sents) {
        const tk = tokens(x);
        const fit = tk.length >= 7 && tk.length <= 32 ? Math.abs(tk.length - 17) : 99;
        for (const t of tk) {
          const w = formOf.get(t); if (!w) continue;
          const h = hit.get(w[0]) ?? hit.set(w[0], { w, n: 0, ex: '', score: 100 }).get(w[0]);
          h.n++;
          if (fit < 99 && fit < h.score) { h.score = fit; h.ex = x; }
        }
      }
      const ranked = [...hit.values()].filter((h) => h.ex).sort((a, b) => b.n - a.n || a.w[3] - b.w[3]).slice(0, 30);
      if (ranked.length < 12) { console.warn(`⚠ bộ theo đề ${tid}: chỉ ${ranked.length} từ AWL`); continue; }
      const [, v, tn] = tid.match(/^vol(\d+)-t(\d+)$/) ?? [];
      tests.push({ id: tid, name: v ? `VOL ${v} · Test ${tn}` : tid, ref: mats[0].id, words: ranked.sort((a, b) => a.w[3] - b.w[3] || b.n - a.n).map((h) => [h.w[0], h.w[1], h.w[2], h.ex]) });
    }
  }
  if (topics.length) {
    const body = JSON.stringify({ topics, tests });
    writeFileSync(join(OUT, 'vocab-deck.json'), body);
    vocab = { file: 'vocab-deck.json', hash: createHash('sha1').update(body).digest('hex').slice(0, 12), topics: topics.length, words: seen.size, tests: tests.length };
  }
}
// A4. Chỉ mục ngữ cảnh: từ trong bộ từ → câu thật trong bài đọc / transcript (kèm mốc audio nếu có).
//   public/data/context.json = { s: [[materialId, câu, start?, end?]], w: { từ: [chỉ số câu…] } }
let context;
{
  const words = new Set();
  if (vocab) { const d = JSON.parse(readFileSync(join(OUT, 'vocab-deck.json'), 'utf8')); for (const t of [...d.topics, ...(d.tests ?? [])]) for (const w of t.words) words.add(String(w[0]).toLowerCase()); }
  for (const w of EXTRA_CONTEXT_WORDS) words.add(w);
  const r = buildContext(allMats, [...words]);
  const body = JSON.stringify(r.data);
  writeFileSync(join(OUT, 'context.json'), body);
  context = { file: 'context.json', hash: createHash('sha1').update(body).digest('hex').slice(0, 12), words: r.found, sentences: r.data.s.length };
  if (r.missing.length) console.log(`  ngữ cảnh: ${r.missing.length} từ không có câu trong đề (vd. ${r.missing.slice(0, 6).join(', ')})`);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), files: index, ...(vocab ? { vocab } : {}), context }));
console.log(`build-data: ${index.length} test(s), ${total} materials${vocab ? `, ${vocab.words} từ vựng / ${vocab.topics} chủ đề, ${vocab.tests} bộ theo đề` : ''}, ngữ cảnh ${context.words} từ / ${context.sentences} câu → public/data/`);
