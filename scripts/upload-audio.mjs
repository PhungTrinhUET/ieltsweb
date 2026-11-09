// Đẩy public/audio/** (mp3 + srt) lên S3/MinIO rồi ghi content/audio-manifest.json (danh sách file đang có trên bucket).
// Dùng: node scripts/upload-audio.mjs [--force]   (npm run audio:upload)
// Cấu hình trong .env.local (không commit) hoặc biến môi trường:
//   S3_ENDPOINT=https://s3.example.com  S3_ACCESS_KEY=…  S3_SECRET_KEY=…  S3_BUCKET=ieltsweb-audio  [S3_REGION=us-east-1]
// Bucket được tạo nếu chưa có và đặt quyền đọc công khai (GetObject) để <audio> phát trực tiếp.
// Key trên bucket = đường dẫn bỏ tiền tố "audio/": public/audio/vol5/test7/s1.mp3 → vol5/test7/s1.mp3,
// khớp với VITE_AUDIO_BASE=https://s3.example.com/ieltsweb-audio/ trong src/db.ts.
// Không thêm thư viện: tự ký AWS SigV4 bằng node:crypto.
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash, createHmac } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname;
const env = { ...readEnv(join(ROOT, '.env.local')), ...process.env };
const { S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET } = env;
const REGION = env.S3_REGION || 'us-east-1';
const FORCE = process.argv.includes('--force');
if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET) {
  console.error('Thiếu S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET (đặt trong .env.local)'); process.exit(1);
}
const endpoint = new URL(S3_ENDPOINT);

function readEnv(p) {
  if (!existsSync(p)) return {};
  return Object.fromEntries(readFileSync(p, 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]));
}
const sha256 = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** Request S3 path-style có ký SigV4. `key` là đường dẫn object (chưa encode), query là object. */
async function s3(method, key = '', { query = {}, body, headers = {} } = {}) {
  const path = '/' + [S3_BUCKET, ...key.split('/').filter(Boolean)].map(enc).join('/');
  const qs = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join('&');
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = now.slice(0, 8);
  const payloadHash = body ? sha256(body) : sha256('');
  const h = { ...headers, host: endpoint.host, 'x-amz-date': now, 'x-amz-content-sha256': payloadHash };
  const names = Object.keys(h).map((k) => k.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const canonical = [method, path, qs, names.map((k) => `${k}:${lower[k]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${REGION}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', now, scope, sha256(canonical)].join('\n');
  const kSign = ['aws4_request', 's3', REGION, day].reduceRight((k, d) => hmac(k, d), 'AWS4' + S3_SECRET_KEY);
  const sig = createHmac('sha256', kSign).update(toSign).digest('hex');
  delete h.host;
  h.authorization = `AWS4-HMAC-SHA256 Credential=${S3_ACCESS_KEY}/${scope}, SignedHeaders=${names.join(';')}, Signature=${sig}`;
  const url = `${endpoint.origin}${path}${qs ? '?' + qs : ''}`;
  for (let i = 0; ; i++) {
    try { return await fetch(url, { method, headers: h, body }); }
    catch (e) { if (i >= 3) throw e; await new Promise((r) => setTimeout(r, 2000 * 2 ** i)); }
  }
}
async function must(res, what) {
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

// 1. Bucket + quyền đọc công khai.
const head = await s3('HEAD');
if (head.status === 404) { await must(await s3('PUT'), 'tạo bucket'); console.log('Đã tạo bucket', S3_BUCKET); }
else await must(head, 'kiểm tra bucket');
const policy = JSON.stringify({ Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${S3_BUCKET}/*`] }] });
await must(await s3('PUT', '', { query: { policy: '' }, body: policy, headers: { 'content-type': 'application/json' } }), 'đặt policy đọc công khai');

// 2. Đẩy file (bỏ qua file đã có cùng kích thước, trừ khi --force).
async function listAll() {
  const out = new Map(); let token;
  do {
    const q = { 'list-type': '2', 'max-keys': '1000' }; if (token) q['continuation-token'] = token;
    const xml = await (await must(await s3('GET', '', { query: q }), 'liệt kê bucket')).text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const k = m[1].match(/<Key>(.*?)<\/Key>/)[1].replace(/&amp;/g, '&');
      out.set(k, +m[1].match(/<Size>(\d+)<\/Size>/)[1]);
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/)?.[1] : undefined;
  } while (token);
  return out;
}
const remote = await listAll();
const AUDIO = join(ROOT, 'public', 'audio');
const walk = (d, acc = []) => { if (existsSync(d)) for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p, acc) : acc.push(p); } return acc; };
const TYPES = { mp3: 'audio/mpeg', srt: 'application/x-subrip', vtt: 'text/vtt' };
let up = 0, skip = 0;
for (const p of walk(AUDIO)) {
  const ext = p.split('.').pop().toLowerCase();
  if (!TYPES[ext]) continue;
  const key = relative(AUDIO, p).split(sep).join('/');
  const size = statSync(p).size;
  if (!FORCE && remote.get(key) === size) { skip++; continue; }
  await must(await s3('PUT', key, { body: readFileSync(p), headers: { 'content-type': TYPES[ext], 'cache-control': 'public, max-age=604800' } }), `đẩy ${key}`);
  remote.set(key, size); up++;
  console.log('↑', key, `(${(size / 1024).toFixed(0)} KB)`);
}

// 3. Manifest cho build-data: bài nào có audio trên bucket thì vẫn được gắn `audio` dù máy build không có file.
const files = [...remote.keys()].filter((k) => /\.(mp3|srt|vtt)$/i.test(k)).sort().map((k) => `audio/${k}`);
writeFileSync(join(ROOT, 'content', 'audio-manifest.json'), JSON.stringify({ base: `${endpoint.origin}/${S3_BUCKET}/`, files }, null, 1) + '\n');
console.log(`Đẩy ${up} file, bỏ qua ${skip} file trùng. Bucket có ${files.length} file → content/audio-manifest.json`);
console.log(`Đặt VITE_AUDIO_BASE=${endpoint.origin}/${S3_BUCKET}/ (file .env) rồi npm run data / build.`);
