// ====== Schema nội dung IELTS Practice ======
// Mọi tài liệu (đề Reading / Listening / Speaking / Writing) đều là một `Material`.
// Người dùng nạp hàng loạt bằng file JSON (một object hoặc mảng), Markdown (Reading), audio + SRT/VTT (Listening)
// hoặc nhờ AI sinh đề từ văn bản thô. Xem docs/CONTENT.md để biết chi tiết.

export type Skill = 'reading' | 'listening' | 'speaking' | 'writing';
export type Level = 'easy' | 'medium' | 'hard';

/** [từ / cụm, loại từ, nghĩa tiếng Việt, ví dụ trong bài?] */
export type Vocab = [string, string, string, string?];

// ---------- Câu hỏi (dùng chung Reading & Listening) ----------
export type QuestionType =
  | 'mcq'        // chọn 1 đáp án (A/B/C/D)
  | 'multi'      // chọn nhiều đáp án (Choose TWO letters)
  | 'tfng'       // True / False / Not Given
  | 'ynng'       // Yes / No / Not Given
  | 'fill'       // điền từ (sentence / summary / note / form / table completion, short answer)
  | 'match';     // ghép với ngân hàng lựa chọn (matching headings / information / features / sentence endings)

export interface QBase { no: number; text: string; explanation?: string }
export interface QMcq extends QBase { type: 'mcq'; options: string[]; answer: number }
export interface QMulti extends QBase { type: 'multi'; options: string[]; answer: number[] }
export interface QTfng extends QBase { type: 'tfng'; answer: 'TRUE' | 'FALSE' | 'NOT GIVEN' }
export interface QYnng extends QBase { type: 'ynng'; answer: 'YES' | 'NO' | 'NOT GIVEN' }
/** `text` chứa ___ (ba gạch dưới) ở chỗ cần điền; `answer` chấp nhận nhiều cách viết. */
export interface QFill extends QBase { type: 'fill'; answer: string | string[] }
/** `answer` là chỉ số trong `bank` của nhóm (hoặc `options` riêng của câu). */
export interface QMatch extends QBase { type: 'match'; answer: number; options?: string[] }
export type Question = QMcq | QMulti | QTfng | QYnng | QFill | QMatch;

export interface QuestionGroup {
  /** Hướng dẫn hiện cho thí sinh, vd. "Choose the correct heading for each paragraph". */
  instruction: string;
  /** Ngân hàng lựa chọn (matching) – có thể dùng chung cho cả nhóm. */
  bank?: string[];
  /** Ghi chú giới hạn số từ, vd. "NO MORE THAN TWO WORDS". */
  wordLimit?: string;
  /** Đoạn tóm tắt / bảng / form cho dạng completion: hiển thị trước danh sách câu. */
  context?: string;
  /** Ảnh bản đồ / sơ đồ (đường dẫn trong public/, vd. "img/vol1/t4-l2-map.png") – hiện trên các câu, bấm để phóng to. */
  image?: string;
  /** Mô tả ảnh bằng chữ (alt; cũng dùng khi ảnh không tải được). */
  imageAlt?: string;
  /**
   * Bố cục như đề thật. Bỏ trống thì tự suy từ instruction (form / notes / flow-chart).
   * - form / notes: khung giấy, mỗi câu một dòng gọn.
   * - table: bảng thật (cần `table`), cuộn ngang trên điện thoại.
   * - flowchart: các bước xếp dọc nối bằng mũi tên.
   */
  layout?: 'form' | 'notes' | 'table' | 'flowchart';
  /** Bảng cho layout "table". Ô chứa `{{n}}` là chỗ trống của câu n (mỗi câu đúng một lần). */
  table?: { title?: string; columns?: string[]; rows: string[][] };
  questions: Question[];
}

// ---------- Material ----------
export interface MaterialBase {
  id: string;
  skill: Skill;
  title: string;
  topic?: string;
  level?: Level;
  source?: string;
  tags?: string[];
  /** Thời điểm nạp (ms). */
  addedAt: number;
  /** true = nội dung mẫu đi kèm app. */
  builtin?: boolean;
  /** Ghi chú về đề (vd. câu bị thiếu trong đề gốc) – hiện phía trên câu hỏi. */
  note?: string;
}

