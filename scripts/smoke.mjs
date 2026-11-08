// Smoke test bằng Playwright trên bản build (vite preview).
//   npm run build && npm run smoke            (tự bật vite preview ở cổng 4317)
//   BASE_URL=https://phungtrinhuet.github.io/ieltsweb/ npm run smoke   (kiểm tra bản đang chạy)
//   CHROME=/đường/dẫn/chrome npm run smoke    (mặc định: /usr/bin/google-chrome, rồi Chromium của Playwright)
// Fail nếu: trang có pageerror / console error, đồng hồ không chạy, hoặc tái hiện được lỗi đã sửa (A1–A7).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium, devices } from 'playwright-core';

const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const PORT = 4317;
const BASE = (process.env.BASE_URL ?? `http://localhost:${PORT}/`).replace(/\/?$/, '/');
const CHROME = process.env.CHROME ?? ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium', '/usr/bin/chromium'].find(existsSync);

let server;
if (!process.env.BASE_URL) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* chưa lên */ } await new Promise((r) => setTimeout(r, 200)); }
}
const stop = () => { if (server) try { process.kill(-server.pid); } catch { /* đã tắt */ } };

const browser = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const PROFILES = { desktop: { viewport: { width: 1366, height: 900 } }, iphone: devices['iPhone 14'] };

// Giọng máy kiểu Mac/iPhone: nhiều giọng "novelty" đứng đầu danh sách (lỗi A4).
const FAKE_VOICES = `(() => {
  const mk = (name, lang) => ({ name, lang, voiceURI: name, localService: true, default: false });
  const list = [['Albert','en-US'],['Bad News','en-US'],['Bahh','en-US'],['Bubbles','en-US'],['Zarvox','en-US'],['Whisper','en-US'],['Trinoids','en-US'],['Eddy (English (UK))','en-GB'],
    ['Daniel (Enhanced)','en-GB'],['Kate','en-GB'],['Samantha (Compact)','en-US'],['Samantha','en-US'],['Karen','en-AU'],['Google UK English Female','en-GB'],['Google US English','en-US'],
    ['Microsoft Libby Online (Natural) - English (United Kingdom)','en-GB'],['Microsoft Ryan Online (Natural) - English (United Kingdom)','en-GB'],['Amélie','fr-CA']].map(([n,l]) => mk(n,l));
  try { Object.defineProperty(speechSynthesis, 'getVoices', { value: () => list }); } catch {}
})();`;

const results = [];
const log = (ok, name, info = '') => { results.push({ ok, name, info }); console.log(`${ok ? '✓' : '✗'} ${name}${info ? ` – ${info}` : ''}`); };

async function newPage(profile) {
  const ctx = await browser.newContext({ ...PROFILES[profile] });
  await ctx.addInitScript(FAKE_VOICES);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url ?? '';
    // Lỗi mạng tới dịch vụ ngoài (từ điển, dịch…) không phải lỗi của app.
    if (/Failed to load resource/.test(m.text()) && url && !url.startsWith(BASE)) return;
    page.errors.push(`console: ${m.text()} ${url}`);
  });
  return page;
}
async function go(page, hash) {
  await page.goto(`${BASE}#${hash}`);
  await page.waitForSelector('.main', { timeout: 20000 });
  await page.waitForTimeout(500);
}
const timerText = (page, sel = '.timer') => page.locator(sel).first().innerText().catch(() => '');
async function timerRuns(page, sel = '.timer') {
  const a = await timerText(page, sel);
  await page.waitForTimeout(2300);
  const b = await timerText(page, sel);
  return { ok: !!a && a !== b, info: `${a.replace(/\s+/g, ' ')} → ${b.replace(/\s+/g, ' ')}` };
}
const check = async (name, fn) => {
  if (ONLY.length && !ONLY.some((o) => name.toLowerCase().includes(o.toLowerCase()))) return;
  try { const r = await fn(); log(r === undefined || r === true || r?.ok, name, r?.info); }
  catch (e) { log(false, name, e.message.split('\n')[0]); }
};

