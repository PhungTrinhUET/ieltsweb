// Nghe & chép (B3 + B6): tách câu từ transcript có mốc thời gian, chia bài 10–15 câu, chấm khớp có quy đổi.
//   - Bỏ lời dẫn của đề (Narrator / "You will hear…") và đoạn ví dụ phát lại ở Section 1.
//   - Câu 1–2 từ ghép vào câu bên cạnh; câu > 20 từ tách ở dấu phẩy / liên từ thành đoạn 6–15 từ.
//   - Mốc audio: trong một lượt nói, chia thời gian theo số ký tự (ước lượng tốc độ nói để bỏ khoảng lặng cuối lượt), đệm 0.3 s.
//   - Chấm: không phân biệt hoa thường, bỏ dấu câu, số ↔ chữ, viết tắt, chính tả Anh/Mỹ, gạch nối, OK/okay, %/per cent, £35/35 pounds.
//     Sai đúng một chữ cái = "gần đúng" (nửa điểm).
import type { ListeningMaterial, Material, Segment } from '../types';
import { sentences as splitSentences } from './text';

// ---------------------------------------------------------------- chuẩn hoá
const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORD: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30 };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON_SHORT: Record<string, string> = { jan: 'january', feb: 'february', mar: 'march', apr: 'april', jun: 'june', jul: 'july', aug: 'august', sep: 'september', sept: 'september', oct: 'october', nov: 'november', dec: 'december' };

const CONTRACT: Record<string, string> = {
  "can't": 'can not', cannot: 'can not', "won't": 'will not', "shan't": 'shall not', "let's": 'let us', "it's": 'it is', "that's": 'that is',
  "there's": 'there is', "here's": 'here is', "what's": 'what is', "where's": 'where is', "who's": 'who is', "he's": 'he is', "she's": 'she is',
  "how's": 'how is', "y'all": 'you all', "ma'am": 'madam', okay: 'ok', 'o.k.': 'ok',
};
// Mỹ → Anh (từ hay gặp). Quy tắc chung -ize → -ise, -yze → -yse xử lý riêng.
const US_UK: Record<string, string> = {
  color: 'colour', favor: 'favour', favorite: 'favourite', honor: 'honour', humor: 'humour', labor: 'labour', neighbor: 'neighbour', neighborhood: 'neighbourhood',
  behavior: 'behaviour', flavor: 'flavour', harbor: 'harbour', rumor: 'rumour', vapor: 'vapour', savior: 'saviour', endeavor: 'endeavour', odor: 'odour', armor: 'armour',
  center: 'centre', theater: 'theatre', meter: 'metre', liter: 'litre', fiber: 'fibre', kilometer: 'kilometre', centimeter: 'centimetre', millimeter: 'millimetre',
  program: 'programme', catalog: 'catalogue', dialog: 'dialogue', analog: 'analogue', defense: 'defence', offense: 'offence', license: 'licence', practice: 'practise',
  traveling: 'travelling', traveled: 'travelled', traveler: 'traveller', canceled: 'cancelled', canceling: 'cancelling', labeled: 'labelled', labeling: 'labelling',
  modeling: 'modelling', modeled: 'modelled', fueled: 'fuelled', jewelry: 'jewellery', gray: 'grey', tire: 'tyre', curb: 'kerb', mold: 'mould', plow: 'plough',
  check: 'cheque', aluminum: 'aluminium', pajamas: 'pyjamas', enroll: 'enrol', enrollment: 'enrolment', fulfill: 'fulfil', skillful: 'skilful', aging: 'ageing',
  judgment: 'judgement', acknowledgment: 'acknowledgement', mustache: 'moustache', math: 'maths', esthetic: 'aesthetic', pediatric: 'paediatric', anemia: 'anaemia',
  encyclopedia: 'encyclopaedia', archeology: 'archaeology', fetus: 'foetus', maneuver: 'manoeuvre', percent: 'percent', 'e-mail': 'email', 'per-cent': 'percent',
};
const ukify = (w: string) => {
  const s = US_UK[w] ?? w;
  if (s !== w) return s;
  // -ize/-ization/-yze → -ise/-isation/-yse (trừ size, prize, seize…)
  if (/^(size|sized|prize|prized|seize|seized|seizes|seizing|capsize|maize|baize)$/.test(w)) return w;
  return w.replace(/(\w{3,})iz(e|es|ed|ing|ation|ations|er|ers)$/, '$1is$2').replace(/(\w{2,})yz(e|es|ed|ing)$/, '$1ys$2').replace(/(\w{3,})or$/, (m, a) => (US_UK[`${a}or`] ? US_UK[`${a}or`] : m));
};

