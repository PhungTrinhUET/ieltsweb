// Ôn từ vựng kiểu hộp Leitner (5 hộp) – đơn giản: chỉ "Nhớ" / "Chưa nhớ".
//   Nhớ  → lên 1 hộp (hộp càng cao càng lâu mới ôn lại).  Chưa nhớ → về hộp 1.
//   Hộp 1: mỗi ngày · 2: sau 2 ngày · 3: 4 ngày · 4: 8 ngày · 5 (đã thuộc): 16 ngày, nhớ tiếp → 30 ngày.
// Thẻ cũ (SM-2: interval/reps) được xếp hộp theo khoảng ôn đã có, không mất tiến độ.
import type { VocabCard } from '../types';

const DAY = 864e5;
export const BOX_DAYS = [0, 1, 2, 4, 8, 16] as const;
export const BOX_NAMES = ['', 'Mới học', 'Đang nhớ', 'Khá nhớ', 'Nhớ lâu', 'Đã thuộc'] as const;
export const BOX_HINT = ['', 'ôn mỗi ngày', 'sau 2 ngày', 'sau 4 ngày', 'sau 8 ngày', 'sau 16+ ngày'] as const;
export type Box = 1 | 2 | 3 | 4 | 5;

export const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const endOfDay = (t = Date.now()) => startOfDay(t) + DAY - 1;

/** Thẻ đã được học lần nào chưa (từ mới thì chưa). */
export const isLearned = (c: VocabCard) => !!c.learnedAt || c.reps > 0 || c.lapses > 0;

export function boxOf(c: VocabCard): Box {
  if (c.box) return c.box as Box;
  if (!isLearned(c)) return 1;
  return c.interval <= 1 ? 1 : c.interval <= 2 ? 2 : c.interval <= 5 ? 3 : c.interval <= 12 ? 4 : 5;
}

/** Chấm một thẻ. `remembered` = Nhớ. Hạn ôn tính theo ngày (đầu ngày), nên "đến hạn hôm nay" là cả ngày. */
export function review(card: VocabCard, remembered: boolean, now = Date.now()): VocabCard {
  const cur = boxOf(card);
  const box: Box = remembered ? (Math.min(5, cur + 1) as Box) : 1;
  const days = remembered && cur === 5 ? 30 : BOX_DAYS[box];
  return {
    ...card, box, interval: days, reps: remembered ? card.reps + 1 : card.reps, lapses: remembered ? card.lapses : card.lapses + 1,
    due: startOfDay(now) + days * DAY, lastReview: now, learnedAt: card.learnedAt ?? now,
  };
}

/** Học từ mới lần đầu: vào hộp 1, ôn lại ngày mai. */
export function learn(card: VocabCard, now = Date.now()): VocabCard {
  return { ...card, box: 1, interval: 1, due: startOfDay(now) + DAY, lastReview: now, learnedAt: now };
}

export const newCard = (c: Omit<VocabCard, 'due' | 'interval' | 'ease' | 'reps' | 'lapses' | 'addedAt'>): VocabCard =>
  ({ ...c, addedAt: Date.now(), due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0 });

/** Thẻ đã học và đến hạn ôn trong hôm nay. */
export function dueCards(cards: VocabCard[], now = Date.now()) {
  return cards.filter((c) => isLearned(c) && c.due <= endOfDay(now)).sort((a, b) => boxOf(a) - boxOf(b) || a.due - b.due);
}
/** Số từ mới đã học trong hôm nay. */
export const learnedToday = (cards: VocabCard[], now = Date.now()) => cards.filter((c) => c.learnedAt && c.learnedAt >= startOfDay(now)).length;
export const reviewedToday = (cards: VocabCard[], now = Date.now()) => cards.some((c) => c.lastReview && c.lastReview >= startOfDay(now));

/** "sau 4 ngày" cho một thẻ. */
export function dueText(c: VocabCard, now = Date.now()) {
  if (!isLearned(c)) return 'chưa học';
  const d = Math.round((startOfDay(c.due) - startOfDay(now)) / DAY);
  return d <= 0 ? 'đến hạn hôm nay' : d === 1 ? 'ôn lại ngày mai' : `ôn lại sau ${d} ngày`;
}
