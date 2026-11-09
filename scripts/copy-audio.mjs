// Gom audio từ thư mục Drive đã tải về → public/audio/vol<N>/test<M>/s1..s4.mp3 (nén 64 kbps mono nếu có ffmpeg).
// Dùng: node scripts/copy-audio.mjs "<đường dẫn thư mục gốc đã tải từ Drive>"
// Nhận dạng: thư mục "VOL 1- ORIGINAL EXAMS…/test 3/AudioTrack 02.mp3" hoặc "…/listening/test 3/… part 2.mp3".
import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const src = process.argv[2];
if (!src) { console.error('Thiếu đường dẫn thư mục nguồn'); process.exit(1); }
const ROOT = new URL('..', import.meta.url).pathname;
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const hasWhisper = spawnSync('whisper', ['--help']).status === 0; // pip install openai-whisper → tạo SRT để chép chính tả đúng mốc

function walk(dir, acc = []) {
  for (const f of readdirSync(dir)) { const p = join(dir, f); statSync(p).isDirectory() ? walk(p, acc) : acc.push(p); }
  return acc;
}
let n = 0;
for (const p of walk(src)) {
  if (!/\.(mp3|m4a|wav|wma|aac|ogg|flac)$/i.test(p)) continue;
  const vol = p.match(/VOL\s*(\d+)/i)?.[1];
  const test = [...p.matchAll(/test\s*(\d+)/gi)].pop()?.[1];
  const name = basename(p).replace(/\.[^.]+$/, ''); // bỏ đuôi: ".mp3" chứa "p3" từng bị nhận nhầm là section 3
  const sec = name.match(/(?:track|part|sec\w*|audio|p|s)[\s_-]*0?(\d)\b/i)?.[1]
    ?? name.match(/^0?([1-4])(?:\D|$)/)?.[1]; // "01(1).MP3", "02.MP3"
  if (!vol || !test) { console.log('bỏ qua (không nhận dạng được):', p); continue; }
  const outDir = join(ROOT, 'public', 'audio', `vol${vol}`, `test${test}`);
  mkdirSync(outDir, { recursive: true });
  if (!sec) {
    // File gộp cả 4 section ("test 1.mp3"): cắt theo mốc `cut` trong content/vol<N>/test<M>.json (cần ffmpeg).
    const cj = join(ROOT, 'content', `vol${vol}`, `test${test}.json`);
    if (!existsSync(cj)) { console.log('bỏ qua (không có content để cắt):', p); continue; }
    const secs = JSON.parse(readFileSync(cj, 'utf8')).listening?.sections ?? [];
    if (!secs.every((x) => x.cut != null)) { console.log('bỏ qua (content thiếu "cut"):', p); continue; }
    if (!hasFfmpeg) { console.log('cần ffmpeg để cắt file gộp:', p); continue; }
    const toSec = (v) => typeof v === 'number' ? v : String(v).split(':').reduce((a, b) => a * 60 + +b, 0);
    secs.forEach((x, i) => {
      const out = join(outDir, `s${x.section}.mp3`);
      if (existsSync(out)) return;
      const start = toSec(x.cut); const next = secs[i + 1]; const dur = next ? ` -t ${toSec(next.cut) - start}` : '';
      execSync(`ffmpeg -loglevel error -y -ss ${start}${dur} -i "${p}" -ac 1 -b:a 64k "${out}"`);
      n++; console.log('→', out.replace(ROOT, ''), `(cắt từ ${x.cut})`);
      if (hasWhisper && !existsSync(out.replace(/\.mp3$/, '.srt'))) execSync(`whisper "${out}" --model base --language en --output_format srt --output_dir "${outDir}"`, { stdio: 'ignore' });
    });
    continue;
  }
  const out = join(outDir, `s${sec}.mp3`);
  if (existsSync(out)) continue;
  if (hasFfmpeg) execSync(`ffmpeg -loglevel error -y -i "${p}" -ac 1 -b:a 64k "${out}"`);
  else copyFileSync(p, out);
  n++;
  console.log('→', out.replace(ROOT, ''));
  if (hasWhisper && !existsSync(out.replace(/\.mp3$/, '.srt'))) {
    console.log('   whisper đang tạo SRT…');
    execSync(`whisper "${out}" --model base --language en --output_format srt --output_dir "${outDir}"`, { stdio: 'ignore' });
  }
}
console.log(`Đã xử lý ${n} file audio${hasFfmpeg ? ' (nén 64 kbps)' : ' (copy nguyên bản – cài ffmpeg để nén)'}. Chạy lại: npm run data`);