export interface ReadingMaterial extends MaterialBase {
  skill: 'reading';
  module?: 'academic' | 'general';
  /** Toàn bộ bài đọc; đoạn cách nhau bằng dòng trống. Đoạn có thể bắt đầu bằng "A " / "A." để đánh nhãn. */
  passage: string;
  groups: QuestionGroup[];
  /** Bản dịch theo đoạn (cùng thứ tự với các đoạn trong passage). Thiếu thì AI dịch khi bấm. */
  translation?: string[];
  vocab?: Vocab[];
  /** Thời gian gợi ý (phút). Mặc định 20. */
  minutes?: number;
}

export interface Segment { start: number; end: number; text: string; speaker?: string }

export interface ListeningMaterial extends MaterialBase {
  skill: 'listening';
  section?: 1 | 2 | 3 | 4;
  /** URL audio, hoặc "idb:<key>" nếu đã nạp file vào trình duyệt. Thiếu → đọc transcript bằng giọng máy (TTS). */
  audio?: string;
  transcript: string;
  /** Mốc thời gian từng câu (từ SRT/VTT) – dùng cho chép chính tả theo câu. */
  segments?: Segment[];
  groups: QuestionGroup[];
  translation?: string[];
  vocab?: Vocab[];
  /** Giọng TTS gợi ý khi không có audio: 'en-GB' | 'en-US' | 'en-AU'. */
  voice?: string;
}

export interface SpeakingPart1 { topic: string; questions: string[]; samples?: string[] }
export interface SpeakingPart2 { topic: string; cue: string; points: string[]; followUp?: string[]; sample?: string }
export interface SpeakingPart3 { questions: string[]; samples?: string[] }
export interface SpeakingMaterial extends MaterialBase {
  skill: 'speaking';
  part1?: SpeakingPart1[];
  part2?: SpeakingPart2;
  part3?: SpeakingPart3;
  vocab?: Vocab[];
}

export type WritingType =
  | 'opinion' | 'discussion' | 'advantage' | 'problem' | 'double' | 'development' // Task 2
  | 'line' | 'bar' | 'pie' | 'table' | 'process' | 'map' | 'mixed'  // Task 1 Academic
  | 'letter-formal' | 'letter-semi' | 'letter-informal';            // Task 1 General

/**
 * Số liệu biểu đồ. line/bar: labels = trục x; mỗi series = một đường/màu cột.
 * pie: mỗi series = một biểu đồ tròn (tổng 100), labels = các phần. table: labels = cột, series = hàng.
 */
export interface Chart {
  kind?: 'line' | 'bar' | 'pie' | 'table';
  labels: string[];
  series: { name: string; values: (number | null)[] }[];
  title?: string;
  unit?: string;
  horizontal?: boolean;
  stacked?: boolean;
  percent?: boolean;
  /** Nhãn mốc cuối của số liệu thật (vd. "2020"): sau đó là dự báo → nét đứt, ghi "Projected". */
  projectedFrom?: string;
  decimals?: number;
  /** false = không ghi số trên cột. */
  values?: boolean;
}

export interface WritingMaterial extends MaterialBase {
  skill: 'writing';
  task: 1 | 2;
  module?: 'academic' | 'general';
  type: WritingType;
  prompt: string;
  /** Ảnh biểu đồ/bản đồ (URL hoặc idb:<key>). */
  image?: string;
  /** Mô tả chi tiết ảnh bằng chữ (alt + hiện dưới ảnh / thay ảnh khi chưa có ảnh). */
  imageAlt?: string;
  /** Dữ liệu biểu đồ: app tự vẽ khi không có ảnh, hiện "Bảng số liệu", gửi cho AI chấm. */
  chart?: Chart;
  /** Dạng `mixed`: 2 biểu đồ (vd. bar + line). */
  charts?: Chart[];
  /** Thư GT: mục đích (Phàn nàn, Xin việc, Cảm ơn…). */
  purpose?: string;
  /** Dàn ý gợi ý. */
  outline?: string[];
  /** Bài mẫu band 7–8+. */
  sample?: string;
  vocab?: Vocab[];
}

export type Material = ReadingMaterial | ListeningMaterial | SpeakingMaterial | WritingMaterial;

