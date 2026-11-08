// Lặp lại ngắt quãng (SM-2 rút gọn, giống Anki): 4 mức – Quên / Khó / Tốt / Dễ.
import type { VocabCard } from '../types';

export type Grade = 0 | 1 | 2 | 3;
const DAY = 864e5;

export function review(card: VocabCard, g: Grade, now = Date.now()): VocabCard {
  let { interval, ease, reps, lapses } = card;
  if (g === 0) {
    lapses++; reps = 0; interval = 0; ease = Math.max(1.3, ease - 0.2);
    return { ...card, interval, ease, reps, lapses, due: now + 10 * 60e3 };
  }
  if (reps === 0) interval = g === 1 ? 1 : g === 2 ? 1 : 4;
  else if (reps === 1) interval = g === 1 ? 3 : g === 2 ? 6 : 10;
  else interval = Math.round(interval * (g === 1 ? 1.2 : g === 2 ? ease : ease * 1.3));
  ease = Math.max(1.3, ease + (g === 1 ? -0.15 : g === 2 ? 0 : 0.15));
  reps++;
  return { ...card, interval, ease, reps, lapses, due: now + interval * DAY };
}

export const newCard = (c: Omit<VocabCard, 'due' | 'interval' | 'ease' | 'reps' | 'lapses' | 'addedAt'>): VocabCard =>
  ({ ...c, addedAt: Date.now(), due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0 });

export function dueCards(cards: VocabCard[], now = Date.now()) {
  return cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due);
}
export const previewInterval = (card: VocabCard, g: Grade) => {
  const n = review(card, g);
  const d = n.due - Date.now();
  if (d < 3600e3) return `${Math.round(d / 60e3)} ph`;
  if (d < DAY * 1.5) return '1 ngày';
  return `${Math.round(d / DAY)} ngày`;
};