/** Một từ gốc → các token chuẩn (chưa xử lý số). */
function baseTokens(raw: string): string[] {
  let s = raw.toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”"]/g, '');
  // tiền & phần trăm & giờ trước khi bỏ dấu câu
  s = s.replace(/£\s?(\d+)\.(\d{2})\b/g, '$1 pounds $2').replace(/£\s?(\d[\d,]*)/g, '$1 pounds').replace(/\$\s?(\d[\d,]*)/g, '$1 dollars')
    .replace(/(\d)\s?%/g, '$1 percent').replace(/\bper\s?cent\b/g, 'percent')
    .replace(/(\d),(\d{3})\b/g, '$1$2').replace(/(\d)[.:](\d)/g, '$1$2')
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1 #ord').replace(/(\d+)(am|pm)\b/g, '$1 $2').replace(/\b(a\.m\.|p\.m\.)/g, (m) => m.replace(/\./g, ''));
  const out: string[] = [];
  for (let w of s.split(/[\s\-–—/]+/)) {
    w = w.replace(/^[^a-z0-9#'@]+|[^a-z0-9#]+$/g, '');
    if (!w) continue;
    if (CONTRACT[w]) { out.push(...CONTRACT[w].split(' ')); continue; }
    const m = w.match(/^(\w+)(n't|'m|'re|'ve|'ll|'d)$/);
    if (m) {
      const head = m[2] === "n't" ? m[1] : m[1];
      const tail = { "n't": 'not', "'m": 'am', "'re": 'are', "'ve": 'have', "'ll": 'will', "'d": 'would' }[m[2]]!;
      out.push(head, tail); continue;
    }
    w = w.replace(/'s$/, 's').replace(/'/g, '').replace(/[^a-z0-9#@]/g, '');
    if (!w) continue;
    if (w === 'pound') w = 'pounds';
    if (MON_SHORT[w]) w = MON_SHORT[w];
    out.push(ukify(w));
  }
  return out;
}

/** Số viết chữ → số; "oh"/"double"/"triple" trong dãy số; ordinal → "#ord"; dãy số liền nhau gộp một (số điện thoại, năm). */
function numberize(toks: { t: string; src: number[] }[]) {
  const isNumWord = (w: string) => UNITS.includes(w) || TEENS.includes(w) || TENS.includes(w) || w === 'hundred' || w === 'thousand' || w === 'million' || ORD[w] != null || /^(\w+)-?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)$/.test(w);
  const isDigit = (w: string) => /^\d+$/.test(w);
  const out: { t: string; src: number[] }[] = [];
  let i = 0;
  while (i < toks.length) {
    const w = toks[i].t;
    // "oh" / "o" chỉ là số 0 khi đứng cạnh số
    const near = (k: number) => k >= 0 && k < toks.length && (isDigit(toks[k].t) || isNumWord(toks[k].t) || toks[k].t === 'double' || toks[k].t === 'triple');
    if ((w === 'oh' || w === 'o') && (near(i - 1) || near(i + 1)) && !(i === 0 && !near(i + 1))) { out.push({ t: '0', src: toks[i].src }); i++; continue; }
    if ((w === 'double' || w === 'triple') && i + 1 < toks.length) {
      const n = w === 'double' ? 2 : 3;
      const nx = toks[i + 1].t;
      const d = isDigit(nx) && nx.length === 1 ? nx : UNITS.indexOf(nx) >= 0 ? String(UNITS.indexOf(nx)) : nx === 'oh' || nx === 'o' ? '0' : null;
      if (d != null) { out.push({ t: d.repeat(n), src: [...toks[i].src, ...toks[i + 1].src] }); i += 2; continue; }
      if (/^[a-z]$/.test(nx)) { out.push({ t: nx.repeat(n), src: [...toks[i].src, ...toks[i + 1].src] }); i += 2; continue; }
    }
    if (isNumWord(w) || (w === 'a' && (toks[i + 1]?.t === 'hundred' || toks[i + 1]?.t === 'thousand'))) {
      // gom một cụm số viết chữ
      let total = 0, cur = 0, j = i, used = false, ord = false;
      const src: number[] = [];
      const flush = () => { if (!used) return; out.push({ t: String(total + cur), src: [...src] }); if (ord) out.push({ t: '#ord', src: [...src] }); total = 0; cur = 0; used = false; ord = false; src.length = 0; };
      for (; j < toks.length; j++) {
        let x = toks[j].t;
        let isOrd = false;
        const om = x.match(/^(\w+?)-?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)$/);
        if (ORD[x] != null) { isOrd = true; }
        else if (om && TENS.includes(om[1])) { // twentyfirst (sau khi bỏ gạch nối là 2 token, phòng trường hợp viết liền)
          cur += TENS.indexOf(om[1]) * 10; x = om[2]; isOrd = true;
        }
        if (isOrd) {
          const v = ORD[x];
          if (cur % 10 === 0 && cur % 100 >= 20 && v < 10) cur += v; else { if (used) { flush(); } cur = v; }
          used = true; ord = true; src.push(...toks[j].src); j++; break;
        }
        if (x === 'a' && (toks[j + 1]?.t === 'hundred' || toks[j + 1]?.t === 'thousand') && !used) { cur = 1; used = true; src.push(...toks[j].src); continue; }
        if (x === 'and' && used && (total > 0 || cur >= 100) && j + 1 < toks.length && isNumWord(toks[j + 1].t)) { src.push(...toks[j].src); continue; }
        const u = UNITS.indexOf(x), te = TEENS.indexOf(x), tn = TENS.indexOf(x);
        if (u >= 0) {
          if (used && cur % 10 === 0 && cur % 100 >= 20) cur += u;
          else if (used && cur % 100 === 0 && cur >= 100) cur += u;
          else if (used) { flush(); cur = u; } else cur = u;
        } else if (te >= 0) {
          if (used && cur % 100 === 0 && cur >= 100) cur += 10 + te; else { if (used) flush(); cur = 10 + te; }
        } else if (tn > 0) {
          if (used && cur % 100 === 0 && cur >= 100) cur += tn * 10; else { if (used) flush(); cur = tn * 10; }
        } else if (x === 'hundred') { cur = (used ? cur || 1 : 1) * 100; }
        else if (x === 'thousand') { total += (used ? cur || 1 : 1) * 1000; cur = 0; }
        else if (x === 'million') { total += (used ? cur || 1 : 1) * 1e6; cur = 0; }
        else break;
        used = true; src.push(...toks[j].src);
      }
      flush(); i = j; continue;
    }
    out.push(toks[i]); i++;
  }
  // ordinal "21 #ord" → "21o"; dãy số liền nhau → gộp
  const o2: { t: string; src: number[] }[] = [];
  for (const x of out) {
    const last = o2[o2.length - 1];
    if (x.t === '#ord' && last && isDigit(last.t)) { last.t += 'o'; last.src = [...new Set([...last.src, ...x.src])]; continue; }
    if (x.t === '#ord') continue;
    if (last && isDigit(last.t) && isDigit(x.t)) { last.t += x.t; last.src = [...new Set([...last.src, ...x.src])]; continue; }
    o2.push({ ...x });
  }
  // ngày: "the 21o of march" / "march 21o" / "21 march" → "21o march"
  const o3: { t: string; src: number[] }[] = [];
  for (let k = 0; k < o2.length; k++) {
    const x = o2[k];
    const num = /^\d{1,2}o?$/.test(x.t);
    if (num && o2[k + 1]?.t === 'of' && MONTHS.includes(o2[k + 2]?.t)) { o3.push({ t: `${parseInt(x.t)}o ${o2[k + 2].t}`, src: [...x.src, ...o2[k + 1].src, ...o2[k + 2].src] }); k += 2; continue; }
    if (num && MONTHS.includes(o2[k + 1]?.t)) { o3.push({ t: `${parseInt(x.t)}o ${o2[k + 1].t}`, src: [...x.src, ...o2[k + 1].src] }); k += 1; continue; }
    if (MONTHS.includes(x.t) && o2[k + 1]?.t === 'the' && /^\d{1,2}o$/.test(o2[k + 2]?.t ?? '')) { o3.push({ t: `${parseInt(o2[k + 2].t)}o ${x.t}`, src: [...x.src, ...o2[k + 1].src, ...o2[k + 2].src] }); k += 2; continue; }
    if (MONTHS.includes(x.t) && /^\d{1,2}o?$/.test(o2[k + 1]?.t ?? '')) { o3.push({ t: `${parseInt(o2[k + 1].t)}o ${x.t}`, src: [...x.src, ...o2[k + 1].src] }); k += 1; continue; }
    if (x.t === 'the' && /^\d{1,2}o$/.test(o2[k + 1]?.t ?? '') && (o2[k + 2]?.t === 'of' || MONTHS.includes(o2[k + 2]?.t))) { o2[k + 1].src = [...x.src, ...o2[k + 1].src]; continue; }
    o3.push(x);
  }
  return o3;
}

export interface Tok { t: string; src: number[] }
/** Câu → token chuẩn; `src` là chỉ số từ gốc (tách theo khoảng trắng) mà token đến từ. */
export function canon(text: string): Tok[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const toks: Tok[] = [];
  words.forEach((w, i) => { for (const t of baseTokens(w)) toks.push({ t, src: [i] }); });
  return numberize(toks);
}
export const displayWords = (text: string) => text.trim().split(/\s+/).filter(Boolean);

function lev1(a: string, b: string) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  // khoảng cách sửa ≤ 1 (thêm/bớt/đổi một chữ, hoặc đảo 2 chữ liền nhau)
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return 1;
    if (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) return 1;
    return 2;
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  return s.slice(i) === l.slice(i + 1) ? 1 : 2;
}

export type WordMark = 'ok' | 'near' | 'miss';
export interface CheckResult {
  /** Mỗi từ gốc của câu đáp án: đúng / gần đúng / thiếu-sai. */
  marks: WordMark[];
  /** 0–1: đúng = 1, gần đúng = 0.5. */
  score: number;
  /** Từ gõ thừa / sai (để gợi ý lưu từ). */
  extra: string[];
  /** Các từ gốc bị sai / thiếu / gần đúng. */
  wrongWords: string[];
}

/** So bản gõ với câu đáp án. */
export function check(answer: string, typed: string): CheckResult {
  const words = displayWords(answer);
  const A = canon(answer), B = canon(typed);
  // gộp không khoảng trắng bằng nhau (mã bưu điện, email viết liền…) → đúng hết
  if (B.length && A.map((x) => x.t).join('') === B.map((x) => x.t).join('')) return { marks: words.map(() => 'ok'), score: 1, extra: [], wrongWords: [] };
  const n = A.length, m = B.length;
  const sim = (i: number, j: number) => (A[i].t === B[j].t ? 2 : A[i].t.length >= 3 && !/\d/.test(A[i].t) && lev1(A[i].t, B[j].t) === 1 ? 1 : 0);
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    const s = sim(i, j);
    dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1], s ? dp[i + 1][j + 1] + s : 0);
  }
  const tokMark: WordMark[] = new Array(n).fill('miss');
  const usedB = new Array(m).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    const s = sim(i, j);
    if (s && dp[i][j] === dp[i + 1][j + 1] + s) { tokMark[i] = s === 2 ? 'ok' : 'near'; usedB[j] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const marks: WordMark[] = words.map(() => 'ok');
  const seen = new Array(words.length).fill(false);
  A.forEach((tk, k) => {
    for (const s of tk.src) {
      seen[s] = true;
      const cur = marks[s], nx = tokMark[k];
      marks[s] = cur === 'miss' || nx === 'miss' ? 'miss' : cur === 'near' || nx === 'near' ? 'near' : 'ok';
    }
  });
  // từ gốc không sinh token (chỉ là dấu câu "–") coi là đúng
  words.forEach((_, k) => { if (!seen[k]) marks[k] = 'ok'; });
  const counted = words.map((w, k) => (seen[k] ? 1 : 0) as number);
  const total = counted.reduce((a, b) => a + b, 0) || 1;
  const got = marks.reduce((a, mk, k) => a + (counted[k] ? (mk === 'ok' ? 1 : mk === 'near' ? 0.5 : 0) : 0), 0);
  const typedWords = displayWords(typed);
  const extra = [...new Set(B.filter((_, k) => !usedB[k]).flatMap((x) => x.src.map((s) => typedWords[s])))].filter(Boolean);
  return { marks, score: got / total, extra, wrongWords: words.filter((_, k) => marks[k] !== 'ok') };
}

