// C. Nối Nghe-chép ↔ Từ vựng.
//   - Câu chép < 90% (hoặc phải xem đáp án) → thẻ "Câu hay sai" (kind 'sentence') trong cùng lịch FSRS, ôn bằng chép lại câu.
//   - Từ gõ sai / phải gợi ý → thêm vào vốn từ ("Sẽ học", bộ Đã lưu) kèm câu gốc + đoạn audio.
import { findCard, getVocab, saveCard } from '../db';
import type { VocabCard } from '../types';
import { finishLearning, newCard } from './srs';
import { bare, check, type DSentence, type Lesson } from './dictation';
import { isKeyword } from './text';
import { srcLabel } from './context';
import { cardId, loadDecks } from './vocab';
import { freeTranslate } from './freeTranslate';

const sentId = (lessonId: string, s: DSentence) => `s-${lessonId.replace(/~.*$/, '')}-${Math.round((s.start ?? 0) * 10)}-${s.text.length}`;

/** Gọi khi rời một câu đã chép. Trả về các từ được gợi ý vào vốn từ. */
export async function fromDictation(lesson: Lesson, s: DSentence, typed: string, r: { score: number; hint: number; shown: boolean }): Promise<string[]> {
  if (lesson.level < 2) return []; // cấp 1 (số, đánh vần) không tạo thẻ
  const bad = r.shown || r.score < 0.9;
  const label = lesson.materialId ? srcLabel(lesson.materialId) : lesson.title;
  const clip = lesson.audio && s.start != null && s.end != null ? { audio: lesson.audio, start: s.start, end: s.end } : {};
  if (bad) {
    const id = sentId(lesson.id, s);
    if (!getVocab()[id]) {
      const c = newCard({ id, kind: 'sentence', word: s.text, meaning: label, from: lesson.materialId, decks: ['dict'], context: { text: s.text, label, ref: lesson.materialId, ...clip } });
      await saveCard(finishLearning(c, 3)); // vào lịch ôn ngay (Hard → ôn lại sớm)
    }
  }
  // Từ gợi ý: từ khoá bị sai/thiếu (hoặc cả câu khi đã xem đáp án / dùng gợi ý).
  const res = check(s.text, typed);
  const words = res.wrongWords.map(bare).filter((w) => isKeyword(w) && !/^[A-Z]/.test(w));
  const cand = [...new Set(words.map((w) => w.toLowerCase()))].filter((w) => !findCard(w)).slice(0, 3);
  if (!cand.length || (!bad && !r.hint && res.score >= 1)) return [];
  const deck = new Map((await loadDecks()).flatMap((d) => d.words.map((w) => [w.word.toLowerCase(), w] as const)));
  const out: string[] = [];
  for (const w of cand) {
    const d = deck.get(w);
    const card: VocabCard = newCard({
      id: d ? cardId(d.word) : `v-${w}-${Date.now().toString(36)}`, word: d?.word ?? w, pos: d?.pos, meaning: d?.vi ?? '', example: d?.ex, ipa: d?.ipa, meaningEn: d?.en,
      exampleVi: d?.exVi, colloc: d?.colloc, from: lesson.materialId, decks: ['saved'], note: 'Từ nghe-chép chưa đúng',
      context: { text: s.text, label, ref: lesson.materialId, ...clip },
    });
    await saveCard(card);
    out.push(card.word);
    if (!card.meaning) freeTranslate(w).then((vi) => { const cur = getVocab()[card.id]; if (cur && !cur.meaning) saveCard({ ...cur, meaning: vi.trim() }); }).catch(() => {});
  }
  return out;
}
