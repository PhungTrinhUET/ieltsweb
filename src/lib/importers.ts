// Đọc tài liệu người dùng nạp: JSON (Material / mảng Material), Markdown (Reading), SRT/VTT (segments), TXT (transcript).
import type { Material, QuestionGroup, ReadingMaterial, Segment, Skill } from '../types';
import { uid } from '../db';

const ts = (s: string) => {
  const m = s.trim().match(/(\d+):(\d+):(\d+)[.,](\d+)|(\d+):(\d+)[.,](\d+)/);
  if (!m) return 0;
  return m[1] !== undefined ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, '0') / 1000 : +m[5] * 60 + +m[6] + +m[7].padEnd(3, '0') / 1000;
};

/** SRT hoặc WebVTT → segments. */
export function parseSubtitles(text: string): Segment[] {
  const blocks = text.replace(/\r/g, '').replace(/^WEBVTT[^\n]*\n/, '').split(/\n\s*\n/);
  const out: Segment[] = [];
  for (const b of blocks) {
    const lines = b.split('\n').filter((l) => l.trim());
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti === -1) continue;
    const [a, c] = lines[ti].split('-->');
    const txt = lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (txt) out.push({ start: ts(a), end: ts(c), text: txt });
  }
  return out;
}

/**
 * Markdown bài Reading:
 * ```
 * # Title
 * topic: Environment   (tuỳ chọn, các dòng key: value ngay sau tiêu đề)
 * level: medium
 *
 * <đoạn văn…>
 *
 * ## Questions 1-5
 * > Do the following statements agree… (hướng dẫn)
 * 1. [TFNG] Statement… :: TRUE
 * 2. [FILL] The ___ was built in 1900 :: answer / alt
 * 3. [MCQ] Question? | A opt | B opt | C opt :: B
 * ## Questions 6-9
 * > Choose the correct heading
 * bank: Heading i | Heading ii | Heading iii
 * 6. [MATCH] Paragraph A :: ii
 * ```
 */
export function parseReadingMarkdown(md: string): ReadingMaterial {
  const lines = md.replace(/\r/g, '').split('\n');
  let title = 'Untitled';
  const meta: Record<string, string> = {};
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (lines[i]?.startsWith('# ')) { title = lines[i].slice(2).trim(); i++; }
  while (i < lines.length && /^[a-z]+:\s*/i.test(lines[i])) { const [k, ...v] = lines[i].split(':'); meta[k.trim().toLowerCase()] = v.join(':').trim(); i++; }
  const body = lines.slice(i).join('\n');
  const [passagePart, ...qParts] = body.split(/^##\s+/m);
  const groups: QuestionGroup[] = [];
  const LETTERS = 'ABCDEFGH';
  for (const part of qParts) {
    const ls = part.split('\n');
    const g: QuestionGroup = { instruction: '', questions: [] };
    for (const l of ls.slice(1)) {
      const t = l.trim();
      if (!t) continue;
      if (t.startsWith('>')) { g.instruction += (g.instruction ? ' ' : '') + t.slice(1).trim(); continue; }
      if (/^bank:/i.test(t)) { g.bank = t.slice(5).split('|').map((s) => s.trim()).filter(Boolean); continue; }
      if (/^limit:/i.test(t)) { g.wordLimit = t.slice(6).trim(); continue; }
      const m = t.match(/^(\d+)\.\s*\[(\w+)\]\s*(.*?)\s*::\s*(.+)$/);
      if (!m) continue;
      const no = +m[1], type = m[2].toUpperCase(), q = m[3], ans = m[4].trim();
      if (type === 'TFNG') g.questions.push({ no, type: 'tfng', text: q, answer: ans.toUpperCase() as 'TRUE' });
      else if (type === 'YNNG') g.questions.push({ no, type: 'ynng', text: q, answer: ans.toUpperCase() as 'YES' });
      else if (type === 'FILL') g.questions.push({ no, type: 'fill', text: q, answer: ans.split('/').map((s) => s.trim()) });
      else if (type === 'MCQ' || type === 'MULTI') {
        const [stem, ...opts] = q.split('|').map((s) => s.trim());
        const options = opts.map((o) => o.replace(/^[A-H][.)]?\s*/, ''));
        const idx = (c: string) => LETTERS.indexOf(c.trim().toUpperCase());
        if (type === 'MCQ') g.questions.push({ no, type: 'mcq', text: stem, options, answer: idx(ans) });
        else g.questions.push({ no, type: 'multi', text: stem, options, answer: ans.split(/[,\s]+/).map(idx).filter((x) => x >= 0) });
      } else if (type === 'MATCH') {
        const bank = g.bank ?? [];
        const roman = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
        let a = bank.findIndex((b) => b.toLowerCase() === ans.toLowerCase());
        if (a === -1) a = roman.indexOf(ans.toLowerCase());
        if (a === -1) a = LETTERS.indexOf(ans.toUpperCase());
        g.questions.push({ no, type: 'match', text: q, answer: Math.max(0, a) });
      }
    }
    if (g.questions.length) groups.push(g);
  }
  return {
    id: uid(), skill: 'reading', title, topic: meta.topic, level: meta.level as ReadingMaterial['level'], source: meta.source,
    module: meta.module as ReadingMaterial['module'], passage: passagePart.trim(), groups, addedAt: Date.now(),
  };
}

/** Kiểm tra tối thiểu một object JSON có phải Material. */
export function validateMaterial(m: unknown): Material {
  if (!m || typeof m !== 'object') throw new Error('Không phải object');
  const o = m as Record<string, unknown>;
  const skills: Skill[] = ['reading', 'listening', 'speaking', 'writing'];
  if (!skills.includes(o.skill as Skill)) throw new Error(`skill phải là ${skills.join(' | ')}`);
  if (typeof o.title !== 'string') throw new Error('thiếu title');
  if (o.skill === 'reading' && typeof o.passage !== 'string') throw new Error('Reading cần passage');
  if (o.skill === 'listening' && typeof o.transcript !== 'string') throw new Error('Listening cần transcript');
  if (o.skill === 'writing' && typeof o.prompt !== 'string') throw new Error('Writing cần prompt');
  if ((o.skill === 'reading' || o.skill === 'listening') && !Array.isArray(o.groups)) (o as { groups: unknown[] }).groups = [];
  return { ...o, id: typeof o.id === 'string' && o.id ? o.id : uid(), addedAt: typeof o.addedAt === 'number' ? o.addedAt : Date.now(), builtin: false } as Material;
}

export function parseJsonMaterials(text: string): Material[] {
  const d = JSON.parse(text);
  const list = Array.isArray(d) ? d : Array.isArray(d.materials) ? d.materials : [d];
  return list.map(validateMaterial);
}
