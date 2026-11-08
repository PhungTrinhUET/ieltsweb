// Tiện ích xử lý văn bản: tách câu, tách đoạn, so khớp đáp án, diff từ.

/** Tách đoạn: dòng trống phân cách. */
export const paragraphs = (s: string) => s.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** Nhãn đoạn ("A", "B"…) nếu đoạn bắt đầu bằng "A " / "A." / "A)" / "Paragraph A". */
export function paraLabel(p: string): { label: string | null; text: string } {
  const m = p.match(/^(?:Paragraph\s+)?([A-H])(?:[.)]|\s{1,3}(?=[A-Z"'“]))\s*/);
  return m ? { label: m[1], text: p.slice(m[0].length) } : { label: null, text: p };
}

const ABBR = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|No|Fig|U\.S|U\.K)\.$/i;
/** Tách câu đơn giản nhưng tránh các từ viết tắt phổ biến và số thập phân. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let buf = '';
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…]["”’)]?)\s+(?=["“‘(]?[A-Z0-9])/);
  for (const p of parts) {
    buf = buf ? `${buf} ${p}` : p;
    if (ABBR.test(buf) || /\b\d+\.$/.test(buf)) continue;
    out.push(buf);
    buf = '';
  }
  if (buf) out.push(buf);
  return out.filter((s) => s.trim());
}

export const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
export const wordCount = (s: string) => (s.trim() ? words(s).length : 0);

/** Chuẩn hoá để so đáp án điền từ: bỏ dấu câu, mạo từ thừa ở đầu, chữ thường, số viết chữ. */
export function normAnswer(s: string) {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function answerMatches(given: string, accepted: string | string[]) {
  const g = normAnswer(given);
  if (!g) return false;
  const list = Array.isArray(accepted) ? accepted : accepted.split(/\s*\/\s*|\s*\|\s*/);
  return list.some((a) => {
    const n = normAnswer(a);
    if (n === g) return true;
    // Chấp nhận "(the) answer" – phần trong ngoặc tuỳ chọn.
    const optional = normAnswer(a.replace(/\([^)]*\)/g, ''));
    const required = normAnswer(a.replace(/[()]/g, ''));
    return g === optional || g === required;
  });
}

// ---------- Diff từ cho chép chính tả & sửa bài ----------
export type DiffOp = { op: 'eq' | 'del' | 'ins' | 'sub'; a?: string; b?: string };
const tok = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").split(/\s+/).filter(Boolean);
const key = (w: string) => w.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');

/** Diff theo từ (LCS) giữa bản gốc `a` và bản gõ `b`. */
export function wordDiff(a: string, b: string): DiffOp[] {
  const A = tok(a), B = tok(b);
  const n = A.length, m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = key(A[i]) === key(B[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (key(A[i]) === key(B[j])) { out.push({ op: 'eq', a: A[i], b: B[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ op: 'del', a: A[i] }); i++; }
    else { out.push({ op: 'ins', b: B[j] }); j++; }
  }
  while (i < n) out.push({ op: 'del', a: A[i++] });
  while (j < m) out.push({ op: 'ins', b: B[j++] });
  // Gộp del+ins liền nhau thành sub cho dễ đọc.
  const merged: DiffOp[] = [];
  for (let k = 0; k < out.length; k++) {
    if (out[k].op === 'del' && out[k + 1]?.op === 'ins') { merged.push({ op: 'sub', a: out[k].a, b: out[k + 1].b }); k++; }
    else merged.push(out[k]);
  }
  return merged;
}
/** Tỉ lệ từ đúng (0–1) của bản gõ so với bản gốc. */
export function accuracy(a: string, b: string) {
  const d = wordDiff(a, b);
  const total = tok(a).length || 1;
  return d.filter((x) => x.op === 'eq').length / total;
}

/** Che từ: trả về chuỗi gợi ý "h_____" theo độ dài. */
export const maskWord = (w: string, reveal = 0) => w.slice(0, reveal) + '_'.repeat(Math.max(0, w.length - reveal));

export const shuffle = <T,>(arr: T[]) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const fmtDate = (ms: number) => new Date(ms).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Các từ "quan trọng" trong câu (không phải stop-word, dài ≥ 4) – dùng cho bài điền từ transcript. */
const STOP = new Set('the a an and or but of to in on at for with from by as is are was were be been being this that these those it its he she they we you i his her their our your my me him them us not no do does did have has had will would can could should may might must shall than then there here what which who whom when where why how all any some such only also very just more most much many so if into about over after before up down out off'.split(' '));
export const isKeyword = (w: string) => { const k = key(w); return k.length >= 4 && !STOP.has(k) && !/^\d+$/.test(k); };
export const cleanWord = key;
