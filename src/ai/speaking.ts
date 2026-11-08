// Chấm IELTS Speaking từ transcript (nhận dạng giọng nói trên trình duyệt hoặc người dùng tự gõ).
import * as z from 'zod/v4';
import type { AiConfig } from '../store';
import { callStructured } from './client';
import { criteriaBand } from '../lib/band';

const B = z.number().describe('IELTS band 4–9, half bands allowed');

export const SpeakingGradeSchema = z.object({
  scores: z.object({
    fluency: B.describe('Fluency and Coherence'),
    lexical: B.describe('Lexical Resource'),
    grammar: B.describe('Grammatical Range and Accuracy'),
    pronunciation: z.number().describe('Pronunciation band – ước lượng từ transcript là KHÔNG thể; trả về 0 nếu không có thông tin, hoặc dùng self-assessment người dùng cung cấp'),
  }),
  reasons: z.object({
    fluency: z.string().describe('Tiếng Việt, 1–3 câu, dựa trên độ dài, mạch ý, từ nối, lặp/ngập ngừng thấy trong transcript'),
    lexical: z.string().describe('Tiếng Việt, nêu ví dụ từ transcript'),
    grammar: z.string().describe('Tiếng Việt, nêu ví dụ lỗi'),
  }),
  summary: z.string().describe('Nhận xét tổng quan tiếng Việt 2–4 câu'),
  improvements: z.array(z.string()).describe('Việc cần làm để lên band (tiếng Việt), tối đa 5'),
  perQuestion: z.array(z.object({
    question: z.string(),
    comment: z.string().describe('Nhận xét ngắn tiếng Việt: trả lời đủ ý chưa, có mở rộng không'),
    corrections: z.array(z.object({ original: z.string(), corrected: z.string(), explanation: z.string().describe('tiếng Việt') })).describe('tối đa 4'),
    improved: z.string().describe('Câu trả lời mẫu band 7–8 giữ ý người nói, tự nhiên như văn nói, 3–6 câu (Part 2: 150–220 từ)'),
  })).describe('Một mục cho mỗi câu hỏi được trả lời'),
  vocabulary: z.array(z.object({ phrase: z.string(), meaning: z.string().describe('nghĩa tiếng Việt'), example: z.string() })).describe('5–10 cụm từ / collocation nên học cho chủ đề này'),
});
export type SpeakingGrade = z.infer<typeof SpeakingGradeSchema> & { overall: number };

const SYSTEM = `You are a certified IELTS Speaking examiner. You receive a TRANSCRIPT of a candidate's spoken answers (automatic speech recognition, so ignore obvious transcription artefacts such as missing punctuation or homophones). Grade Fluency & Coherence, Lexical Resource and Grammatical Range & Accuracy according to the public IELTS Speaking band descriptors:

FLUENCY & COHERENCE – 9: speaks fluently with only rare repetition/self-correction, fully coherent. 8: fluent, only occasional repetition; develops topics coherently. 7: speaks at length without noticeable effort; some hesitation/repetition; range of connectives with some flexibility. 6: willing to speak at length though may lose coherence at times; some repetition/self-correction; connectives not always appropriate. 5: usually maintains flow but uses repetition, self-correction and slow speech; over-uses certain connectives; simple speech fluent but complex communication causes problems. 4: noticeable pauses, frequent repetition; links basic sentences, limited connectives.
LEXICAL RESOURCE – 9: full flexibility and precision, idiomatic. 8: wide range used readily and flexibly; skilful idiomatic use with occasional inaccuracies; effective paraphrase. 7: flexible vocabulary on a variety of topics; some less common and idiomatic vocabulary, some awareness of style and collocation; effective paraphrase. 6: sufficient vocabulary to discuss topics at length, meaning clear despite inappropriacies; generally paraphrases successfully. 5: can talk about familiar/unfamiliar topics with limited flexibility; attempts paraphrase with mixed success. 4: sufficient for familiar topics only; basic meaning on unfamiliar topics; frequent errors in word choice; rarely paraphrases.
GRAMMATICAL RANGE & ACCURACY – 9: full range, consistently accurate apart from slips. 8: wide range flexibly; majority of sentences error-free. 7: range of complex structures with some flexibility; frequently error-free sentences though some errors persist. 6: mix of simple and complex structures with limited flexibility; errors in complex structures rarely cause comprehension problems. 5: basic forms with reasonable accuracy; limited complex structures with errors that may cause comprehension problems. 4: basic sentence forms, some correct simple sentences; subordinate structures rare; errors frequent and may lead to misunderstanding.

Pronunciation cannot be assessed from text: if the user gives a self-assessment use it, otherwise return 0 for pronunciation. Answers that are very short (one sentence for Part 1, under a minute for Part 2) cap Fluency at band 5. Be calibrated and honest. Write all comments in Vietnamese; corrections and improved answers in natural spoken English.`;

export interface SpeakingTurn { question: string; answer: string; seconds?: number }

export async function gradeSpeaking(part: 1 | 2 | 3, topic: string, turns: SpeakingTurn[], cfg: AiConfig, pronunciationSelf?: number): Promise<SpeakingGrade> {
  const prompt = `IELTS Speaking Part ${part}${topic ? ` – ${topic}` : ''}
${pronunciationSelf ? `Candidate's self-assessed pronunciation band: ${pronunciationSelf}` : 'No pronunciation information.'}

${turns.map((t, i) => `### Q${i + 1}: ${t.question}\n${t.seconds ? `(spoke for ${t.seconds}s)\n` : ''}Transcript: ${t.answer.trim() || '(no answer)'}`).join('\n\n')}

Grade the candidate.`;
  const out = await callStructured(cfg, SpeakingGradeSchema, SYSTEM, prompt, { maxTokens: 16000 });
  const norm = (b: number) => Math.max(1, Math.min(9, Math.round(b * 2) / 2));
  const scores = { fluency: norm(out.scores.fluency), lexical: norm(out.scores.lexical), grammar: norm(out.scores.grammar), pronunciation: out.scores.pronunciation > 0 ? norm(out.scores.pronunciation) : 0 };
  const list = [scores.fluency, scores.lexical, scores.grammar, ...(scores.pronunciation ? [scores.pronunciation] : [])];
  return { ...out, scores, overall: criteriaBand(list) };
}