const ROUTES = ['/', '/reading', '/listening', '/speaking', '/writing', '/vocab', '/library', '/history', '/guide', '/settings',
  '/reading/vol5-t6-r2', '/reading/vol5-t6-r2/practice', '/reading/vol5-t6-r2/study',
  '/listening/vol5-t6-l2', '/listening/vol5-t6-l2/practice', '/listening/vol1-t1-l1/dictation', '/listening/vol1-t1-l1/gapfill', '/listening/vol5-t6-l2/study',
  '/speaking/spk-2023q2-sc1', '/writing/vol1-t2-w2', '/writing/vol1-t2-w1', '/mock/reading', '/mock/listening',
  '/test/reading/vol5-t7', '/test/listening/vol5-t7', '/test/listening/vol5-t7/full', '/test/reading/vol5-t7/full'];

for (const profile of Object.keys(PROFILES)) {
  console.log(`\n== ${profile} ==`);
  const page = await newPage(profile);
  await go(page, '/');

  for (const r of ROUTES) {
    await check(`[${profile}] route ${r}`, async () => {
      page.errors.length = 0;
      await go(page, r);
      const crashed = await page.locator('.crash').count();
      const blank = (await page.locator('.main').innerText()).trim().length < 5;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const errs = [...page.errors];
      return { ok: !errs.length && !crashed && !blank && overflow <= 1, info: [...errs, crashed && 'ErrorBoundary', blank && 'trang trắng', overflow > 1 && `tràn ngang ${overflow}px`].filter(Boolean).join(' | ') };
    });
  }

  // ---------- A1: đổi skill trong Thi thử ghép đề không được trắng trang ----------
  for (const [a, b] of [['listening', 'reading'], ['reading', 'listening']]) {
    await check(`[${profile}] A1 mock ${a} → ${b}`, async () => {
      page.errors.length = 0;
      await go(page, `/mock/${a}`);
      await page.getByRole('button', { name: /Bắt đầu/ }).click();
      await page.waitForTimeout(400);
      await go(page, `/mock/${b}`);
      const blank = (await page.locator('.main').innerText()).trim().length < 5;
      const crashed = await page.locator('.crash').count();
      return { ok: !page.errors.length && !blank && !crashed, info: [...page.errors, blank && 'trắng trang', crashed && 'ErrorBoundary'].filter(Boolean).join(' | ') };
    });
  }

  // ---------- A2: đồng hồ ----------
  await check(`[${profile}] A2 đồng hồ Thi thử Reading tự chạy`, async () => { await go(page, '/reading/vol5-t6-r2'); return timerRuns(page); });
  await check(`[${profile}] A2 đồng hồ Thi thử Listening tự chạy`, async () => { await go(page, '/listening/vol5-t6-l2'); return timerRuns(page); });
  await check(`[${profile}] A2 đồng hồ Thi thử ghép đề chạy sau Bắt đầu`, async () => {
    await go(page, '/mock/reading');
    await page.getByRole('button', { name: /Bắt đầu/ }).click();
    return timerRuns(page);
  });
  await check(`[${profile}] A2 đồng hồ làm cả đề Listening`, async () => {
    await go(page, '/test/listening/vol5-t7/full');
    await page.getByRole('button', { name: /Bắt đầu/ }).click();
    return timerRuns(page);
  });
  await check(`[${profile}] A2 Writing: chạy từ chữ đầu tiên, reset khi đổi bài`, async () => {
    await go(page, '/writing/vol1-t2-w2');
    const before = await timerRuns(page);
    if (before.ok) return { ok: false, info: `chạy trước khi gõ: ${before.info}` };
    await page.locator('.wbox__input').fill('Some people');
    const run = await timerRuns(page);
    if (!run.ok) return run;
    await go(page, '/writing/vol1-t3-w2');
    const t = await timerText(page);
    return { ok: /40:00/.test(t), info: `sang bài khác: ${t}` };
  });
  await check(`[${profile}] A2 cảnh báo 5 phút + hết giờ tự nộp (Reading)`, async () => {
    const p = await newPage(profile);
    await p.clock.install();
    await go(p, '/reading/vol5-t6-r2');
    await p.clock.runFor(1000);
    await p.clock.fastForward('15:05');
    await p.clock.runFor(1500);
    const low = await p.locator('.timer.is-low').count();
    await p.clock.fastForward('05:10');
    await p.clock.runFor(1500);
    const done = await p.locator('.final').count();
    await p.context().close();
    return { ok: low > 0 && done > 0, info: `cảnh báo=${low} tự nộp=${done}` };
  });
  await check(`[${profile}] A2 Speaking Part 2: 1 phút chuẩn bị → 2 phút nói`, async () => {
    const p = await newPage(profile);
    await p.clock.install();
    await go(p, '/speaking/spk-2023q2-sc1');
    await p.getByRole('button', { name: /^Part 2/ }).click();
    await p.getByRole('button', { name: /Chuẩn bị 1 phút/ }).click();
    await p.clock.runFor(2000);
    const a = await timerText(p, '.cue .timer');
    await p.clock.fastForward('01:00');
    await p.clock.runFor(2000);
    const b = await timerText(p, '.cue .timer');
    await p.context().close();
    return { ok: /0:5\d/.test(a) && /1:5\d/.test(b), info: `${a} → ${b}` };
  });

  // ---------- A3: Writing nộp được khi chưa cấu hình AI ----------
  await check(`[${profile}] A3 Writing: Nộp bài không cần AI`, async () => {
    await go(page, '/writing/vol1-t3-w2');
    await page.locator('.wbox__input').fill(Array.from({ length: 60 }, (_, i) => `word${i}`).join(' '));
    const btn = page.getByRole('button', { name: /^Nộp bài/ });
    if (!(await btn.count())) return { ok: false, info: 'không có nút Nộp bài' };
    await btn.first().click();
    await page.waitForTimeout(500);
    const checklist = await page.locator('.selfcheck').count();
    await go(page, '/history');
    const inHistory = await page.getByText(/Test 3 · Task 2/).count();
    return { ok: checklist > 0 && inHistory > 0, info: `checklist=${checklist} lịch sử=${inHistory}` };
  });
  await check(`[${profile}] A3 Speaking: Nộp bài không cần AI`, async () => {
    await go(page, '/speaking/spk-2023q2-sc1');
    await page.getByRole('button', { name: /Hoặc gõ câu trả lời/ }).first().click();
    await page.locator('.turn textarea').first().fill('I live in Hanoi and I really like it because it is lively.');
    await page.locator('.turn textarea').first().blur();
    const btn = page.getByRole('button', { name: /^Nộp bài/ });
    if (!(await btn.count())) return { ok: false, info: 'không có nút Nộp bài' };
    await btn.first().click();
    await page.waitForTimeout(400);
    return { ok: (await page.locator('.selfcheck').count()) > 0 };
  });

  // ---------- A4: giọng đọc ----------
  await check(`[${profile}] A4 Cài đặt chỉ liệt kê giọng tốt`, async () => {
    await go(page, '/settings');
    const opts = await page.locator('select.voice-select option').allInnerTexts();
    const bad = opts.filter((o) => /Albert|Bad News|Bahh|Bubbles|Zarvox|Whisper|Trinoids|Compact|Eddy/i.test(o));
    return { ok: opts.length > 0 && !bad.length && /Natural|Online/.test(opts[1] ?? opts[0]), info: `${opts.length} giọng, đầu: ${opts.slice(0, 3).join(' | ')}${bad.length ? `; lọt: ${bad.join(', ')}` : ''}` };
  });

  // ---------- A5: hình bản đồ / sơ đồ ----------
  for (const [r, sel] of [['/listening/vol3-t1-l2', '.qgroup__img img'], ['/writing/vol1-t2-w1', '.wtask__img, .chart']]) {
    await check(`[${profile}] A5 có hình ở ${r}`, async () => { await go(page, r); return { ok: (await page.locator(sel).count()) > 0 }; });
  }

  // ---------- A7: hướng dẫn không lặp ----------
  await check(`[${profile}] A7 hướng dẫn không lặp giới hạn số từ`, async () => {
    const bad = [];
    for (const r of ['/listening/vol5-t6-l1', '/listening/vol1-t1-l1', '/reading/vol1-t1-r1', '/listening/vol2-t7-l3']) {
      await go(page, r);
      for (const t of await page.locator('.instruction').allInnerTexts()) if (/([A-Z][A-Z ,/-]{8,}[A-Z])\b[\s\S]*\b\1/.test(t)) bad.push(`${r}: ${t}`);
    }
    return { ok: !bad.length, info: bad.slice(0, 2).join(' | ') };
  });

  if (profile === 'desktop') {
    // ---------- A6: đủ câu 1–40 cho mọi đề ----------
    await check('A6 mọi đề đủ câu 1–40 (Reading, Listening)', async () => {
      const idx = await (await fetch(`${BASE}data/index.json`)).json();
      const bad = [];
      for (const f of idx.files.filter((x) => x.vol > 0)) {
        const ms = await (await fetch(`${BASE}data/${f.file}`)).json();
        for (const skill of ['reading', 'listening']) {
          const nos = ms.filter((m) => m.skill === skill).flatMap((m) => m.groups.flatMap((g) => g.questions.flatMap((q) => Array.from({ length: q.type === 'multi' ? Math.max(1, q.answer.length) : 1 }, (_, i) => q.no + i)))).sort((a, b) => a - b);
          if (!nos.length) continue;
          // Câu thiếu ngay trong đề gốc được ghi ở `gaps` (content) → không tính là lỗi.
          const known = (f.gaps ?? []).filter((g) => g.skill === skill).flatMap((g) => g.nos);
          const miss = Array.from({ length: 40 }, (_, i) => i + 1).filter((n) => !nos.includes(n) && !known.includes(n));
          if (miss.length) bad.push(`${f.file} ${skill} thiếu ${miss.join(',')}`);
        }
      }
      return { ok: !bad.length, info: bad.join(' | ') };
    });
    await check('A6 đề thiếu câu trong đề gốc có ghi chú', async () => {
      await go(page, '/reading/vol4-t9-r3');
      const t = await page.locator('.qnote').first().textContent({ timeout: 10000 }).catch(() => '');
      return { ok: /27–29/.test(t ?? ''), info: (t ?? '').slice(0, 60) };
    });
    // ---------- C13: lần mở thứ hai không tải lại toàn bộ dữ liệu ----------
    await check('C13 mở lại app không tải lại 65 file data', async () => {
      const p = await newPage('desktop');
      await go(p, '/');
      let n = 0;
      p.on('request', (r) => { if (/\/data\/(?!index\.json)/.test(r.url())) n++; });
      await p.reload(); await p.waitForSelector('.main'); await p.waitForTimeout(800);
      await p.context().close();
      return { ok: n === 0, info: `${n} request data` };
    });
    await check('C14 trang Tài liệu < 3000 phần tử DOM', async () => {
      await go(page, '/library');
      const n = await page.evaluate(() => document.querySelectorAll('*').length);
      return { ok: n < 3000, info: `${n} phần tử` };
    });
    await check('C15 dòng bài trong danh sách là link', async () => {
      await go(page, '/speaking');
      return { ok: (await page.locator('a.item').count()) > 0 };
    });
  }
  await page.context().close();
}

await browser.close();
stop();
const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} pass${fail.length ? `, ${fail.length} fail:` : ''}`);
for (const f of fail) console.log(`  ✗ ${f.name}${f.info ? ` – ${f.info}` : ''}`);
process.exit(fail.length ? 1 : 0);
