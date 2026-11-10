// Trợ lý AI: dịch, tra từ theo ngữ cảnh, sinh đề từ văn bản thô, sinh bộ đề Speaking / Writing.
import * as z from 'zod/v4';
import type { AiConfig } from '../store';
import type { ListeningMaterial, QuestionGroup, ReadingMaterial, SpeakingMaterial, Vocab, WritingMaterial, WritingType } from '../types';
import { callStructured } from './client';
import { uid } from '../db';

// ---------- Dịch ----------
const TranslateSchema = z.object({ items: z.array(z.string()).describe('Bản dịch tiếng Việt, cùng số lượng và thứ tự với đầu vào') });
export async function translateMany(texts: string[], cfg: AiConfig): Promise<string[]> {
  const out = await callStructured(cfg, TranslateSchema, 'Bạn là biên dịch viên Anh–Việt cho người học IELTS. Dịch tự nhiên, chính xác, giữ sắc thái học thuật; không thêm chú thích.',
    `Dịch từng mục sau sang tiếng Việt, trả về đúng ${texts.length} mục theo thứ tự:\n\n${texts.map((t, i) => `[${i + 1}] ${t}`).join('\n\n')}`, { light: true, maxTokens: 8000 });
  return texts.map((_, i) => out.items[i] ?? '');
}

// ---------- Tra từ ----------
const LookupSchema = z.object({
  word: z.string().describe('Dạng từ điển (lemma) của từ'),
  ipa: z.string().describe('Phiên âm IPA (Anh-Anh)'),
  pos: z.string().describe('Loại từ: n, v, adj, adv, phr…'),
  meaning: z.string().describe('Nghĩa tiếng Việt đúng với ngữ cảnh câu'),
  meaningEn: z.string().describe('Định nghĩa tiếng Anh ngắn'),
  otherMeanings: z.array(z.string()).describe('Nghĩa khác (tiếng Việt), tối đa 3'),
  collocations: z.array(z.string()).describe('3–5 collocation thường gặp'),
  example: z.string().describe('Một câu ví dụ mới, trình độ B2'),
  synonyms: z.array(z.string()).describe('2–4 từ đồng nghĩa'),
  sentenceVi: z.string().describe('Dịch câu chứa từ sang tiếng Việt'),
});
export type Lookup = z.infer<typeof LookupSchema>;
export function lookupWord(word: string, sentence: string, cfg: AiConfig) {
  return callStructured(cfg, LookupSchema, 'Bạn là từ điển Anh–Việt theo ngữ cảnh cho người học IELTS.',
    `Từ: "${word}"\nTrong câu: "${sentence}"`, { light: true, maxTokens: 2000 });
}

// ---------- Sinh đề ----------
const QuestionSchema = z.object({
  no: z.number(),
  type: z.string().describe("'mcq' | 'tfng' | 'ynng' | 'fill' | 'match' | 'multi'"),
  text: z.string().describe('Câu hỏi / mệnh đề. Dạng fill: dùng ___ ở chỗ điền'),
  options: z.array(z.string()).describe('mcq/multi: 3–4 lựa chọn; dạng khác: để trống'),
  answer: z.string().describe("mcq: chữ cái A/B/C/D; multi: 'A,C'; tfng: TRUE/FALSE/NOT GIVEN; ynng: YES/NO/NOT GIVEN; fill: đáp án (nhiều cách cách nhau bằng ' / '); match: chữ cái hoặc số La Mã trong bank"),
  explanation: z.string().describe('Giải thích tiếng Việt: dẫn chứng ở đoạn nào, từ khoá paraphrase'),
});
const GroupSchema = z.object({
  instruction: z.string().describe('Hướng dẫn kiểu đề thật, tiếng Anh'),
  bank: z.array(z.string()).describe('Ngân hàng lựa chọn cho match (headings i–x hoặc A–H); dạng khác để trống'),
  wordLimit: z.string().describe("vd. 'NO MORE THAN TWO WORDS AND/OR A NUMBER' hoặc rỗng"),
  questions: z.array(QuestionSchema),
});
const VocabSchema = z.array(z.object({ word: z.string(), pos: z.string(), meaning: z.string().describe('tiếng Việt'), example: z.string().describe('cụm/câu trong bài') }));

