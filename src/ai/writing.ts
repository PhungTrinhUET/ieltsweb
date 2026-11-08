// Chấm IELTS Writing bằng Claude theo 4 tiêu chí công khai của IELTS (band descriptors).
import * as z from 'zod/v4';
import type { AiConfig } from '../store';
import type { WritingMaterial } from '../types';
import { callStructured } from './client';
import { criteriaBand } from '../lib/band';

const B = z.number().describe('IELTS band for this criterion: 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5 or 9');

export const WritingGradeSchema = z.object({
  scores: z.object({
    task: B.describe('Task Achievement (Task 1) / Task Response (Task 2)'),
    coherence: B.describe('Coherence and Cohesion'),
    lexical: B.describe('Lexical Resource'),
    grammar: B.describe('Grammatical Range and Accuracy'),
  }),
  reasons: z.object({
    task: z.string().describe('Vì sao band này cho Task Achievement/Response – bám descriptor, tiếng Việt, 1–3 câu'),
    coherence: z.string().describe('Vì sao band này cho Coherence & Cohesion – tiếng Việt'),
    lexical: z.string().describe('Vì sao band này cho Lexical Resource – tiếng Việt, nêu ví dụ từ bài'),
    grammar: z.string().describe('Vì sao band này cho Grammar – tiếng Việt, nêu ví dụ lỗi'),
  }),
  summary: z.string().describe('Nhận xét tổng quan bằng tiếng Việt, 2–4 câu, nói rõ bài đang ở band nào và cần gì để lên band tiếp theo'),
  strengths: z.array(z.string()).describe('Điểm mạnh (tiếng Việt), tối đa 3'),
  improvements: z.array(z.string()).describe('Việc cần làm để lên band cao hơn (tiếng Việt), cụ thể, tối đa 5'),
  corrections: z.array(z.object({
    original: z.string().describe('Trích nguyên văn đoạn sai trong bài'),
    corrected: z.string().describe('Bản sửa (tiếng Anh)'),
    kind: z.string().describe('grammar | vocabulary | spelling | punctuation | cohesion | task'),
    explanation: z.string().describe('Giải thích ngắn bằng tiếng Việt'),
  })).describe('Lỗi quan trọng nhất trước, tối đa 12'),
  corrected: z.string().describe('Toàn bộ bài sau khi sửa HẾT lỗi nhưng giữ nguyên ý, cách diễn đạt, thứ tự câu và xuống dòng – chỉ đổi chỗ sai (app so sánh từng từ nên sửa tối thiểu)'),
  improved: z.string().describe('Bản viết lại ở band cao hơn khoảng 1 band, giữ ý và bố cục của người viết, đúng số từ yêu cầu'),
  upgrades: z.array(z.object({ from: z.string(), to: z.string() })).describe('Cụm từ/cấu trúc nâng cấp đáng học (from = cách người viết dùng, to = cách tốt hơn), 5–10 cặp'),
});
export type WritingGrade = z.infer<typeof WritingGradeSchema> & { overall: number };

