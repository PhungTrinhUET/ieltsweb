// Lịch ôn FSRS (ts-fsrs) cho thẻ từ và thẻ câu (nghe-chép hay sai) – một engine chung.
//   Trạng thái hiển thị: Sẽ học → Đang học → Ôn tập → Đã thuộc (stability ≥ 60 ngày).
//   Không tự chấm: kết quả bài tập → điểm FSRS (autoRating).
//   Thẻ Leitner cũ (box 1..5) → stability 1/2/4/8/16 ngày, giữ nguyên hạn ôn (migrate).
import { fsrs, createEmptyCard, Rating, State, type Card, type FSRS, type Grade } from 'ts-fsrs';
import type { VocabCard } from '../types';
import { getSettings } from '../store';

export const DAY = 864e5;
export const KNOWN_DAYS = 60;
const BOX_DAYS = [0, 1, 2, 4, 8, 16] as const;

export const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const endOfDay = (t = Date.now()) => startOfDay(t) + DAY - 1;

export type WordState = 'new' | 'learning' | 'review' | 'known';
export const STATE_NAMES: Record<WordState, string> = { new: 'Sẽ học', learning: 'Đang học', review: 'Ôn tập', known: 'Đã thuộc' };
export const STATE_ORDER: WordState[] = ['new', 'learning', 'review', 'known'];

/** Đã vào lịch ôn (học xong các bước, hoặc thẻ cũ đã học). */
export const isLearned = (c: VocabCard) => c.stability != null && (c.fsrsState ?? 0) !== State.New;

export function cardState(c: VocabCard): WordState {
  if (!isLearned(c)) return c.stage ? 'learning' : 'new';
  if (c.fsrsState === State.Learning || c.fsrsState === State.Relearning) return 'learning';
  return (c.stability ?? 0) >= KNOWN_DAYS ? 'known' : 'review';
}

let cached: { r: number; f: FSRS } | null = null;
/** Scheduler theo retention trong Cài đặt. Bước ngắn hạn do app tự làm (A2) nên tắt short-term. */
export function scheduler() {
  const r = Math.min(0.95, Math.max(0.85, getSettings().retention ?? 0.9));
  if (cached?.r !== r) cached = { r, f: fsrs({ request_retention: r, enable_short_term: false, enable_fuzz: true, maximum_interval: 3650 }) };
  return cached.f;
}

/** Thẻ cũ (Leitner/SM-2) → FSRS. Trả về null nếu không cần đổi. */
export function migrate(c: VocabCard): VocabCard | null {
  if (c.stability != null) return null;
  const learned = !!c.learnedAt || c.reps > 0 || c.lapses > 0 || !!c.box;
  if (!learned) return null; // từ chưa học: vẫn là "Sẽ học", không cần ghi
  const box = c.box ?? (c.interval <= 1 ? 1 : c.interval <= 2 ? 2 : c.interval <= 5 ? 3 : c.interval <= 12 ? 4 : 5);
  const s = BOX_DAYS[Math.min(5, Math.max(1, box))];
  return {
    ...c, stability: s, difficulty: 5, fsrsState: State.Review, learningSteps: 0, scheduledDays: c.interval || s,
    lastReview: c.lastReview ?? Math.max(c.addedAt, c.due - s * DAY), learnedAt: c.learnedAt ?? c.lastReview ?? c.addedAt,
  };
}

function toFsrs(c: VocabCard): Card {
  if (!isLearned(c)) return createEmptyCard(new Date(c.due));
  return {
    due: new Date(c.due), stability: c.stability!, difficulty: c.difficulty ?? 5, elapsed_days: 0, scheduled_days: c.scheduledDays ?? c.interval ?? 0,
    learning_steps: c.learningSteps ?? 0, reps: c.reps, lapses: c.lapses, state: (c.fsrsState ?? State.Review) as State,
    last_review: c.lastReview ? new Date(c.lastReview) : undefined,
  };
}
function fromFsrs(c: VocabCard, f: Card, now: number): VocabCard {
  return {
    ...c, due: f.due.getTime(), stability: f.stability, difficulty: f.difficulty, fsrsState: f.state, learningSteps: f.learning_steps,
    scheduledDays: f.scheduled_days, interval: f.scheduled_days, reps: f.reps, lapses: f.lapses, lastReview: now, learnedAt: c.learnedAt ?? now, box: undefined, stage: undefined,
  };
}