/** "I w__ l___ t_ b___" – chữ cái đầu + gạch theo độ dài. */
export function frame(text: string) {
  return displayWords(text).map((w) => {
    const m = w.match(/^([^A-Za-z0-9]*)([A-Za-z0-9][A-Za-z0-9'’-]*)(.*)$/);
    if (!m) return w;
    return m[1] + m[2][0] + m[2].slice(1).replace(/[A-Za-z0-9]/g, '_') + m[3];
  }).join(' ');
}
/** Bỏ dấu câu ở đầu/cuối một từ hiển thị. */
export const bare = (w: string) => w.replace(/^[^A-Za-z0-9£$]+|[^A-Za-z0-9%]+$/g, '');

// ---------------------------------------------------------------- tách câu & bài
/** `say`: lời đọc cho giọng máy (cấp 1: "oh seven…"); không có thì đọc `text`. */
export interface DSentence { text: string; start?: number; end?: number; speaker?: string; say?: string }
export interface Lesson {
  id: string;
  level: 1 | 2 | 3 | 4;
  /** Bài gốc (Listening) – không có với cấp 1. Bài không có audio thì đọc bằng giọng máy. */
  materialId?: string;
  title: string;
  /** "Phần 2/5". */
  part?: string;
  sentences: DSentence[];
  audio?: string;
  vol?: number;
  topic?: string;
}

const NARR_SPK = /^(narrator|examiner|recording|voice ?over)$/i;
const NARR_TXT = /^(section|part) (one|two|three|four|[1-4])\b|^(you will hear|you'll hear|now (listen|turn|we shall|we will)|first,? you have|you (now )?have (some time|\d+|one|two|half a|thirty|30) (seconds?|minutes?)|look at (questions?|section)|listen carefully|that is the end|this is the end|before you hear|as you listen|you should answer|now look|you will see that|you are going to hear|questions? (\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twenty|thirty)\b|at the end of the test|now we shall begin|the (woman|man|student|caller)'s? (name|answer) is .* (has been )?written)/i;
const isNarr = (s: Segment) => (s.speaker ? NARR_SPK.test(s.speaker.trim()) : false) || NARR_TXT.test(s.text.trim());
const wc = (s: string) => displayWords(s).length;

/** Chia câu dài (> 20 từ) ở dấu phẩy / liên từ thành đoạn 6–15 từ. */
export function splitLong(text: string, max = 20): string[] {
  // segment gốc đôi khi chứa 2–3 câu → tách ở dấu chấm câu trước (không tách "Mr." / "7.30")
  const sents = text.split(/(?<=[a-z0-9%)'’"”][.?!])\s+(?=[A-Z"“‘'])/).filter(Boolean);
  if (sents.length > 1 && !sents.some((x) => /\b(Mr|Mrs|Ms|Dr|St|Prof)\.$/.test(x))) return sents.flatMap((x) => splitLong(x, max));
  const w = displayWords(text);
  if (w.length <= max) return [text];
  const cut: number[] = [];
  // điểm cắt ưu tiên: sau dấu phẩy/chấm phẩy/hai chấm; sau đó trước liên từ
  const CONJ = /^(and|but|so|because|which|who|that|when|while|although|though|whereas|if|or|where|since|as|until|unless|before|after)$/i;
  let last = 0;
  for (let k = 0; k < w.length; k++) {
    const len = k + 1 - last;
    const rest = w.length - (k + 1);
    if (rest < 6) break;
    const comma = /[,;:]$/.test(w[k]);
    // không cắt giữa "1971 and 2000", "between X and Y"
    const conj = k + 1 < w.length && CONJ.test(w[k + 1].replace(/[^a-z]/gi, '')) && !/\d[^\w]*$/.test(w[k]) && !/^between$/i.test(w[k - 1] ?? '');
    if ((comma && len >= 6) || (conj && len >= 8) || len >= 15) { cut.push(k + 1); last = k + 1; }
  }
  const out: string[] = [];
  let a = 0;
  for (const c of [...cut, w.length]) { if (c > a) out.push(w.slice(a, c).join(' ')); a = c; }
  return out;
}

/**
 * Transcript có mốc → câu nghe-chép. Gom các câu liên tiếp cùng người nói thành một lượt; thời lượng nói ước theo số ký tự
 * (bỏ khoảng lặng dài cuối lượt), rồi chia mốc theo ký tự cho từng câu / đoạn.
 */
export function dictationSentences(m: ListeningMaterial): DSentence[] {
  const segs = m.segments?.length ? m.segments : null;
  let raw: Segment[];
  if (segs) raw = segs;
  else raw = splitSentences(m.transcript.replace(/^[^:\n]{1,30}:\s*/gm, '')).map((t) => ({ start: 0, end: 0, text: t }));
  // 1) bỏ lời dẫn + đoạn ví dụ phát lại (Section 1)
  const keep: Segment[] = [];
  let inExample = false;
  for (const s of raw) {
    const narr = isNarr(s);
    if (narr) {
      if (/example/i.test(s.text)) inExample = true;
      else if (/begin|listen carefully|now (listen|we)|answer questions/i.test(s.text)) inExample = false;
      continue;
    }
    if (inExample) continue;
    keep.push(s);
  }
  // 2) gom lượt (cùng người nói, liền nhau) để ước lượng thời gian nói
  type Run = { segs: Segment[]; start: number; end: number; speaker?: string };
  const runs: Run[] = [];
  for (const s of keep) {
    const last = runs[runs.length - 1];
    const same = last && s.speaker && last.speaker === s.speaker && Math.abs(s.start - last.end) < 0.6;
    if (same) { last.segs.push(s); last.end = s.end; } else runs.push({ segs: [s], start: s.start, end: s.end, speaker: s.speaker });
  }
  const out: DSentence[] = [];
  for (const r of runs) {
    const pieces = r.segs.flatMap((s) => splitLong(s.text.trim()));
    const chars = pieces.reduce((a, p) => a + p.length, 0) || 1;
    const span = Math.max(0, r.end - r.start);
    // có speaker = mốc nội suy từ transcript → ước lượng; không speaker (SRT) = mốc thật từng đoạn
    const speech = segs && r.speaker ? Math.min(span, chars / 11 + 0.5 * pieces.length + 0.5) : span;
    let cur = r.start;
    for (const p of pieces) {
      const d = segs ? (speech * p.length) / chars : 0;
      out.push({ text: p, start: segs ? +cur.toFixed(2) : undefined, end: segs ? +(cur + d).toFixed(2) : undefined, speaker: r.speaker });
      cur += d;
    }
  }
  // 3) câu 1–2 từ: ghép vào câu kế (cùng người nói) hoặc câu trước; không được thì bỏ
  const merged: DSentence[] = [];
  for (let k = 0; k < out.length; k++) {
    const s = out[k];
    if (wc(s.text) > 2) { merged.push({ ...s }); continue; }
    const nx = out[k + 1], pv = merged[merged.length - 1];
    if (nx && nx.speaker === s.speaker && wc(nx.text) + wc(s.text) <= 22 && (nx.start == null || s.end == null || nx.start - s.end < 1.5)) {
      out[k + 1] = { ...nx, text: `${s.text} ${nx.text}`, start: s.start ?? nx.start };
    } else if (pv && pv.speaker === s.speaker && wc(pv.text) + wc(s.text) <= 22 && (pv.end == null || s.start == null || s.start - pv.end < 1.5)) {
      pv.text = `${pv.text} ${s.text}`; pv.end = s.end ?? pv.end;
    }
    // còn lại (câu cụt đứng một mình, vd "Right.") → bỏ
  }
  return merged.filter((s) => wc(s.text) >= 3);
}

/** Chia n câu thành các bài ~10–15 câu (đều nhau). */
export function chunk<T>(arr: T[], target = 12): T[][] {
  if (!arr.length) return [];
  const k = Math.max(1, Math.round(arr.length / target));
  const size = Math.ceil(arr.length / k);
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  // phần cuối quá ngắn → ghép vào phần trước
  if (out.length > 1 && out[out.length - 1].length < 6) { const t = out.pop()!; out[out.length - 1].push(...t); }
  return out;
}

const volOf = (id: string) => +(id.match(/^vol(\d+)/)?.[1] ?? 0);
const lessonCache = new Map<string, Lesson[]>();
/** Các bài nghe-chép (cấp 2–4) của một section Listening. Chỉ section có audio thật. */
export function lessonsOf(m: Material): Lesson[] {
  if (m.skill !== 'listening' || !(m.segments?.length || m.transcript?.trim())) return [];
  const key = `${m.id}:${m.segments?.length ?? 0}:${m.audio ? 1 : 0}`;
  const hit = lessonCache.get(key);
  if (hit) return hit;
  const all = dictationSentences(m).map((x) => (m.audio ? x : { ...x, start: undefined, end: undefined }));
  const sec = m.section ?? 1;
  const title = m.title.replace(/^VOL (\d+) Test (\d+)\s*·\s*/, 'VOL $1 · Test $2 · ');
  const base = { materialId: m.id, audio: m.audio && m.segments?.length ? m.audio : undefined, vol: volOf(m.id), topic: m.topic };
  const out: Lesson[] = [];
  if (sec <= 2) {
    // cấp 2: câu ngắn ≤ 8 từ
    const short = all.filter((s) => wc(s.text) <= 8);
    const parts = chunk(short, 12);
    parts.forEach((p, i) => out.push({ ...base, id: `${m.id}~s${i + 1}`, level: 2, title, part: `Câu ngắn ${i + 1}/${parts.length}`, sentences: p }));
  }
  const parts = chunk(all, 12);
  parts.forEach((p, i) => out.push({ ...base, id: `${m.id}~${i + 1}`, level: sec <= 2 ? 3 : 4, title, part: `Phần ${i + 1}/${parts.length}`, sentences: p }));
  lessonCache.set(key, out);
  return out;
}

/** Mọi bài nghe-chép từ các section có audio. */
export function allLessons(materials: Record<string, Material>) {
  return Object.values(materials).filter((m) => m.skill === 'listening' && m.audio && m.segments?.length)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).flatMap(lessonsOf);
}
/** Tìm bài theo id (gồm bài cấp 1 sinh ngẫu nhiên "gen:<loại>"). */
export function findLesson(materials: Record<string, Material>, id: string): Lesson | undefined {
  if (id.startsWith('gen:')) return GEN_NAMES[id.slice(4) as GenKind] ? genLesson(id.slice(4) as GenKind) : undefined;
  const mid = id.split('~')[0];
  const m = materials[mid];
  return m ? lessonsOf(m).find((l) => l.id === id) : undefined;
}

// ---------------------------------------------------------------- cấp 1: số & đánh vần (giọng máy)
export type GenKind = 'phone' | 'price' | 'date' | 'time' | 'year' | 'percent' | 'postcode' | 'spell' | 'email' | 'mixed';
export const GEN_NAMES: Record<GenKind, string> = {
  phone: 'Số điện thoại', price: 'Giá tiền (£, pence)', date: 'Ngày tháng', time: 'Giờ', year: 'Năm', percent: 'Phần trăm',
  postcode: 'Mã bưu điện', spell: 'Đánh vần tên / đường', email: 'Email & website', mixed: 'Trộn tất cả',
};
export const GEN_HINT: Record<GenKind, string> = {
  phone: 'Viết liền các chữ số, vd 07841 963551', price: 'Viết dạng £12.50 hoặc 75p', date: 'Viết dạng 21st March', time: 'Viết dạng 7:30 hoặc 7.30 am',
  year: 'Viết 4 chữ số', percent: 'Viết dạng 35%', postcode: 'Viết dạng CB2 4XT', spell: 'Viết đúng từng chữ cái', email: 'Viết dạng name@site.com', mixed: 'Viết số bằng chữ số',
};
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export function numToWords(n: number): string {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${UNITS[n % 10]}` : '');
  if (n < 1000) return `${UNITS[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${numToWords(n % 100)}` : ''}`;
  if (n < 1e6) return `${numToWords(Math.floor(n / 1000))} thousand${n % 1000 ? (n % 1000 < 100 ? ' and ' : ' ') + numToWords(n % 1000) : ''}`;
  return String(n);
}
const ORD_W = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
const ordWords = (n: number) => (n <= 20 ? ORD_W[n] : n === 30 ? 'thirtieth' : `${TENS[Math.floor(n / 10)]}-${ORD_W[n % 10]}`);
const ordSuffix = (n: number) => (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
/** Đọc dãy chữ số kiểu Anh: 0 = "oh", hai số giống nhau = "double". */
function sayDigits(d: string) {
  const out: string[] = [];
  for (let i = 0; i < d.length; i++) {
    const w = d[i] === '0' ? 'oh' : UNITS[+d[i]];
    if (d[i + 1] === d[i] && d[i + 2] !== d[i]) { out.push(`double ${w}`); i++; } else out.push(w);
  }
  return out.join(' ');
}
const sayLetters = (s: string) => s.toUpperCase().split('').map((c) => (/\d/.test(c) ? UNITS[+c] : c)).join(', ');
const NAMES = ['Pargeter', 'Whitmore', 'Kinsella', 'Rawlings', 'Fairbrother', 'Hallworth', 'Jacobsen', 'Merriman', 'Thornbury', 'Lockwood', 'Ashcroft', 'Gilchrist', 'Pemberton', 'Daintree', 'Sowerby', 'Chalmers', 'Brackley', 'Farrington', 'Yelland', 'Quigley'];
const STREETS = ['Bridgewater Road', 'Hollis Street', 'Marlowe Avenue', 'Fenwick Lane', 'Cresswell Close', 'Tavistock Place', 'Wexford Drive', 'Kingsley Crescent', 'Elmhurst Way', 'Dunmore Street'];
const SITES = ['gmail', 'hotmail', 'yahoo', 'outlook', 'btinternet'];
export interface GenItem { say: string; text: string }
export function genItem(kind: GenKind): GenItem {
  const k = kind === 'mixed' ? pick<GenKind>(['phone', 'price', 'date', 'time', 'year', 'percent', 'postcode', 'spell', 'email']) : kind;
  switch (k) {
    case 'phone': {
      const d = pick(['07', '01', '02']) + Array.from({ length: 9 }, () => rnd(0, 9)).join('');
      const a = d.slice(0, 5), b = d.slice(5);
      return { text: `${a} ${b}`, say: `${sayDigits(a)}, ${sayDigits(b.slice(0, 3))}, ${sayDigits(b.slice(3))}` };
    }
    case 'price': {
      if (Math.random() < 0.25) { const p = rnd(5, 95); return { text: `${p}p`, say: `${numToWords(p)} pence` }; }
      const l = rnd(2, 450), p = pick([0, 0, 25, 50, 75, 99, 95, 20]);
      return { text: p ? `£${l}.${String(p).padStart(2, '0')}` : `£${l}`, say: `${numToWords(l)} pound${l > 1 ? 's' : ''}${p ? ` ${numToWords(p)}` : ''}` };
    }
    case 'date': {
      const mo = rnd(0, 11), d = rnd(1, 28);
      const M = MONTHS[mo][0].toUpperCase() + MONTHS[mo].slice(1);
      return { text: `${d}${ordSuffix(d)} ${M}`, say: Math.random() < 0.5 ? `the ${ordWords(d)} of ${M}` : `${M} the ${ordWords(d)}` };
    }
    case 'time': {
      const h = rnd(1, 12), m = pick([0, 15, 30, 45, 10, 20, 40, 50, 5, 25, 35]);
      const say = m === 0 ? `${numToWords(h)} o'clock` : m === 15 ? `quarter past ${numToWords(h)}` : m === 30 ? `half past ${numToWords(h)}` : m === 45 ? `quarter to ${numToWords(h % 12 + 1)}`
        : Math.random() < 0.5 ? `${numToWords(h)} ${m < 10 ? `oh ${numToWords(m)}` : numToWords(m)}` : m < 30 ? `${numToWords(m)} past ${numToWords(h)}` : `${numToWords(60 - m)} to ${numToWords(h % 12 + 1)}`;
      return { text: `${h}:${String(m).padStart(2, '0')}`, say };
    }
    case 'year': {
      const y = rnd(1850, 2030);
      const say = y >= 2000 && y < 2010 ? `two thousand${y % 100 ? ` and ${numToWords(y % 100)}` : ''}` : `${numToWords(Math.floor(y / 100))} ${y % 100 === 0 ? 'hundred' : y % 100 < 10 ? `oh ${numToWords(y % 100)}` : numToWords(y % 100)}`;
      return { text: String(y), say };
    }
    case 'percent': { const p = rnd(2, 98); return { text: `${p}%`, say: `${numToWords(p)} per cent` }; }
    case 'postcode': {
      const L = () => String.fromCharCode(65 + rnd(0, 25));
      const a = pick(['CB', 'OX', 'SW', 'NW', 'LS', 'BS', 'M', 'B', 'EH', 'G']) + rnd(1, 19), b = `${rnd(1, 9)}${L()}${L()}`;
      return { text: `${a} ${b}`, say: `${sayLetters(a)}. ${sayLetters(b)}` };
    }
    case 'spell': {
      const w = Math.random() < 0.6 ? pick(NAMES) : pick(STREETS);
      const [name, ...rest] = w.split(' ');
      return { text: w, say: `${w}. That's ${sayLetters(name)}${rest.length ? `, ${rest.join(' ')}` : ''}.` };
    }
    case 'email': {
      const name = pick(NAMES).toLowerCase(), n = rnd(1, 99);
      if (Math.random() < 0.3) { const s = `www.${name}tours.co.uk`; return { text: s, say: `w w w dot ${name} tours dot co dot uk. That's ${sayLetters(name)}.` }; }
      const s = `${name[0]}${name}${n}@${pick(SITES)}.com`;
      return { text: s, say: `${s[0]}, ${name}, ${numToWords(n)}, at ${s.split('@')[1].replace('.com', '')} dot com. ${name} is ${sayLetters(name)}.` };
    }
  }
  return { text: '', say: '' };
}
/** Bài cấp 1: 10 câu sinh ngẫu nhiên (mỗi lần mở là bộ mới). */
export function genLesson(kind: GenKind, n = 10): Lesson {
  const items = Array.from({ length: n }, () => genItem(kind));
  return { id: `gen:${kind}`, level: 1, title: GEN_NAMES[kind] ?? 'Số & đánh vần', part: GEN_HINT[kind], sentences: items.map((x) => ({ text: x.text, say: x.say })) };
}
export const LEVEL_NAMES: Record<number, string> = { 1: 'Số & đánh vần', 2: 'Câu ngắn', 3: 'Hội thoại', 4: 'Học thuật' };
export const LEVEL_DESC: Record<number, string> = {
  1: 'Số điện thoại, giá, ngày giờ, mã bưu điện, đánh vần – hay gặp ở Section 1. Giọng máy, luyện không giới hạn.',
  2: 'Câu ≤ 8 từ từ Section 1–2, audio thật.',
  3: 'Hội thoại Section 1–2, mỗi bài 10–15 câu.',
  4: 'Section 3–4 (thảo luận, bài giảng); câu dài đã được tách.',
};