const LETTERS = 'ABCDEFGH';
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
function toGroups(groups: z.infer<typeof GroupSchema>[]): QuestionGroup[] {
  return groups.map((g) => ({
    instruction: g.instruction, bank: g.bank.length ? g.bank : undefined, wordLimit: g.wordLimit || undefined,
    questions: g.questions.map((q) => {
      const base = { no: q.no, text: q.text, explanation: q.explanation };
      const a = q.answer.trim();
      switch (q.type) {
        case 'mcq': return { ...base, type: 'mcq' as const, options: q.options, answer: Math.max(0, LETTERS.indexOf(a[0]?.toUpperCase())) };
        case 'multi': return { ...base, type: 'multi' as const, options: q.options, answer: a.split(/[,\s]+/).map((c) => LETTERS.indexOf(c.toUpperCase())).filter((x) => x >= 0) };
        case 'tfng': return { ...base, type: 'tfng' as const, answer: a.toUpperCase() as 'TRUE' };
        case 'ynng': return { ...base, type: 'ynng' as const, answer: a.toUpperCase() as 'YES' };
        case 'match': {
          let i = g.bank.findIndex((b) => b.toLowerCase() === a.toLowerCase());
          if (i < 0) i = ROMAN.indexOf(a.toLowerCase());
          if (i < 0) i = LETTERS.indexOf(a.toUpperCase());
          return { ...base, type: 'match' as const, answer: Math.max(0, i) };
        }
        default: return { ...base, type: 'fill' as const, answer: a.split(/\s*\/\s*/) };
      }
    }),
  }));
}
const toVocab = (v: z.infer<typeof VocabSchema>): Vocab[] => v.map((x) => [x.word, x.pos, x.meaning, x.example]);

const ReadingGen = z.object({
  title: z.string(), topic: z.string(), level: z.string().describe('easy | medium | hard'),
  passage: z.string().describe('Bài đọc đã chỉnh: mỗi đoạn bắt đầu bằng nhãn "A ", "B "… nếu có ≥ 4 đoạn; đoạn cách nhau bằng một dòng trống'),
  groups: z.array(GroupSchema).describe('2–3 nhóm câu hỏi, tổng 10–14 câu, mỗi nhóm một dạng khác nhau (matching headings, TFNG/YNNG, fill/summary completion, mcq, matching information)'),
  translation: z.array(z.string()).describe('Dịch tiếng Việt từng đoạn, cùng thứ tự'),
  vocab: VocabSchema.describe('12–20 từ/cụm đáng học'),
});
export async function generateReading(text: string, cfg: AiConfig, opts: { questions?: boolean } = {}): Promise<ReadingMaterial> {
  const out = await callStructured(cfg, ReadingGen,
    'Bạn là người soạn đề IELTS Reading (Academic) giàu kinh nghiệm. Giữ nguyên nội dung bài gốc (chỉ sửa định dạng, nhãn đoạn), đặt câu hỏi đúng chuẩn IELTS với paraphrase, có bẫy NOT GIVEN hợp lý, đáp án duy nhất và có dẫn chứng rõ.',
    `${opts.questions === false ? 'Chỉ cần dịch và từ vựng; groups để trống.' : 'Soạn bộ câu hỏi đầy đủ.'}\n\nBÀI ĐỌC:\n${text.trim()}`, { maxTokens: 24000 });
  return {
    id: uid(), skill: 'reading', title: out.title, topic: out.topic, level: (['easy', 'medium', 'hard'].includes(out.level) ? out.level : 'medium') as 'medium',
    passage: out.passage, groups: toGroups(out.groups), translation: out.translation, vocab: toVocab(out.vocab), addedAt: Date.now(), source: 'AI tạo từ văn bản',
  };
}

const ListeningGen = z.object({
  title: z.string(), topic: z.string(), section: z.number().describe('1–4 theo kiểu IELTS phù hợp nhất với nội dung'),
  transcript: z.string().describe('Transcript đã chỉnh: mỗi lượt lời một dòng, có tên người nói nếu là hội thoại (vd. "Receptionist: …")'),
  groups: z.array(GroupSchema).describe('2–3 nhóm, tổng 8–12 câu: form/note/table completion (fill), mcq, matching; theo đúng thứ tự xuất hiện trong bài nghe'),
  translation: z.array(z.string()).describe('Dịch từng dòng transcript (cùng số dòng)'),
  vocab: VocabSchema,
});
export async function generateListening(transcript: string, cfg: AiConfig): Promise<ListeningMaterial> {
  const out = await callStructured(cfg, ListeningGen,
    'Bạn là người soạn đề IELTS Listening. Câu hỏi phải theo thứ tự thông tin trong bài, đáp án điền từ phải xuất hiện nguyên văn trong transcript, có bẫy đổi ý (distractor) như đề thật.',
    `TRANSCRIPT:\n${transcript.trim()}`, { maxTokens: 24000 });
  return {
    id: uid(), skill: 'listening', title: out.title, topic: out.topic, section: Math.min(4, Math.max(1, Math.round(out.section))) as 1,
    transcript: out.transcript, groups: toGroups(out.groups), translation: out.translation, vocab: toVocab(out.vocab), addedAt: Date.now(), source: 'AI tạo từ transcript',
  };
}