/** Chấm một lượt ôn. Thẻ "Again" quay lại sau 10 phút trong phiên (do app hỏi lại cuối phiên); FSRS lo hạn ngày. */
export function grade(c: VocabCard, rating: Grade, now = Date.now()): VocabCard {
  return fromFsrs(c, scheduler().next(toFsrs(c), new Date(now), rating).card, now);
}
/** Học xong các bước từ mới (A2) → vào lịch ôn như một lần "Good" (hoặc "Hard" nếu sai nhiều). */
export function finishLearning(c: VocabCard, mistakes = 0, now = Date.now()): VocabCard {
  const base = { ...c, stability: undefined, fsrsState: State.New };
  return grade(base, mistakes >= 3 ? Rating.Hard : Rating.Good, now);
}
/** "Tôi biết từ này": bỏ qua phần học, vào lịch như Easy. */
export const markKnown = (c: VocabCard, now = Date.now()) => grade(isLearned(c) ? c : { ...c, stability: undefined, fsrsState: State.New }, Rating.Easy, now);

/** Kết quả bài tập → điểm FSRS (không tự chấm). */
export function autoRating(r: { ok: boolean; hint?: boolean; near?: boolean; ms?: number; typing?: boolean }): Grade {
  if (!r.ok) return Rating.Again;
  if (r.hint || r.near || (r.ms ?? 0) > 10_000) return Rating.Hard;
  if (r.typing && (r.ms ?? Infinity) < 5_000) return Rating.Easy;
  return Rating.Good;
}

/** Khả năng nhớ hiện tại (0–1). */
export function retrievability(c: VocabCard, now = Date.now()) {
  if (!isLearned(c)) return 0;
  return scheduler().get_retrievability(toFsrs(c), new Date(now), false) as number;
}

export const newCard = (c: Omit<VocabCard, 'due' | 'interval' | 'ease' | 'reps' | 'lapses' | 'addedAt'>): VocabCard =>
  ({ ...c, addedAt: Date.now(), due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0 });

/** Thẻ đến hạn trong hôm nay, yếu nhất (khả năng nhớ thấp nhất) trước. */
export function dueCards(cards: VocabCard[], now = Date.now()) {
  return cards.filter((c) => isLearned(c) && c.due <= endOfDay(now))
    .map((c) => [c, retrievability(c, now)] as const).sort((a, b) => a[1] - b[1]).map(([c]) => c);
}
/** Số từ mới đã học xong trong hôm nay. */
export const learnedToday = (cards: VocabCard[], now = Date.now()) => cards.filter((c) => c.learnedAt && c.learnedAt >= startOfDay(now) && c.kind !== 'sentence').length;
export const reviewedToday = (cards: VocabCard[], now = Date.now()) => cards.some((c) => c.lastReview && c.lastReview >= startOfDay(now));

/** Số thẻ đến hạn mỗi ngày trong `days` ngày tới (hôm nay = các thẻ quá hạn + hạn hôm nay). */
export function forecast(cards: VocabCard[], days = 7, now = Date.now()) {
  const out = new Array(days).fill(0);
  const t0 = startOfDay(now);
  for (const c of cards) if (isLearned(c)) {
    const d = Math.max(0, Math.floor((c.due - t0) / DAY));
    if (d < days) out[d]++;
  }
  return out;
}

/** "ôn lại sau 4 ngày" cho một thẻ. */
export function dueText(c: VocabCard, now = Date.now()) {
  if (!isLearned(c)) return c.stage ? 'đang học' : 'chưa học';
  const d = Math.round((startOfDay(c.due) - startOfDay(now)) / DAY);
  return d <= 0 ? 'đến hạn hôm nay' : d === 1 ? 'ôn lại ngày mai' : `ôn lại sau ${d} ngày`;
}
export { Rating };
