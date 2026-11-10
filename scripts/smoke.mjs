// Smoke test bằng Playwright trên bản build (vite preview).
//   npm run build && npm run smoke            (tự bật vite preview ở cổng 4317)
//   BASE_URL=https://ielts.lionelphung.id.vn/ npm run smoke   (kiểm tra bản đang chạy)
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
// Đồng hồ khung thi chỉ hiện phút ("59 minutes left") → đọc số giây ở data-left.
const timerText = (page, sel = '.timer') => page.locator(sel).first().evaluate((e) => e.dataset.left ?? e.innerText).catch(() => '');
/** Điện thoại: ô viết Writing nằm ở tab thứ hai của khung thi. */
async function answerTab(page) {
  const t = page.locator('.xtabs .tabs__btn').nth(1);
  if (await t.isVisible().catch(() => false)) await t.click();
}
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
  '/vocab/learn', '/vocab/review', '/vocab/context', '/stats', '/dictation', '/dictation?level=3', '/dictation/gen%3Aphone', '/speaking/spk-2023q2-sc1', '/writing/vol1-t2-w2', '/writing/vol1-t2-w1', '/mock/reading', '/mock/listening',
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
    await page.getByRole('button', { name: 'Start test' }).click();
    return timerRuns(page);
  });
  await check(`[${profile}] A2 đồng hồ làm cả đề Listening`, async () => {
    await go(page, '/test/listening/vol5-t7/full');
    await page.getByRole('button', { name: 'Start test' }).click();
    return timerRuns(page);
  });
  await check(`[${profile}] B8 duyệt VOL → Test, làm cả đề lưu một lần, hiện điểm từng phần`, async () => {
    await go(page, '/reading');
    const vols = await page.locator('details.vol').count();
    await page.locator('a.item--test', { hasText: 'VOL 1 · Test 2' }).first().click();
    await page.waitForTimeout(400);
    if (!/#\/test\/reading\/vol1-t2$/.test(page.url())) return { ok: false, info: `url ${page.url()}` };
    await page.locator('.fullmodes a[href$="/full"]').click();
    await page.getByRole('button', { name: 'Start test' }).click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Nộp bài' }).click();
    await page.waitForSelector('.final');
    await go(page, '/history');
    const hist = await page.getByText(/VOL 1 · Test 2 – cả đề/).count();
    await go(page, '/test/reading/vol1-t2');
    const marked = await page.locator('.item--part.item--wrong, .item--part.item--done').count();
    return { ok: vols >= 5 && hist === 1 && marked === 3, info: `vol=${vols} lịch sử=${hist} phần có điểm=${marked}` };
  });
  await check(`[${profile}] K1 sao lưu → xoá IndexedDB → nhập (Gộp) đủ số, nhập lần 2 không nhân đôi`, async () => {
    const ctx = await browser.newContext({ ...PROFILES[profile], acceptDownloads: true });
    const p = await ctx.newPage();
    const idb = (fn, arg) => p.evaluate(([src, a]) => new Promise((res, rej) => {
      const r = indexedDB.open('ielts-practice', 3);
      r.onsuccess = () => { const d = r.result; Promise.resolve(new Function('d', 'a', src)(d, a)).then((v) => { d.close(); res(v); }, rej); };
      r.onerror = () => rej(r.error);
    }), [fn, arg]);
    const putAll = `const t = d.transaction(['attempts','vocab','drafts','kv'], 'readwrite');
      t.objectStore('attempts').put({ id: 'bk1', at: Date.now(), skill: 'reading', mode: 'test', materialId: 'vol5-t6-r2', title: 'Backup test', score: 5, max: 13 }, 'bk1');
      t.objectStore('vocab').put({ id: 'c-bk', word: 'resilient', meaning: 'kiên cường', addedAt: Date.now(), due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0 }, 'c-bk');
      t.objectStore('drafts').put('My draft essay text', 'writing:wr-t2-op1');
      t.objectStore('kv').put({ id: 'bk', name: 'Bộ sao lưu', words: [{ word: 'resilient', pos: 'adj', vi: 'kiên cường' }], at: Date.now() }, 'udeck:bk');
      return new Promise((r) => { t.oncomplete = () => r(1); });`;
    const count = `const st = ['attempts','vocab','drafts','kv']; return Promise.all(st.map((s) => new Promise((r) => { const q = d.transaction(s).objectStore(s).getAllKeys(); q.onsuccess = () => r(q.result.filter((k) => !String(k).startsWith('meta:')).length); })));`;
    await p.goto(`${BASE}#/`); await p.waitForSelector('.main', { timeout: 20000 });
    await idb(putAll);
    await p.goto(`${BASE}#/settings`); await p.reload(); await p.waitForSelector('[data-testid="bk-export"]');
    const before = await idb(count);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('[data-testid="bk-export"]').click()]);
    const file = await dl.path();
    await p.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase('ielts-practice'); q.onsuccess = q.onerror = q.onblocked = () => r(0); }));
    await p.reload(); await p.waitForSelector('[data-testid="bk-file"]', { state: 'attached' });
    const cleared = await idb(count);
    const imp = async () => {
      await p.locator('[data-testid="bk-file"]').setInputFiles(file);
      await p.waitForSelector('[data-testid="bk-sum"]');
      await p.locator('[data-testid="bk-merge"]').click();
      await p.waitForSelector('[data-testid="bk-msg"]');
      await p.waitForTimeout(300);
      return idb(count);
    };
    const after1 = await imp();
    const after2 = await imp();
    const hist = await (async () => { await p.goto(`${BASE}#/history`); await p.waitForTimeout(600); return p.locator('[data-testid="hlist"] a.item').count(); })();
    await ctx.close();
    const same = (a, b) => a.join() === b.join();
    return { ok: before.every((n) => n >= 1) && cleared.every((n) => n === 0) && same(before, after1) && same(after1, after2) && hist === before[0], info: `trước=${before} sau xoá=${cleared} nhập1=${after1} nhập2=${after2} lịch sử=${hist} (attempts,vocab,drafts,kv)` };
  });
  await check(`[${profile}] H1 nộp Reading → Lịch sử → xem lại câu trả lời + đáp án`, async () => {
    await go(page, '/reading/vol5-t6-r2');
    const start = page.getByRole('button', { name: 'Start test' });
    if (await start.count()) await start.click();
    await page.waitForTimeout(300);
    const radio = page.locator('.exam input[type=radio]').first();
    await radio.evaluate((e) => e.closest('label')?.click() ?? e.click());
    const picked = await radio.isChecked();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Nộp bài' }).click();
    await page.waitForTimeout(600);
    await go(page, '/history');
    await page.locator('[data-testid="hlist"] a.item').first().click();
    await page.waitForSelector('[data-testid="hdetail"]');
    const rows = await page.locator('[data-testid="hd-table"] tbody tr').count();
    const answered = await page.locator('[data-testid="hd-table"] .hd-you:not(:has(.muted))').count();
    const keys = (await page.locator('[data-testid="hd-table"] .hd-key').allInnerTexts()).filter((t) => t.trim()).length;
    const redo = await page.locator('[data-testid="hd-redo"]').getAttribute('href');
    return { ok: rows >= 10 && keys === rows && picked && answered === 1 && /vol5-t6-r2/.test(redo ?? ''), info: `câu=${rows} đáp án=${keys} đã chọn=${picked} hiện câu trả lời=${answered} làm lại=${redo}` };
  });
  await check(`[${profile}] B9 lọc theo dạng bài + VOL, chip dạng trên trang đề`, async () => {
    await go(page, '/listening');
    await page.locator('.fchip', { hasText: /^3$/ }).click();
    await page.locator('.fchip', { hasText: 'Map / Plan / Diagram' }).click();
    await page.waitForTimeout(200);
    const rows = await page.locator('.items a.item').allInnerTexts();
    const okRows = rows.length > 0 && rows.every((t) => /VOL 3/.test(t) && /Map \/ Plan \/ Diagram/.test(t));
    await page.locator('.fchip', { hasText: 'MCQ một đáp án' }).click();
    const more = await page.locator('.items a.item').count();
    await go(page, '/test/reading/vol5-t7');
    const chips = await page.locator('.item--part .kchip').count();
    return { ok: okRows && more > rows.length && chips >= 6, info: `map VOL3=${rows.length} +mcq=${more} chip=${chips}` };
  });

  await check(`[${profile}] C16 câu điền Listening gọn (nút xem đáp án nằm trong dòng)`, async () => {
    await go(page, '/listening/vol1-t1-l4/practice');
    const fills = page.locator('.qgroup .q:has(.qtext--fill)');
    const n = await fills.count();
    const rows = await page.locator('.qgroup .q:has(.qtext--fill) .q__check').count();
    const h = await fills.first().evaluate((e) => e.getBoundingClientRect().height);
    await fills.first().locator('.q__peek').click();
    const shown = await page.locator('#q-31.q--no, #q-31.q--ok').count();
    return { ok: n >= 5 && rows === 0 && shown === 1 && h < 80, info: `fill=${n} dòng nút=${rows} cao=${Math.round(h)}px hiện=${shown}` };
  });

  await check(`[${profile}] D1 Luyện tập cả đề bên cạnh Thi thử, chuyển Passage trong lúc luyện`, async () => {
    await go(page, '/test/reading/vol5-t6');
    const both = (await page.locator('.fullmodes a[href$="/practice"]').count()) === 1 && (await page.locator('.fullmodes a[href$="/full"]').count()) === 1;
    await page.locator('.fullmodes a[href$="/practice"]').click(); await page.waitForTimeout(400);
    const u1 = page.url();
    const tabs = await page.locator('.parttabs .xnav__part').count();
    await page.locator('.parttabs .xnav__part:not(.is-on)').first().click(); await page.waitForTimeout(400);
    const u2 = page.url();
    await page.locator('.xhead .xbtn--exit').click(); await page.waitForTimeout(400);
    const u3 = page.url();
    await go(page, '/reading/vol5-t6-r2');
    const sw = await page.locator('.xhead .mode-switch').count();
    await go(page, '/listening/vol5-t6-l2');
    const swL = await page.locator('.xhead .mode-switch').count();
    return { ok: both && u1.endsWith('vol5-t6-r1/practice') && tabs === 3 && u2.endsWith('vol5-t6-r2/practice') && u3.endsWith('/test/reading/vol5-t6') && sw === 1 && swL === 1,
      info: `2 nút=${both} tabs=${tabs} ${u1.split('#')[1]} → ${u2.split('#')[1]} → ${u3.split('#')[1]} switch R/L=${sw}/${swL}` };
  });
  await check(`[${profile}] D2 tra từ: phiên âm + nghĩa Anh (Datamuse), nghĩa Việt đúng dấu phẩy`, async () => {
    await page.route(/api\.datamuse\.com/, (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify([{ word: new URL(r.request().url()).searchParams.get('sp'), tags: ['ipa_pron:tˈɛst'], defs: ['n\ta procedure for testing'] }]) }));
    await page.route(/api\.mymemory\.translated\.net/, (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ responseStatus: 200, responseData: { translatedText: 'tơ ,lụa' }, matches: [] }) }));
    await go(page, '/reading/vol1-t1-r1/practice');
    if (profile === 'iphone') await page.locator('.tabs--mobile .tabs__btn').first().click();
    await page.locator('.passage .w, .passage [data-w]').nth(5).click();
    await page.waitForSelector('.wpop', { timeout: 5000 });
    await page.waitForTimeout(800);
    const head = await page.locator('.wpop__head').innerText();
    const body = await page.locator('.wpop').innerText();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    return { ok: /\/tˈɛst\//.test(head) && /procedure for testing/.test(body) && /tơ, lụa/.test(body), info: `${head.replace(/\s+/g, ' ')} | ${body.replace(/\s+/g, ' ').slice(0, 120)}` };
  });

  await check(`[${profile}] B10 bảng/form/flowchart gọn như đề giấy`, async () => {
    await go(page, '/listening/vol1-t2-l4/practice');
    const blanks = await page.locator('table.qtable .tblank input').count();
    await page.locator('table.qtable .tblank input').first().fill('xyz');
    await page.getByRole('button', { name: /Kiểm tra các câu trong bảng/ }).click();
    const marked = await page.locator('table.qtable .tblank.is-no').count();
    const notes = await page.locator('.qtable-notes .q').count();
    await go(page, '/listening/vol1-t6-l1/practice');
    const paper = await page.locator('.paper').count();
    await go(page, '/listening/vol5-t1-l4/practice');
    const flow = await page.locator('.flowc__step').count();
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    return { ok: blanks >= 5 && marked >= 1 && notes >= blanks && paper > 0 && flow > 0 && sw, info: `blank=${blanks} sai=${marked} notes=${notes} paper=${paper} flow=${flow} noHScroll=${sw}` };
  });

  await check(`[${profile}] B11 chủ đề gom ≤ 12 nhóm, Speaking theo cue card`, async () => {
    const res = {};
    for (const s of ['reading', 'listening', 'writing', 'speaking']) {
      await go(page, `/${s}`);
      const tabs = await page.locator('.srow .tabs__btn').allInnerTexts();
      res[s] = tabs.length - 1;
      if (new Set(tabs.map((t) => t.replace(/\d+/g, '').trim().toLowerCase())).size !== tabs.length) return { ok: false, info: `${s} trùng tab: ${tabs.join('|')}` };
    }
    await page.locator('.srow .tabs__btn', { hasText: 'Người' }).click();
    const want = +(await page.locator('.srow .tabs__btn.is-on small').innerText());
    const got = await page.locator('.items a.item, .items .item').count();
    const ok = Object.values(res).every((n) => n >= 4 && n <= 12) && want > 10 && got === want;
    return { ok, info: `${JSON.stringify(res)} Người=${got}/${want}` };
  });

  await check(`[${profile}] A2 Writing: chạy từ chữ đầu tiên, reset khi đổi bài`, async () => {
    await go(page, '/writing/vol1-t2-w2');
    const before = await timerRuns(page);
    if (before.ok) return { ok: false, info: `chạy trước khi gõ: ${before.info}` };
    await answerTab(page); await page.locator('.wbox__input').fill('Some people');
    const run = await timerRuns(page);
    if (!run.ok) return run;
    await go(page, '/writing/vol1-t3-w2');
    const t = await timerText(page);
    return { ok: t === '2400', info: `sang bài khác: còn ${t} giây` };
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

  // ---------- E: Từ vựng (FSRS, học theo nhóm, ôn tự chấm) ----------
  await check(`[${profile}] E1 Từ vựng: trang chính có bộ từ, Hôm nay, câu trong đề`, async () => {
    await go(page, '/vocab');
    await page.waitForSelector('[data-testid="deck"]', { timeout: 8000 });
    const decks = await page.locator('[data-testid="deck"]').count();
    const today = await page.locator('[data-testid="vocab-learn"]').count();
    return { ok: decks >= 10 && today === 1, info: `bộ=${decks}` };
  });
  /** Làm hết một phiên học/ôn: trả lời đúng mọi bước (đúng theo data-right / data-target). */
  const runSession = async (p, wrongFirst = 0) => {
    let steps = 0, wrong = wrongFirst; const kinds = new Set();
    for (; steps < 200; steps++) {
      if (await p.locator('[data-testid="vx-summary"], [data-testid="ctx-passage"]').count()) break;
      const vx = p.locator('[data-testid="vx"]');
      await vx.waitFor({ timeout: 5000 });
      const step = await vx.getAttribute('data-step'); kinds.add(step);
      if (step === 'intro') { await p.getByRole('button', { name: /Đã nhớ, tiếp/ }).click(); await p.waitForTimeout(80); continue; }
      if (await p.locator('.lt-opt').count()) {
        if (wrong > 0) { wrong--; await p.locator('.lt-opt:not([data-right])').first().click(); await p.getByRole('button', { name: /Tiếp/ }).click(); }
        else { await p.locator('.lt-opt[data-right]').click(); await p.waitForTimeout(1000); }
      } else {
        const target = await p.locator('.lt-type').getAttribute('data-target');
        const inp = p.locator('.lt-type input, .lt-type textarea');
        await inp.fill(target); await inp.press('Enter');
        await p.getByRole('button', { name: /Tiếp/ }).click();
      }
      await p.waitForTimeout(80);
    }
    return { steps, kinds: [...kinds].join(',') };
  };
  await check(`[${profile}] E2 học trọn một nhóm từ mới (các bước xen kẽ, sai → làm lại) → đoạn ngữ cảnh → Ôn tập`, async () => {
    page.errors.length = 0;
    await go(page, '/vocab/learn?more=1');
    const r = await runSession(page, 1);
    await page.waitForSelector('[data-testid="ctx-passage"]', { timeout: 5000 });
    const gap = await page.locator('.ctx-gap__sel').count();
    for (let i = 0; i < gap; i++) { const sel = page.locator('.ctx-gap__sel').nth(i); const opts = await sel.locator('option').allInnerTexts(); await sel.selectOption(opts[1]); }
    await page.getByRole('button', { name: gap ? 'Kiểm tra' : /Bỏ qua|Xong/ }).first().click();
    if (gap) await page.getByRole('button', { name: 'Xong' }).click();
    await page.waitForSelector('[data-testid="vx-summary"]', { timeout: 5000 });
    const learned = await page.locator('.lt-learned li').count();
    const inReview = await page.locator('.lt-learned .st--review').count();
    return { ok: learned === 6 && inReview === 6 && r.kinds.split(',').length >= 5 && !page.errors.length, info: `bước=${r.steps} dạng=${r.kinds} câu ghép=${gap} từ=${learned} ôn tập=${inReview} ${page.errors.join(' | ')}` };
  });
  await check(`[${profile}] E3 thẻ Leitner cũ được chuyển sang FSRS + ôn 10 thẻ tự chấm`, async () => {
    page.errors.length = 0;
    await go(page, '/vocab');
    // 12 thẻ kiểu cũ (hộp 1–5, chưa có stability), đến hạn hôm qua.
    await page.evaluate(() => new Promise((res, rej) => {
      const words = [['abundant', 'dồi dào'], ['scarce', 'khan hiếm'], ['mitigate', 'giảm nhẹ'], ['deteriorate', 'xấu đi'], ['substantial', 'đáng kể'], ['vulnerable', 'dễ bị tổn thương'],
        ['sustainable', 'bền vững'], ['inevitable', 'không tránh khỏi'], ['diverse', 'đa dạng'], ['crucial', 'cốt yếu'], ['emission', 'khí thải'], ['habitat', 'môi trường sống']];
      const r = indexedDB.open('ielts-practice', 3);
      r.onsuccess = () => {
        const t = r.result.transaction('vocab', 'readwrite'); const s = t.objectStore('vocab');
        words.forEach(([w, m], i) => s.put({ id: `old-${w}`, word: w, meaning: m, pos: 'adj', example: `It is ${w}.`, addedAt: Date.now() - 20 * 864e5, due: Date.now() - 864e5, interval: 2, ease: 2.5, reps: 3, lapses: 0, box: 1 + (i % 5), learnedAt: Date.now() - 10 * 864e5 }, `old-${w}`));
        t.oncomplete = () => { r.result.close(); res(); }; t.onerror = () => rej(t.error);
      };
      r.onerror = () => rej(r.error);
    }));
    await page.reload(); await page.waitForSelector('[data-testid="vocab-today"]');
    const migrated = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('ielts-practice', 3); r.onsuccess = () => { const q = r.result.transaction('vocab').objectStore('vocab').get('old-mitigate'); q.onsuccess = () => res(q.result); }; }));
    const today = await page.locator('[data-testid="vocab-today"]').innerText();
    await page.locator('[data-testid="vocab-review"]').click();
    const r = await runSession(page, 1);
    const sum = await page.locator('[data-testid="vx-summary"]').innerText();
    const graded = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('ielts-practice', 3); r.onsuccess = () => { const q = r.result.transaction('vocab').objectStore('vocab').getAll(); q.onsuccess = () => res(q.result.filter((c) => c.id.startsWith('old-') && c.due > Date.now()).length); }; }));
    return { ok: migrated?.stability === 4 && /1[02] từ cần ôn|\d+ từ cần ôn/.test(today) && graded >= 10 && /Nhớ ngay \d+\/1[02]/.test(sum) && !page.errors.length,
      info: `S=${migrated?.stability} ${today.split('\n')[0]} · lượt=${r.steps} dạng=${r.kinds} · đã chấm ${graded} · ${sum.split('\n')[1]} ${page.errors.join(' | ')}` };
  });
  await check(`[${profile}] E4 bộ tự tạo: dán danh sách → bộ có tiến độ, Học tiếp`, async () => {
    await go(page, '/vocab');
    await page.getByRole('tab', { name: /Tự tạo/ }).click();
    await page.locator('[data-testid="deck-new"]').click();
    await page.locator('[data-testid="deck-name"]').fill('Bộ thử');
    await page.locator('[data-testid="deck-text"]').fill('scarcity | sự khan hiếm\ninfrastructure - cơ sở hạ tầng\nmitigate');
    await page.locator('form button[type=submit]', { hasText: 'Tạo bộ' }).click();
    await page.waitForSelector('[data-testid="deck-msg"]', { timeout: 15000 });
    const deck = page.locator('[data-testid="deck"]', { hasText: 'Bộ thử' });
    const n = await deck.locator('.deck__n').innerText();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await deck.getByRole('link', { name: 'Học tiếp' }).click();
    await page.waitForSelector('[data-testid="vx"]', { timeout: 8000 });
    const w = await page.locator('.lt-word strong').first().innerText();
    return { ok: /^\d\/3$/.test(n) && over <= 1 && ['scarcity', 'infrastructure', 'mitigate'].includes(w), info: `${n} từ đầu=${w} tràn=${over}` };
  });

  // ---------- F: Nghe & chép ----------
  await check(`[${profile}] F1 lối vào Nghe & chép: Trang chủ, Listening, menu`, async () => {
    await go(page, '/');
    const home = await page.locator('[data-testid="home-dict"]').count();
    await go(page, '/listening');
    const lis = await page.locator('[data-testid="dict-entry"]').count();
    const nav = await page.locator('a[href="#/dictation"]').count();
    return { ok: home > 0 && lis > 0 && nav > 0, info: `home=${home} listening=${lis} nav=${nav}` };
  });
  await check(`[${profile}] F2 bài số (cấp 1): xem đáp án (tính 0 điểm), gõ khớp → tự sang câu`, async () => {
    await go(page, '/dictation?level=1');
    await page.locator('.dh-gen__item').first().click();
    await page.waitForSelector('.dl-input', { timeout: 8000 });
    const acc0 = await page.locator('[data-testid="dl-acc"]').innerText();
    await page.getByRole('button', { name: /Xem đáp án/ }).click();
    const ans = await page.locator('[data-testid="dl-answer"]').innerText();
    await page.locator('.dl-input').fill(ans);
    await page.locator('.dl-input').press('Enter');
    const acc1 = await page.locator('[data-testid="dl-acc"]').innerText();
    await page.waitForTimeout(1400);
    const head = await page.locator('.topbar').first().innerText();
    return { ok: /—/.test(acc0) && /0%/.test(acc1) && /câu 2\//.test(head), info: `"${ans}" ${acc0} → ${acc1}; ${head.match(/câu \d+\/\d+/)?.[0]}` };
  });
  await check(`[${profile}] F3 bài audio thật: route cũ chuyển hướng, sửa sau khi kiểm tra, gợi ý`, async () => {
    await go(page, '/listening/vol3-t2-l1/dictation');
    await page.waitForSelector('.dl-input', { timeout: 8000 });
    const url = page.url();
    await page.locator('.dl-input').fill('good morning how');
    await page.getByRole('button', { name: 'Kiểm tra' }).click();
    const r1 = await page.locator('[data-testid="dl-result"]').count();
    const boxes = await page.locator('.dl-w--miss').count();
    const editable = await page.locator('.dl-input').isEditable();
    const before = await page.locator('.dl-input').inputValue();
    await page.getByRole('button', { name: /Gợi ý/ }).click();
    const after = await page.locator('.dl-input').inputValue();
    await page.locator('.dl-input').press('Enter');
    const acc = await page.locator('[data-testid="dl-acc"]').innerText();
    return { ok: /dictation\/vol3-t2-l1~/.test(decodeURIComponent(url)) && r1 > 0 && boxes > 0 && editable && after.length > before.length,
      info: `${decodeURIComponent(url).split('#')[1]} ô▢=${boxes} sửa được=${editable} gợi ý "${before}" → "${after.trim()}" ${acc}` };
  });
  await check(`[${profile}] F4 rời bài rồi quay lại tiếp tục đúng chỗ`, async () => {
    // tiếp nối F3: đang ở câu 1 bài vol3-t2-l1 với chữ đã gõ
    const typed = await page.locator('.dl-input').inputValue().catch(() => '');
    await page.waitForTimeout(900); // lưu có debounce
    await go(page, '/dictation');
    const card = page.locator('[data-testid="dh-resume"]');
    const has = await card.count();
    await card.click();
    await page.waitForSelector('.dl-input', { timeout: 8000 });
    const back = await page.locator('.dl-input').inputValue();
    return { ok: has > 0 && !!typed && back === typed, info: `resume=${has} "${typed.trim()}" → "${back.trim()}"` };
  });

  await check(`[${profile}] F5 câu chép sai → thẻ "Câu hay sai" + từ chép sai vào vốn từ`, async () => {
    page.errors.length = 0;
    // tiếp nối F4: đang ở một câu bài vol3-t2-l1; sang câu kế, gõ sai hẳn rồi rời câu
    await page.getByRole('button', { name: 'Câu sau' }).click();
    const ans = page.locator('.dl-input');
    await ans.fill('zzz'); await page.getByRole('button', { name: 'Kiểm tra' }).click();
    await page.getByRole('button', { name: 'Câu sau' }).click();
    await page.waitForTimeout(800);
    const cards = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('ielts-practice', 3); r.onsuccess = () => { const q = r.result.transaction('vocab').objectStore('vocab').getAll(); q.onsuccess = () => res(q.result.map((c) => ({ id: c.id, word: c.word, kind: c.kind, note: c.note }))); }; }));
    const sent = cards.filter((c) => c.kind === 'sentence');
    const words = cards.filter((c) => c.note === 'Từ nghe-chép chưa đúng');
    await go(page, '/vocab');
    await page.locator('.lt-listhead').click();
    await page.waitForSelector('[data-testid="vocab-list"]', { timeout: 8000 });
    const inList = words.length ? await page.locator(`[data-testid="vocab-list"] li[data-word="${words[0].word}"]`).count() : 0;
    const sentTag = await page.locator('[data-testid="vocab-list"]').getByText('Câu hay sai').count();
    return { ok: sent.length > 0 && words.length > 0 && inList > 0 && sentTag > 0 && !page.errors.length,
      info: `thẻ câu=${sent.length} từ=${words.map((w) => w.word).join(',')} trong sổ=${inList} nhãn câu=${sentTag} ${page.errors.join(' | ')}` };
  });

  await check(`[${profile}] C1 Trang chủ "Hôm nay" + XP/chuỗi ngày chung; trang Thống kê`, async () => {
    page.errors.length = 0;
    await go(page, '/');
    await page.waitForSelector('[data-testid="home-plan"]', { timeout: 8000 });
    const plan = await page.locator('[data-testid="home-plan"] [data-plan]').evaluateAll((els) => els.map((e) => `${e.dataset.plan}${e.hasAttribute('data-done') ? '✓' : ''}`));
    const xp = Number(await page.locator('[data-testid="home-xp"]').innerText());
    const streak = Number(await page.locator('[data-testid="home-streak"]').innerText());
    await go(page, '/stats');
    await page.waitForSelector('[data-testid="st-heat"]', { timeout: 8000 });
    const cells = await page.locator('[data-testid="st-heat"] .st-heat__c').count();
    const lit = await page.locator('[data-testid="st-heat"] .st-heat__c.is-today:not(.l0)').count();
    const dict = Number(await page.locator('[data-testid="st-dict"]').innerText());
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const order = plan.map((p) => p.replace('✓', '')).join(',');
    return { ok: order === 'review,learn,dict,context,exam' && plan.includes('learn✓') && xp > 0 && streak >= 1 && cells === 126 && lit === 1 && over <= 1 && !page.errors.length,
      info: `kế hoạch=${plan.join(' ')} XP=${xp} chuỗi=${streak} ô=${cells} hôm nay sáng=${lit} câu đúng=${dict} tràn=${over} ${page.errors.join(' | ')}` };
  });

  // ---------- A3: Writing nộp được khi chưa cấu hình AI ----------
  await check(`[${profile}] A3 Writing: Nộp bài không cần AI`, async () => {
    await go(page, '/writing/vol1-t3-w2');
    await answerTab(page); await page.locator('.wbox__input').fill(Array.from({ length: 60 }, (_, i) => `word${i}`).join(' '));
    const btn = page.getByRole('button', { name: /^Nộp bài/ });
    if (!(await btn.count())) return { ok: false, info: 'không có nút Nộp bài' };
    page.once('dialog', (d) => d.accept());
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

  // ---------- Đợt 4 · Phần 1: kho đề Writing ----------
  const imgsOk = (p) => p.evaluate(async () => { const im = [...document.querySelectorAll('.wtask__img img')]; im.forEach((i) => { i.loading = 'eager'; i.scrollIntoView(); }); await Promise.all(im.map((i) => (i.complete && i.naturalWidth ? 0 : Promise.race([new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); }), new Promise((r) => setTimeout(r, 5000))])))); return im.length > 0 && im.every((i) => i.naturalWidth > 0); });
  await check(`[${profile}] W1 wr-t1-wx1: 1 ảnh + Bảng số liệu 2 bảng`, async () => {
    await go(page, '/writing/wr-t1-wx1');
    const n = await page.locator('.wtask__img').count();
    const ok1 = await imgsOk(page);
    await page.locator('.collapse__head', { hasText: 'Bảng số liệu' }).click();
    const tables = await page.locator('[data-testid="w-datatables"] table').count();
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    return { ok: n === 1 && ok1 && tables === 2 && sw, info: `img=${n} loaded=${ok1} tables=${tables} noHScroll=${sw}` };
  });
  await check(`[${profile}] W2 process/map/projected/GT/development`, async () => {
    const bad = [];
    await go(page, '/writing/wr-t1-wpr3'); if (!/turtle/i.test(await page.locator('.wtask__prompt').innerText()) || !(await imgsOk(page))) bad.push('pr3');
    await go(page, '/writing/wr-t1-wm8'); if (!/library/i.test(await page.locator('.wtask__prompt').innerText()) || !(await imgsOk(page))) bad.push('m8');
    await go(page, '/writing/wr-t1-wl12'); await page.locator('.collapse__head', { hasText: 'Bảng số liệu' }).click();
    if (!/Projected/i.test(await page.locator('[data-testid="w-datatables"]').innerText())) bad.push('l12');
    await go(page, '/writing/wr-gt-wf1'); const gt = (await page.locator('.xnav__part').first().innerText()).replace(/\s+/g, ' ');
    if (!/Part 1 Formal letter · GT/.test(gt)) bad.push(`gt="${gt}"`);
    await go(page, '/writing/wr-t2-wdv1'); if (!/Positive\/Negative development/.test(await page.locator('[data-testid="w-typelabel"]').innerText())) bad.push('dv1');
    const sample = await page.locator('.sample').count();
    return { ok: !bad.length && sample === 0, info: bad.join(', ') || 'ok' };
  });
  await check(`[${profile}] W3 danh sách Writing: 3 tab, đếm dạng đề tự soạn`, async () => {
    await go(page, '/writing');
    const tabs = await page.locator('.wtabs__btn').count();
    const want = { t1a: { line: 14, bar: 13, pie: 11, table: 11, mixed: 6, process: 9, map: 8 }, t2: { opinion: 10, discussion: 10, advantage: 10, problem: 10, double: 10, development: 10 }, t1g: { 'letter-formal': 8, 'letter-semi': 8, 'letter-informal': 8 } };
    const bad = [];
    await page.locator('[data-testid="wsrc-bank"]').click();
    for (const [t, types] of Object.entries(want)) {
      await page.locator(`[data-testid="wtab-${t}"]`).click();
      if (!(await page.locator('[data-testid="wsrc-bank"]').getAttribute('aria-pressed') === 'true')) await page.locator('[data-testid="wsrc-bank"]').click();
      for (const [ty, n] of Object.entries(types)) {
        const got = await page.locator(`[data-testid="wtypes"] [data-type="${ty}"] small`).innerText().catch(() => '0');
        if (+got !== n) bad.push(`${ty}=${got}/${n}`);
      }
    }
    const vol0 = await page.locator('.item__sub', { hasText: 'VOL 0' }).count();
    await page.locator('[data-testid="wtypes"] [data-type="letter-formal"]').click();
    const tips = await page.locator('[data-testid="wtips"]').count();
    return { ok: tabs === 3 && !bad.length && !vol0 && tips === 1, info: `tabs=${tabs} ${bad.join(' ') || 'đếm khớp'} vol0=${vol0} tips=${tips}` };
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
    // ---------- B12: nhà cung cấp OpenAI-compatible (giả lập DeepSeek) ----------
    await check('B12 DeepSeek giả lập: kiểm tra kết nối, chấm Writing qua JSON + zod, hỏi lại khi sai', async () => {
      const p = await newPage(profile);
      await p.addInitScript(() => localStorage.setItem('ielts:ai:v1', JSON.stringify({ mode: 'key', provider: 'deepseek', keys: { deepseek: 'sk-test' } })));
      // Sinh một thể hiện tối thiểu hợp lệ từ JSON Schema mà app gửi trong system prompt.
      const inst = (s) => {
        if (s.anyOf || s.oneOf) return inst((s.anyOf ?? s.oneOf)[0]);
        if (s.enum) return s.enum[0];
        if (s.const !== undefined) return s.const;
        const t = Array.isArray(s.type) ? s.type[0] : s.type;
        if (t === 'object') return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, inst(v)]));
        if (t === 'array') return Array.from({ length: Math.max(1, s.minItems ?? 1) }, () => inst(s.items ?? {}));
        if (t === 'number' || t === 'integer') return s.minimum ?? 6;
        if (t === 'boolean') return true;
        return 'ok';
      };
      const calls = [];
      await p.route('https://api.deepseek.com/**', async (route) => {
        const body = JSON.parse(route.request().postData() ?? '{}');
        calls.push(body);
        const sys = body.messages?.[0]?.content ?? '';
        const m = sys.match(/JSON Schema[^\n]*\n(\{[\s\S]*\})\s*$/);
        // Lần đầu trả JSON sai để kiểm tra vòng hỏi lại; lần sau trả đúng schema.
        const content = !m ? 'OK' : calls.filter((c) => c.response_format).length === 1 ? '{"oops":1}' : '```json\n' + JSON.stringify(inst(JSON.parse(m[1]))) + '\n```';
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ model: body.model, choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }) });
      });
      await go(p, '/settings');
      await p.getByRole('button', { name: /Kiểm tra kết nối/ }).click();
      const okText = await p.locator('.ok-text, .no-text').first().innerText({ timeout: 10000 });
      await go(p, '/writing/vol1-t2-w2');
      await answerTab(p); await p.locator('.wbox__input').fill(Array.from({ length: 60 }, () => 'word').join(' '));
      await p.getByRole('button', { name: /Chấm bằng AI/ }).click();
      await p.waitForFunction(() => !document.querySelector('.spin'), null, { timeout: 15000 });
      await p.waitForTimeout(500);
      const err = await p.locator('.error, .no-text, [role="alert"]').allInnerTexts();
      const band = await p.locator('text=/Band|band/').count();
      const jsonCalls = calls.filter((c) => c.response_format).length;
      await p.context().close();
      return { ok: /Kết nối được \(deepseek-v4-pro\)/.test(okText) && jsonCalls === 2 && band > 0 && !err.join(' ').trim(), info: `${okText} · json calls=${jsonCalls} band=${band} err=${err.join('|').slice(0, 120)}` };
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