// ---------- Dữ liệu người dùng ----------
export interface Attempt {
  id: string;
  materialId: string;
  skill: Skill;
  title: string;
  at: number;
  /** self = nộp bài không AI (tự chấm theo checklist). */
  /** practice = Luyện tập (không tính vào band trang chủ); full-mock = thi thử 4 kỹ năng (một bản ghi). */
  mode: 'test' | 'dictation' | 'gapfill' | 'ai' | 'self' | 'practice' | 'full-mock';
  score?: number;
  max?: number;
  band?: number;
  /** Chi tiết (đáp án đã chọn, kết quả AI…) – mỗi mode một kiểu. */
  detail?: unknown;
  /** Band tự ước lượng từ checklist (mode self) – không tính vào band trang chủ. */
  selfBand?: number;
  selfCheck?: string[];
}

export interface VocabCard {
  id: string;
  word: string;
  pos?: string;
  meaning: string;
  example?: string;
  /** Phiên âm IPA. */
  ipa?: string;
  /** Định nghĩa tiếng Anh ngắn. */
  meaningEn?: string;
  /** Dịch câu ví dụ. */
  exampleVi?: string;
  /** Ghi chú riêng của người học. */
  note?: string;
  /** Nguồn: id tài liệu. */
  from?: string;
  addedAt: number;
  /** 'sentence' = câu nghe-chép hay sai (C): `word` là cả câu, `clip` là đoạn audio của câu. */
  kind?: 'word' | 'sentence';
  /** Bộ từ: 'deck:<topic>' (bộ có sẵn), 'test:vol5-t7' (bộ theo đề), 'custom:<id>', 'saved' (lưu từ bài). */
  decks?: string[];
  /** Câu thật trong đề chứa từ này (khi lưu từ bài hoặc từ nghe-chép). */
  context?: CardContext;
  /** Collocation đi kèm. */
  colloc?: string[];
  /** Học từ mới (A2): số bước đã qua; undefined = chưa bắt đầu. */
  stage?: number;
  // ---- FSRS (src/lib/srs.ts). Thẻ cũ Leitner: box 1..5 → stability 1/2/4/8/16 ngày khi mở app. ----
  stability?: number;
  difficulty?: number;
  /** 0 New · 1 Learning · 2 Review · 3 Relearning (ts-fsrs State). */
  fsrsState?: number;
  learningSteps?: number;
  scheduledDays?: number;
  /** Hộp Leitner cũ – chỉ đọc khi chuyển đổi. */
  box?: number;
  /** Lần ôn gần nhất. */
  lastReview?: number;
  /** Lần đầu học xong (vào lịch ôn). */
  learnedAt?: number;
  due: number;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
}

export interface CardContext {
  text: string;
  /** Nhãn nguồn, vd "VOL 3 · Test 2 · Listening S1". */
  label?: string;
  /** id material để mở bài. */
  ref?: string;
  /** Đoạn audio thật của câu: đường dẫn audio + giây. */
  audio?: string;
  start?: number;
  end?: number;
}

/** Dạng bài tập từ vựng. */
export type ExKind = 'meaning' | 'word' | 'listen' | 'fill' | 'type' | 'dictate';

/** Nhật ký mỗi câu trả lời (từ vựng + nghe-chép) – dùng cho thống kê, XP, retention. */
export interface RevLog {
  id: string;
  at: number;
  cardId?: string;
  /** Dạng bài: ExKind, 'learn' (bước học từ mới), 'dictation' (một câu nghe-chép), 'skip' (Tôi biết từ này). */
  kind: ExKind | 'learn' | 'dictation' | 'skip' | 'context';
  /** Đúng / sai; nghe-chép là tỉ lệ 0–1. */
  ok: boolean;
  score?: number;
  ms?: number;
  hint?: boolean;
  /** Điểm FSRS đã chấm (1 Again · 2 Hard · 3 Good · 4 Easy) – chỉ có khi là lượt ôn theo lịch. */
  rating?: number;
  /** Độ ổn định trước lượt ôn (ngày) – để tính retention thật. */
  stab?: number;
  xp: number;
}

export interface Note { materialId: string; text: string; highlights: string[]; updatedAt: number }
