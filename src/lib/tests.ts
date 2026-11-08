// Gom bài theo VOL → Test (id dạng vol5-t7-l2 / -r1 / -w2) và tính kết quả từng phần từ lịch sử.
import type { Attempt, Material, Skill } from '../types';

export interface TestRef { key: string; vol: number; test: number; parts: Material[] }

const ID_RE = /^vol(\d+)-t(\d+)-([lrws])(\w+)$/;
const BANK_RE = /^vol(\d+)-wbank-w(\w+)$/;
/** Số test giả cho "đề Writing lẻ" (writing-bank) – xếp cuối VOL. */
export const BANK_TEST = 1000;
export function parseId(id: string) {
  const m = ID_RE.exec(id);
  if (m) return { vol: +m[1], test: +m[2], key: `vol${m[1]}-t${m[2]}`, part: m[4] };
  const b = BANK_RE.exec(id);
  return b ? { vol: +b[1], test: BANK_TEST, key: `vol${b[1]}-wbank`, part: b[2] } : null;
}
export const testName = (t: { vol: number; test: number }) => `VOL ${t.vol} · ${t.test === BANK_TEST ? 'Đề Writing lẻ' : `Test ${t.test}`}`;

/** Nhãn ngắn của một phần: "Section 2", "Passage 1", "Task 2". */
export function partLabel(m: Material) {
  if (m.skill === 'listening') return `Section ${m.section ?? '?'}`;
  if (m.skill === 'writing') return `Task ${m.task}`;
  const p = parseId(m.id)?.part;
  return m.skill === 'reading' ? `Passage ${p ?? '?'}` : m.title;
}

/** Tiêu đề bài bỏ tiền tố "VOL 5 Test 7 · ". */
export const shortTitle = (m: Material) => m.title.replace(/^VOL \d+ Test \d+\s*[·–-]\s*/, '');

export function groupByTest(materials: Material[], skill: Skill) {
  const tests = new Map<string, TestRef>();
  const others: Material[] = [];
  for (const m of materials) {
    if (m.skill !== skill) continue;
    const p = parseId(m.id);
    if (!p) { others.push(m); continue; }
    let t = tests.get(p.key);
    if (!t) tests.set(p.key, (t = { key: p.key, vol: p.vol, test: p.test, parts: [] }));
    t.parts.push(m);
  }
  const order = (m: Material) => (m.skill === 'listening' ? m.section ?? 0 : m.skill === 'writing' ? +m.task || 0 : +(parseId(m.id)?.part ?? 0));
  for (const t of tests.values()) t.parts.sort((a, b) => order(a) - order(b));
  const vols = new Map<number, TestRef[]>();
  for (const t of [...tests.values()].sort((a, b) => a.vol - b.vol || a.test - b.test)) {
    if (!vols.has(t.vol)) vols.set(t.vol, []);
    vols.get(t.vol)!.push(t);
  }
  return { vols, tests, others: others.sort((a, b) => b.addedAt - a.addedAt) };
}

/** Đề chứa bài `id` (các phần cùng VOL/Test, đã sắp thứ tự). */
export function testOf(materials: Record<string, Material>, id: string): TestRef | undefined {
  const m = materials[id]; const p = parseId(id);
  if (!m || !p) return undefined;
  return groupByTest(Object.values(materials).filter((x) => parseId(x.id)?.key === p.key), m.skill).tests.get(p.key);
}

/** Chế độ đã chọn ở trang kỹ năng (Luyện tập / Thi thử), nhớ trong localStorage. */
export function savedMode(skill: string): 'practice' | 'test' {
  try { return localStorage.getItem(`ielts-mode-${skill}`) === 'test' ? 'test' : 'practice'; } catch { return 'practice'; }
}
export function saveMode(skill: string, v: 'practice' | 'test') {
  try { localStorage.setItem(`ielts-mode-${skill}`, v); } catch { /* bỏ qua */ }
}

export interface PartResult { score: number; max: number; band?: number }

/** Kết quả tốt nhất của từng bài (mode test), gồm cả các phần nằm trong một lần làm cả đề / thi thử. */
export function bestResults(attempts: Attempt[]) {
  const best = new Map<string, PartResult>();
  const put = (id: string, r: PartResult) => {
    const old = best.get(id);
    if (!old || r.score / (r.max || 1) > old.score / (old.max || 1)) best.set(id, r);
  };
  for (const a of attempts) {
    if (a.mode !== 'test' || a.score === undefined) continue;
    const parts = (a.detail as { parts?: { id: string; score: number; max: number }[] } | undefined)?.parts;
    if (parts?.length) for (const p of parts) put(p.id, { score: p.score, max: p.max });
    else put(a.materialId, { score: a.score, max: a.max ?? 0, band: a.band });
  }
  return best;
}

export const SECTION_DESC: Record<number, string> = {
  1: 'Hội thoại đời thường – điền form / bảng / ghi chú',
  2: 'Độc thoại về chủ đề xã hội – bản đồ, chọn đáp án',
  3: 'Thảo luận học thuật 2–4 người – MCQ, ghép',
  4: 'Bài giảng học thuật – điền ghi chú',
};
