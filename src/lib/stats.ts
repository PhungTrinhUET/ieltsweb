// C. Số liệu chung cho Từ vựng + Nghe-chép: XP, chuỗi ngày học, kế hoạch "Hôm nay", trang Thống kê.
//   Mọi con số đọc từ nhật ký `revlog` (mỗi câu trả lời một dòng) + lượt làm đề (`attempts`).
import type { Attempt, RevLog, VocabCard } from '../types';
import { cardState, DAY, dueCards, forecast, learnedToday, startOfDay, STATE_ORDER, type WordState } from './srs';

/** Khoá ngày theo giờ máy (YYYY-MM-DD). */
export const dayKey = (t: number | Date = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const logsSince = (logs: RevLog[], t: number) => logs.filter((l) => l.at >= t);
export const xpSum = (logs: RevLog[]) => logs.reduce((s, l) => s + (l.xp || 0), 0);

/** Ngày có học: có câu trả lời, có lượt làm đề, hoặc đã đánh dấu streak cũ. */
export function activeDays(logs: RevLog[], attempts: Attempt[], extra: string[] = []) {
  const s = new Set(extra);
  for (const l of logs) s.add(dayKey(l.at));
  for (const a of attempts) s.add(dayKey(a.at));
  return s;
}

/** Chuỗi ngày liên tiếp tính tới hôm nay (hoặc hôm qua nếu hôm nay chưa học). */
export function streakOf(days: Set<string>, now = Date.now()) {
  let t = startOfDay(now);
  if (!days.has(dayKey(t))) t -= DAY;
  let n = 0;
  while (days.has(dayKey(t))) { n++; t -= DAY; }
  return n;
}

export interface PlanItem { id: 'review' | 'learn' | 'dict' | 'context'; label: string; sub: string; to: string; done: boolean; progress: number }

/** Kế hoạch hôm nay: Ôn N từ → Học 5 từ mới → Nghe chép 10 câu → Đoạn ngữ cảnh. */
export function todayPlan(cards: VocabCard[], logs: RevLog[], o: { newPerDay: number }, now = Date.now()): PlanItem[] {
  const t0 = startOfDay(now);
  const today = logsSince(logs, t0);
  const due = dueCards(cards, now).length;
  const reviewed = today.filter((l) => l.rating != null).length;
  const learned = learnedToday(cards, now);
  const learnGoal = Math.max(1, Math.min(5, o.newPerDay || 5));
  const dict = today.filter((l) => l.kind === 'dictation').length;
  const ctx = today.some((l) => l.kind === 'context');
  const learnedAny = cards.some((c) => c.kind !== 'sentence' && c.stability != null);
  return [
    { id: 'review', label: due ? `Ôn ${due} từ` : 'Ôn từ đến hạn', sub: due ? 'thẻ đến hạn, yếu nhất trước' : reviewed ? `đã ôn ${reviewed} lượt` : 'không có từ đến hạn',
      to: due ? '/vocab/review' : '/vocab', done: due === 0, progress: due === 0 ? 1 : reviewed / (reviewed + due) },
    { id: 'learn', label: `Học ${learnGoal} từ mới`, sub: `${Math.min(learned, learnGoal)}/${learnGoal} từ hôm nay`, to: '/vocab/learn', done: learned >= learnGoal, progress: Math.min(1, learned / learnGoal) },
    { id: 'dict', label: 'Nghe chép 10 câu', sub: `${Math.min(dict, 10)}/10 câu`, to: '/dictation', done: dict >= 10, progress: Math.min(1, dict / 10) },
    { id: 'context', label: 'Đoạn ngữ cảnh', sub: learnedAny ? 'đọc đoạn văn chứa từ vừa học' : 'học vài từ trước', to: '/vocab/context', done: ctx, progress: ctx ? 1 : 0 },
  ];
}

/** Đếm thẻ từ theo trạng thái (không tính thẻ câu). */
export function stateCounts(cards: VocabCard[]) {
  const n = Object.fromEntries(STATE_ORDER.map((s) => [s, 0])) as Record<WordState, number>;
  for (const c of cards) if (c.kind !== 'sentence') n[cardState(c)]++;
  return n;
}

/** Retention thật 30 ngày: tỉ lệ lượt ôn theo lịch không bị "Quên" (rating > 1). */
export function retention30(logs: RevLog[], now = Date.now()) {
  const r = logsSince(logs, now - 30 * DAY).filter((l) => l.rating != null);
  return { n: r.length, rate: r.length ? r.filter((l) => (l.rating ?? 0) > 1).length / r.length : null };
}

export function dictStats(logs: RevLog[], now = Date.now()) {
  const d = logs.filter((l) => l.kind === 'dictation');
  const m = logsSince(d, now - 30 * DAY);
  return { total: d.length, right: d.filter((l) => l.ok).length, right30: m.filter((l) => l.ok).length, avg30: m.length ? m.reduce((s, l) => s + (l.score ?? 0), 0) / m.length : null };
}

/** Lịch hoạt động `weeks` tuần (cột = tuần, hàng = thứ, bắt đầu thứ Hai). */
export function heatmap(logs: RevLog[], attempts: Attempt[], weeks = 18, now = Date.now()) {
  const per = new Map<string, { n: number; xp: number }>();
  const add = (t: number, xp: number) => { const k = dayKey(t); const v = per.get(k) ?? { n: 0, xp: 0 }; v.n++; v.xp += xp; per.set(k, v); };
  for (const l of logs) add(l.at, l.xp || 0);
  for (const a of attempts) add(a.at, 5);
  const today = startOfDay(now);
  const dow = (new Date(today).getDay() + 6) % 7; // 0 = thứ Hai
  const start = today - (dow + (weeks - 1) * 7) * DAY;
  const cells: { key: string; t: number; n: number; xp: number; future: boolean }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    // giữa chừng có thể lệch 1 giờ khi đổi giờ mùa hè; làm tròn về đầu ngày
    const t = startOfDay(start + i * DAY + 3 * 3600e3);
    const v = per.get(dayKey(t)) ?? { n: 0, xp: 0 };
    cells.push({ key: dayKey(t), t, ...v, future: t > today });
  }
  return cells;
}

export { forecast };