const SYSTEM = `You are a certified IELTS Writing examiner. Grade strictly according to the public IELTS Writing band descriptors. Vietnamese learners use this app; write all comments in Vietnamese, but corrections and rewritten texts in English.

Key descriptor anchors (apply to both tasks unless stated):

TASK ACHIEVEMENT (Task 1) / TASK RESPONSE (Task 2)
9: fully addresses all parts; fully developed position / clear overview with all key features well selected and illustrated.
8: sufficiently addresses all parts; well-developed response; Task 1: clear overview, key features clearly presented and appropriately illustrated.
7: addresses all parts; clear position throughout; main ideas extended and supported but may over-generalise or lack focus; Task 1: clear overview of main trends/differences/stages, key features highlighted but could be more fully extended.
6: addresses all parts though some more fully than others; relevant position but conclusions may be unclear or repetitive; ideas relevant but insufficiently developed; Task 1: overview present, key features adequately covered but details may be irrelevant/inaccurate.
5: addresses the task only partially; position expressed but development unclear; limited ideas, may be irrelevant; Task 1: no clear overview, mechanical recounting of detail, may be inaccurate.
4: responds minimally or tangentially; position unclear; Task 1: fails to cover key features, may confuse data.
Under-length (<150 Task 1, <250 Task 2) is penalised in this criterion. Memorised/templated content earns no credit.

COHERENCE AND COHESION
9: cohesion attracts no attention; skilful paragraphing.
8: sequences information logically; manages all aspects of cohesion well; paragraphing sufficient and appropriate.
7: logically organises information; clear progression; range of cohesive devices with some under/over-use; clear central topic in each paragraph.
6: coherent arrangement, overall progression; cohesive devices used effectively but may be faulty or mechanical; referencing may be unclear; paragraphing may be illogical.
5: some organisation but lack of overall progression; inadequate/inaccurate/overused cohesive devices; repetitive; paragraphing may be inadequate.
4: not arranged coherently; basic cohesive devices inaccurate or repetitive; no paragraphing or confusing paragraphs.

LEXICAL RESOURCE
9: wide range, natural and sophisticated control; rare minor slips.
8: wide range used fluently and flexibly; skilful use of uncommon items with occasional inaccuracies; rare spelling/word formation errors.
7: sufficient range for flexibility and precision; less common items with some awareness of style and collocation; occasional errors.
6: adequate range; attempts less common vocabulary with some inaccuracy; some spelling/word-formation errors that do not impede communication.
5: limited range, minimally adequate; noticeable errors that may cause difficulty for the reader.
4: basic vocabulary, repetitive, inappropriate; errors may cause strain.

GRAMMATICAL RANGE AND ACCURACY
9: wide range with full flexibility and accuracy; rare slips.
8: wide range; majority of sentences error-free; only very occasional errors.
7: variety of complex structures; frequent error-free sentences; good control, a few errors persist.
6: mix of simple and complex forms; some errors in grammar/punctuation but rarely reduce communication.
5: limited range of structures; complex sentences attempted but faulty; frequent errors that may cause difficulty.
4: very limited range, rare subordinate clauses; frequent errors, punctuation often faulty.

Half bands (e.g. 6.5) are allowed when a criterion sits between two descriptors. Be calibrated and honest – do not inflate: a typical Vietnamese learner essay with repeated article/tense errors and template phrases is band 5.5–6.5. Quote examples from the candidate's text when justifying lexical and grammar bands.

For "corrected": fix every error (grammar, vocabulary, spelling, punctuation) but otherwise leave the text unchanged – same ideas, wording, order and line breaks – the app shows a word-level diff. For "improved": rewrite about one band higher, keep the writer's ideas and paragraph structure, within the word limit. Never copy the sample answer if one is provided; it is only for calibration.`;

export function buildWritingPrompt(m: WritingMaterial, answer: string, minutes?: number) {
  const n = answer.trim().split(/\s+/).filter(Boolean).length;
  const min = m.task === 1 ? 150 : 250;
  return `IELTS ${m.module === 'general' ? 'General Training' : 'Academic'} Writing Task ${m.task} (${m.type})
Prompt: ${m.prompt}
${m.chart ? `Chart data: ${JSON.stringify(m.chart)}` : ''}
Minimum words: ${min}. Candidate wrote ${n} words${minutes ? ` in about ${minutes} minutes` : ''}.

Candidate's answer:
${answer.trim() || '(left blank)'}
${m.sample ? `\nSample answer (calibration only, do not copy):\n${m.sample}` : ''}

Grade this answer.`;
}

export async function gradeWriting(m: WritingMaterial, answer: string, cfg: AiConfig, minutes?: number): Promise<WritingGrade> {
  const out = await callStructured(cfg, WritingGradeSchema, SYSTEM, buildWritingPrompt(m, answer, minutes), { maxTokens: 20000 });
  const norm = (b: number) => Math.max(1, Math.min(9, Math.round(b * 2) / 2));
  const scores = { task: norm(out.scores.task), coherence: norm(out.scores.coherence), lexical: norm(out.scores.lexical), grammar: norm(out.scores.grammar) };
  return { ...out, scores, overall: criteriaBand(Object.values(scores)) };
}