/** Sinh kịch bản nghe mới từ chủ đề (khi người dùng không có transcript). */
export async function generateListeningFromTopic(topic: string, section: number, cfg: AiConfig) {
  const kinds: Record<number, string> = {
    1: 'a two-person everyday conversation (booking, enquiry, registration) with names, numbers, dates, addresses spelled out',
    2: 'a monologue in a social context (tour guide, announcement, talk about a facility)',
    3: 'a discussion between 2–3 students / tutor about an academic assignment',
    4: 'an academic lecture monologue',
  };
  return generateListening(`Write an original IELTS Listening Section ${section} script (${kinds[section] ?? kinds[1]}) about: ${topic}. Length 550–750 words, British English, natural spoken style with hesitations and distractors. Then create the questions.`, cfg);
}

const SpeakingGen = z.object({
  title: z.string(), topic: z.string(),
  part1: z.array(z.object({ topic: z.string(), questions: z.array(z.string()).describe('3–4 câu'), samples: z.array(z.string()).describe('Câu trả lời mẫu band 7, 2–4 câu mỗi câu hỏi, cùng thứ tự') })).describe('2 chủ đề Part 1'),
  part2: z.object({ topic: z.string(), cue: z.string().describe("'Describe a …'"), points: z.array(z.string()).describe('4 gạch đầu dòng "You should say:"'), followUp: z.array(z.string()).describe('1–2 câu hỏi nối'), sample: z.string().describe('Bài nói mẫu band 7.5, 180–230 từ, văn nói tự nhiên') }),
  part3: z.object({ questions: z.array(z.string()).describe('5–6 câu hỏi thảo luận'), samples: z.array(z.string()).describe('Trả lời mẫu band 7.5, 4–6 câu, cùng thứ tự') }),
  vocab: VocabSchema.describe('10–15 cụm từ/collocation/idiom cho chủ đề'),
});
export async function generateSpeaking(topic: string, cfg: AiConfig): Promise<SpeakingMaterial> {
  const out = await callStructured(cfg, SpeakingGen, 'Bạn là giám khảo IELTS Speaking soạn bộ đề luyện tập đúng format thi thật (Part 1 – 2 – 3 cùng chủ đề).', `Chủ đề: ${topic}`, { maxTokens: 12000 });
  return { id: uid(), skill: 'speaking', title: out.title, topic: out.topic, part1: out.part1, part2: out.part2, part3: out.part3, vocab: toVocab(out.vocab), addedAt: Date.now(), source: 'AI tạo' };
}

const WritingGen = z.object({
  title: z.string(), topic: z.string(), prompt: z.string().describe('Đề bài đúng văn phong IELTS'),
  chart: z.object({ labels: z.array(z.string()), series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })), unit: z.string(), kind: z.string().describe('line | bar | pie | table') }).describe('Chỉ cho Task 1 Academic dạng biểu đồ; dạng khác để labels rỗng'),
  outline: z.array(z.string()).describe('Dàn ý 4–5 dòng (tiếng Việt)'),
  sample: z.string().describe('Bài mẫu band 8, đúng số từ (Task 1 ≥ 150, Task 2 ≥ 270), tách đoạn bằng dòng trống'),
  vocab: VocabSchema.describe('10–15 từ/cụm học thuật trong bài mẫu'),
});
export async function generateWriting(task: 1 | 2, type: WritingType, topic: string, module: 'academic' | 'general', cfg: AiConfig): Promise<WritingMaterial> {
  const out = await callStructured(cfg, WritingGen, 'Bạn là người soạn đề IELTS Writing và viết bài mẫu band 8.',
    `Task ${task} (${module}), dạng: ${type}. Chủ đề gợi ý: ${topic || '(tự chọn chủ đề phổ biến)'}${task === 1 && module === 'academic' && ['line', 'bar', 'pie', 'table', 'mixed'].includes(type) ? '. Tạo dữ liệu biểu đồ hợp lý (4–8 nhãn, 1–4 series).' : ''}`, { maxTokens: 10000 });
  return {
    id: uid(), skill: 'writing', title: out.title, topic: out.topic, task, module, type, prompt: out.prompt,
    chart: out.chart.labels.length ? { ...out.chart, kind: (['line', 'bar', 'pie', 'table'].includes(out.chart.kind) ? out.chart.kind : 'bar') as 'bar' } : undefined,
    outline: out.outline, sample: out.sample, vocab: toVocab(out.vocab), addedAt: Date.now(), source: 'AI tạo',
  };
}

