// Suy dạng câu hỏi IELTS của một nhóm câu (từ type + instruction), dùng cho chip dạng bài và bộ lọc.
import type { Material, QuestionGroup } from '../types';

export type QKind =
  | 'form' | 'note' | 'table' | 'flow' | 'summary' | 'sentence' | 'label' | 'short'
  | 'mcq' | 'multi' | 'match' | 'headings' | 'info' | 'features' | 'endings' | 'tfng' | 'ynng';

export const QKIND_LABEL: Record<QKind, string> = {
  form: 'Form completion', note: 'Note completion', table: 'Table completion', flow: 'Flow-chart completion',
  summary: 'Summary completion', sentence: 'Sentence completion', label: 'Map / Plan / Diagram', short: 'Short answer',
  mcq: 'MCQ một đáp án', multi: 'MCQ nhiều đáp án', match: 'Matching',
  headings: 'Matching headings', info: 'Matching information', features: 'Matching features', endings: 'Sentence endings',
  tfng: 'True / False / Not Given', ynng: 'Yes / No / Not Given',
};

/** Thứ tự chip trong bộ lọc theo kỹ năng. */
export const QKINDS: Record<'reading' | 'listening', QKind[]> = {
  listening: ['form', 'note', 'table', 'flow', 'sentence', 'mcq', 'multi', 'match', 'label', 'short'],
  reading: ['tfng', 'ynng', 'headings', 'info', 'features', 'endings', 'summary', 'note', 'table', 'flow', 'label', 'sentence', 'mcq', 'multi', 'short'],
};

export function groupKind(g: QuestionGroup, skill: 'reading' | 'listening'): QKind {
  const ins = g.instruction.toLowerCase();
  const t = g.questions[0]?.type;
  const layout = (g as { layout?: string }).layout;
  if (t === 'tfng') return 'tfng';
  if (t === 'ynng') return 'ynng';
  if (t === 'mcq') return 'mcq';
  if (t === 'multi') return 'multi';
  const where = /\b(map|plan|diagram|label)\b/.test(ins) || (!!g.image && !/table|flow|summary|note/.test(ins));
  if (t === 'match') {
    if (where) return 'label';
    if (skill === 'reading') {
      if (/heading/.test(ins)) return 'headings';
      if (/ending/.test(ins)) return 'endings';
      if (/summary/.test(ins)) return 'summary';
      if (/flow/.test(ins)) return 'flow';
      if (/which (paragraph|section)|contains? the following information|paragraphs? .* contains?/.test(ins)) return 'info';
      return 'features';
    }
    if (/flow/.test(ins)) return 'flow';
    return 'match';
  }
  // fill
  if (layout === 'form' || /\bform\b/.test(ins)) return 'form';
  if (layout === 'table' || /\btable\b/.test(ins)) return 'table';
  if (layout === 'flowchart' || /flow.?chart/.test(ins)) return 'flow';
  if (/summary/.test(ins)) return 'summary';
  if (layout === 'notes' || /\bnotes?\b/.test(ins)) return 'note';
  if (where) return 'label';
  if (/answer the questions|short answer|answer each question/.test(ins)) return 'short';
  if (/sentence/.test(ins)) return 'sentence';
  return skill === 'listening' ? 'note' : 'sentence';
}

/** Các dạng có trong một bài (theo thứ tự xuất hiện, không lặp). */
export function materialKinds(m: Material): QKind[] {
  if (m.skill !== 'reading' && m.skill !== 'listening') return [];
  return [...new Set(m.groups.map((g) => groupKind(g, m.skill as 'reading' | 'listening')))];
}
