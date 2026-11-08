import type { Material } from '../types';

/**
 * Gom chủ đề tự do (`topic` trong content: "Daily life", "History & Society", …) về ~11 nhóm cố định.
 * Speaking không có topic hữu ích ("Part 2") → phân theo cue card: người / nơi chốn / đồ vật / trải nghiệm / hoạt động.
 */
const GROUPS: [string, RegExp][] = [
  ['Giáo dục', /educat|school|universit|stud(y|ent)|course|lecture|learn|teach|linguist|language|research|librar|book|read/i],
  ['Công việc & kinh doanh', /work|job|business|econom|financ|market|company|employ|career|money|trade|industr|shop/i],
  ['Khoa học & công nghệ', /scien|technolog|engineer|astronom|physic|chemi|computer|internet|robot|invent|digital|media|communicat/i],
  ['Thiên nhiên & môi trường', /environment|nature|animal|biolog|agricultur|farm|energy|weather|climate|plant|ocean|forest|wildlife|geograph|water/i],
  ['Sức khoẻ & tâm lý', /health|medic|psycholog|mind|brain|food|diet|sleep/i],
  ['Lịch sử & khảo cổ', /histor|archaeolog|anthropolog|ancient|biograph/i],
  ['Văn hoá & nghệ thuật', /cultur|art\b|arts|music|literatur|photograph|design|film|museum|festival|entertain/i],
  ['Du lịch, giải trí & thể thao', /travel|touris|leisure|holiday|event|hobby|trip|sport|fitness|football|olymp/i],
  ['Thành phố & giao thông', /transport|town|urban|city|architect|building|infrastructur|housing|accommodat|traffic/i],
  ['Đời sống & xã hội', /societ|communit|famil|daily|home|servic|charit|government|people|\blife\b|crime|\bage\b/i],
];
export const OTHER = 'Khác';
export const TOPIC_GROUPS = [...GROUPS.map((g) => g[0]), OTHER];

const SPEAKING: [string, RegExp][] = [
  ['Người', /\b(person|people|friend|child|family member|teacher|neighbou?r|someone|sportsperson|businessperson|foreigner|singer|leader|man|woman|couple|neighbourhood friend)\b/i],
  ['Nơi chốn', /\b(place|city|town|country|building|park|restaurant|house|home|room|cafe|shop|area|garden|street|museum|school|beach|village|countryside|website|facility)\b/i],
  ['Sự kiện & trải nghiệm', /\b(time|occasion|event|experience|day|trip|journey|holiday|vacation|conversation|party|celebration|mistake|decision|change|news|story|plan|visit|period|moment|lesson|goal|problem|task|meal|routine|achievement|challenge|walk|rule|ambition|promise|competition)\b/i],
  ['Hoạt động & sở thích', /\b(activity|hobby|sport|game|habit|skill|job|programme|program|film|movie|music|song|show|exercise|subject|course|TV series|series|performance|puzzle|something you (?:do|did|would like to learn))\b/i],
  ['Đồ vật', /\b(thing|object|item|gift|present|book|photo|picture|app|device|toy|piece|clothes|product|invention|text message|letter|advertisement|prize|food|video|painting|work of art|something|somethings)\b/i],
];
export const SPEAKING_GROUPS = [...SPEAKING.map((g) => g[0]), OTHER];

/** Nhóm có từ khoá xuất hiện sớm nhất trong chuỗi thắng ("History & Environment" → Lịch sử). */
function earliest(text: string, groups: [string, RegExp][]): string | null {
  let best: string | null = null; let at = Infinity;
  for (const [name, re] of groups) { const i = text.search(re); if (i !== -1 && i < at) { at = i; best = name; } }
  return best;
}

export function topicGroup(m: Material): string {
  if (m.skill === 'speaking') {
    const cue = m.part2 ? `${m.part2.cue ?? ''} ${m.part2.topic ?? ''}` : m.title;
    return earliest(cue.replace(/^\s*describe\s+/i, ''), SPEAKING) ?? OTHER;
  }
  return (m.topic && earliest(m.topic, GROUPS)) ?? earliest(m.title, GROUPS) ?? OTHER;
}