// ---------- Đoạn ngữ cảnh cho từ vựng (A4) ----------
const PassageSchema = z.object({
  title: z.string().describe('Tiêu đề ngắn, tiếng Anh'),
  passage: z.string().describe('Đoạn văn 120–180 từ, văn phong IELTS Academic, mỗi từ cần học xuất hiện đúng 1 lần và được bọc **như thế này**'),
  questions: z.array(z.object({
    q: z.string().describe('Câu hỏi tiếng Anh kiểm tra hiểu nghĩa từ trong ngữ cảnh'),
    options: z.array(z.string()).describe('4 lựa chọn'),
    answer: z.number().describe('Chỉ số lựa chọn đúng, 0–3'),
    explain: z.string().describe('Giải thích ngắn bằng tiếng Việt'),
  })).describe('3–5 câu hỏi'),
});
export type ContextPassageData = z.infer<typeof PassageSchema>;
export function contextPassage(words: { word: string; meaning: string }[], cfg: AiConfig) {
  return callStructured(cfg, PassageSchema, 'Bạn soạn bài đọc ngắn giúp người Việt học từ vựng IELTS (band 5–6.5). Câu rõ ràng, tự nhiên, không quá khó.',
    `Viết một đoạn 120–180 từ dùng TẤT CẢ các từ sau (có thể chia dạng), mỗi từ bọc **…**:\n${words.map((w) => `- ${w.word} (${w.meaning})`).join('\n')}\n\nSau đó soạn 3–5 câu hỏi trắc nghiệm 4 lựa chọn kiểm tra nghĩa các từ trong ngữ cảnh đoạn văn.`,
    { light: true, maxTokens: 3000 });
}

// ---------- Bộ từ: tạo bằng AI / chọn từ trong đoạn văn ----------
const DeckGenSchema = z.object({
  words: z.array(z.array(z.string())).describe('Mỗi phần tử: [word, pos (n/v/adj/adv/phr), nghĩa tiếng Việt ngắn, câu ví dụ tiếng Anh tự nhiên, IPA dạng /.../]'),
});
const DeckWordRow = z.tuple([z.string().min(1), z.string(), z.string().min(1), z.string(), z.string()]);
/** Sinh bộ từ theo chủ đề + band; mỗi dòng được kiểm bằng zod, dòng hỏng bị bỏ. */
export async function genDeckWords(topic: string, band: string, count: number, cfg: AiConfig) {
  const n = Math.max(10, Math.min(50, count));
  const out = await callStructured(cfg, DeckGenSchema, 'Bạn soạn bộ từ vựng IELTS cho người Việt. Chọn từ/cụm hữu ích cho Writing/Speaking, không trùng, đúng trình độ.',
    `Chủ đề: ${topic}\nBand mục tiêu: ${band || '6.5'}\nSố từ: đúng ${n}.\nTrả về JSON { "words": [[word, pos, vi, example, ipa], ...] }.`, { light: true, maxTokens: 6000 });
  const seen = new Set<string>();
  return out.words.map((r) => DeckWordRow.safeParse([...r, '', '', ''].slice(0, 5))).filter((r) => r.success).map((r) => r.data!)
    .filter(([w]) => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map(([word, pos, vi, ex, ipa]) => ({ word, pos, vi, ex: ex || undefined, ipa: ipa || undefined }));
}
const PickSchema = z.object({
  words: z.array(z.object({ word: z.string().describe('Từ/cụm đúng như trong đoạn (dạng gốc nếu cần)'), pos: z.string(), vi: z.string().describe('Nghĩa tiếng Việt theo ngữ cảnh'), sentence: z.string().describe('Nguyên câu trong đoạn chứa từ') })),
});
/** Gợi ý 10–20 từ đáng học trong một đoạn văn, kèm câu gốc làm ví dụ. */
export async function pickPassageWords(text: string, cfg: AiConfig) {
  const out = await callStructured(cfg, PickSchema, 'Bạn giúp người Việt học IELTS chọn từ vựng học thuật đáng học (bỏ từ quá dễ).',
    `Chọn 10–20 từ/cụm đáng học nhất trong đoạn sau, kèm nghĩa Việt theo ngữ cảnh và nguyên câu chứa từ:\n\n${text.slice(0, 6000)}`, { light: true, maxTokens: 4000 });
  return out.words.filter((w) => w.word.trim()).map((w) => ({ word: w.word.trim(), pos: w.pos, vi: w.vi, ex: w.sentence }));
}
