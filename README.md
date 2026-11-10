# IELTS Practice

Web luyện **Reading · Listening · Speaking · Writing** IELTS, xây trên nền (stack, UI, cơ chế chấm AI) của Aptis Practice. Chạy hoàn toàn trên trình duyệt, cài được như app (PWA), dữ liệu lưu trong máy (IndexedDB), **tự nạp hàng loạt tài liệu** của bạn và dùng AI (Claude, DeepSeek, OpenAI, Gemini, OpenRouter hoặc dịch vụ OpenAI-compatible) để chấm bài / sinh đề.

## Chạy

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # bản tĩnh trong dist/ – deploy lên GitHub Pages / Cloudflare Pages / Netlify…
npm run deploy    # build thử rồi push master → GitHub Actions deploy lên https://ielts.lionelphung.id.vn/
```

Cấu hình AI (tuỳ chọn, nhưng cần cho chấm Writing/Speaking, dịch, tra từ, sinh đề), trong *Cài đặt → AI*:
1. Chọn nhà cung cấp: Claude, DeepSeek, OpenAI, Gemini, OpenRouter hoặc *Tuỳ chỉnh* (mọi dịch vụ OpenAI-compatible, kể cả Ollama trên máy).
2. Chọn model chính (chấm, sinh đề) và model nhẹ (dịch, tra từ). Có thể gõ tên model bất kỳ, hoặc bấm *Lấy danh sách model*.
3. Dán API key (chỉ lưu trên máy), hoặc chọn *Qua proxy* rồi nhập địa chỉ và mã truy cập do người dựng [server/grader-proxy](server/grader-proxy/README.md) cấp (mỗi mã có giới hạn lượt/ngày).
4. Bấm *Kiểm tra kết nối*. App hiện giá tham khảo và ước tính chi phí mỗi lần chấm; model chưa biết giá thì nhập giá tay.

Claude dùng structured output của Anthropic SDK. Các nhà cung cấp khác được gọi qua `chat/completions`: app xin JSON, kiểm tra bằng zod, và nếu sai định dạng thì hỏi lại một lần. Có dịch vụ chặn gọi từ trình duyệt (CORS); khi đó hãy dùng proxy.

### Chạy trên máy của bạn và điều khiển từ xa bằng Claude Code Remote Control

1. Cài **Node.js** bản `^20.19` hoặc `>=22.12`. Nếu muốn nạp audio thật, cài thêm **ffmpeg**; whisper là tuỳ chọn.
2. Giải nén vào một thư mục, ví dụ `~/Projects/ielts-practice`, rồi chạy `npm install` và `npm run dev`.
3. Trong thư mục đó, bật Claude Code ở chế độ Remote Control:
   ```bash
   claude remote-control --name "IELTS Practice"
   ```
   Hoặc gõ `/remote-control` (viết tắt `/rc`) trong một phiên `claude` đang chạy. Sau đó mở phiên tại claude.ai/code hoặc trong app Claude trên điện thoại.
   - Cần đăng nhập bằng tài khoản Pro, Max, Team hoặc Enterprise (lệnh `/login`). API key không dùng được cho Remote Control.
   - Máy phải bật và giữ terminal chạy suốt phiên.
4. Claude tự đọc [CLAUDE.md](CLAUDE.md), trong đó có tình trạng dữ liệu, việc còn lại và mã thư mục Drive. Có thể mở đầu bằng: *"Đọc CLAUDE.md rồi chuyển tiếp VOL 5 Test 7"*.
   - Nếu phiên trên máy không có Google Drive connector, hãy tải các thư mục VOL 5–8 về máy rồi chỉ đường dẫn cho Claude.

## Tính năng

### Reading
- Làm đề giống CBT: bài đọc bên trái, câu hỏi bên phải, bấm giờ 20', highlight, **mọi dạng câu hỏi** (matching headings/information/features, T/F/NG, Y/N/NG, MCQ, multi-select, sentence/summary/note/table completion, short answer), chấm tức thì → band ước tính, giải thích từng câu.
- **Chế độ học**: đọc lại từng đoạn, bản dịch tiếng Việt (đi kèm bài hoặc AI dịch một lần rồi lưu), nhấp đúp dịch riêng một câu, **bấm từ để tra** (từ vựng kèm bài → từ điển miễn phí → AI tra theo ngữ cảnh: IPA, nghĩa, collocation, đồng nghĩa) và **lưu vào vốn từ**, **nghe đọc bài bằng giọng máy** theo đoạn, ghi chú riêng.
- **Thi thử** 3 bài / 60 phút, chấm chung → band.

### Listening
- Làm đề với audio thật (mp3 + transcript + SRT) hoặc **giọng máy đọc transcript** (đổi giọng theo người nói) khi không có file audio; mọi dạng câu hỏi form/note/table completion, MCQ, matching.
- **Nghe & chép** (`#/dictation`, kiểu DailyDictation): 4 cấp – cấp 1 số/đánh vần do máy sinh, cấp 2–4 là các section Listening đã chia thành bài ~10 câu (bỏ lời dẫn và ví dụ). Nghe từng câu, gõ, chấm khớp có quy đổi (số ↔ chữ, viết tắt, dấu câu), sửa ngay sau khi kiểm tra, gợi ý từng từ, khung chữ đầu cho người mới, chế độ chỉ chép từ khoá, chỉnh tốc độ, phím tắt, lưu tiến độ giữa chừng, tổng kết + **shadowing**. Câu chép dưới 90% thành **thẻ "Câu hay sai"** để ôn bằng chép lại; từ chép sai được gợi ý vào vốn từ.
- **Điền từ transcript**: che 1/N từ khoá (4 mức), nghe và gõ, chấm từng chỗ.
- **Học transcript**: dịch, tra từ, từ vựng, nghe đọc – giống chế độ học Reading.
- **Thi thử** 4 section.

### Speaking
- Bộ đề Part 1 – 2 – 3 cùng chủ đề; máy đọc câu hỏi (giọng Anh), **ghi âm + nhận dạng giọng nói trực tiếp** (Chrome/Edge), Part 2 có đồng hồ 1' chuẩn bị + 2' nói và ô ghi chú; nghe lại, sửa transcript, so với bài mẫu.
- **AI chấm** theo Fluency & Coherence / Lexical Resource / Grammar (band descriptors), nhận xét + sửa lỗi từng câu, câu trả lời mẫu band 7–8 **giữ ý của bạn**, cụm từ nên học (lưu vào vốn từ).

### Writing
- Task 1 Academic (line/bar/pie/table – app tự vẽ biểu đồ từ dữ liệu, process, map, mixed), Task 1 General (3 loại thư), Task 2 (opinion, discussion, advantage, problem, double question).
- Soạn bài với đếm từ, bấm giờ 20'/40', tự lưu nháp, cấu trúc bài gợi ý theo dạng, bài mẫu band 8, từ vựng.
- **AI chấm theo 4 tiêu chí IELTS** (TA/TR, CC, LR, GRA, half band, overall), lý do từng tiêu chí có trích dẫn, danh sách lỗi, **bản sửa lỗi hiển thị diff từng từ**, bản viết lại lên band, bảng "nâng cấp cụm từ".

### Từ vựng (kiểu MemCab)
- **FSRS** (ts-fsrs) thay Leitner: 4 trạng thái Sẽ học / Đang học / Ôn tập / Đã thuộc (độ ổn định ≥ 60 ngày); thẻ Leitner cũ được chuyển tự động, không mất tiến độ.
- **Học từ mới theo nhóm** 5–6 từ qua các bước xen kẽ (giới thiệu → chọn nghĩa → chọn từ → nghe → điền câu → gõ), sai thì làm lại cuối nhóm; xong nhóm có **đoạn ngữ cảnh** chứa các từ vừa học (câu trong đề thật hoặc AI viết).
- **Ôn tập tự chấm**: thẻ đến hạn, yếu nhất trước; app chấm theo đúng/sai + thời gian để cho điểm FSRS.
- Bộ từ: 300 từ theo 12 chủ đề (có IPA, nghĩa Anh, dịch ví dụ, collocation), **56 bộ theo đề** (30 từ AWL trong bài Reading của từng đề, câu ví dụ lấy từ bài), **Đã lưu** (từ tra khi đọc/nghe), **Tự tạo** (dán danh sách, tự điền nghĩa; nhập/xuất JSON/CSV). Mỗi bộ có tiến độ, "Học tiếp", "Ôn bộ này".
- Mỗi thẻ có câu trong đề thật (chỉ mục ngữ cảnh do `npm run data` dựng).

### Hôm nay & Thống kê
- Trang chủ có kế hoạch **Hôm nay**: Ôn từ đến hạn → Học 5 từ mới → Nghe chép 10 câu → Đoạn ngữ cảnh → Một bài luyện đề.
- Từ vựng và Nghe-chép dùng chung **XP** và **chuỗi ngày học**. Trang **Thống kê** (`#/stats`): thẻ theo trạng thái, dự báo ôn 7 ngày, tỉ lệ nhớ 30 ngày, câu chép đúng, lịch hoạt động 18 tuần.

### Tài liệu (nạp hàng loạt)
- Kéo thả nhiều file: **JSON** (một hoặc nhiều bài, mọi kỹ năng), **Markdown** bài Reading viết tay nhanh, **audio + transcript/SRT cùng tên** → bài Listening, ảnh biểu đồ cho Writing. Định dạng: [public/CONTENT.md](public/CONTENT.md) (có nút tải JSON mẫu trong app).
- **AI soạn đề**: dán bài báo → đề Reading đủ dạng câu hỏi + dịch + từ vựng; dán transcript → đề Listening; chủ đề → kịch bản Listening theo section, bộ Speaking 3 part có mẫu, đề Writing có bài mẫu band 8 / dữ liệu biểu đồ.
- Danh sách tài liệu hiện 60 bài mỗi lần, có ô tìm theo tên hoặc mã bài (vd. `vol5-t6`).
- Xuất/nhập, sao lưu toàn bộ (Cài đặt).
- Bộ đề có sẵn được cache trong IndexedDB: mở lại app chỉ hỏi `data/index.json`, file nào đổi `hash` mới tải lại; mất mạng vẫn dùng được bản đã cache.

### Khác
- Lịch sử & xu hướng band từng kỹ năng, overall; streak; cẩm nang chiến lược từng dạng câu hỏi, khung bài, bảng quy đổi band; sáng/tối; responsive (sidebar desktop, tab bar mobile).

## Đề gốc (VOL 1–8 ORIGINAL EXAMS) → đề có sẵn trong app

```
content/vol<N>/test<M>.json      đề đã bóc tách từ PDF: Listening (câu hỏi + transcript có mốc giờ), Reading, Writing
content/vol<N>/writing-bank.json  đề Writing lẻ của từng VOL
content/speaking/*.json           bộ đề Speaking dự đoán
        │  npm run data   (tự chạy trước npm run dev / npm run build)
        ▼
public/data/*.json + index.json   app tự nạp khi mở
public/audio/vol<N>/test<M>/s1..s4.mp3 (+ .srt)   ← npm run audio
```

### Ôn từ vựng

Trang **Từ vựng** có 2 nút chính: **Học** (nhóm từ mới từ các bộ đang chọn) và **Ôn** (thẻ đến hạn). Lịch ôn theo FSRS; Cài đặt chỉnh tỉ lệ nhớ mục tiêu, số từ mới/ngày, giới hạn ôn/ngày và các dạng bài.
Nguồn từ: `content/vocab/ielts-topics.json` (12 chủ đề × 25 từ: `[từ, loại, nghĩa Việt, ví dụ, IPA, nghĩa Anh, dịch ví dụ, collocation "a; b"]`), `content/vocab/awl.json` (Academic Word List → bộ theo đề do `npm run data` chọn), từ tự lưu và bộ tự tạo. Từ trong bộ chỉ thành thẻ khi được học lần đầu.

### Giao diện thi

Reading, Listening và Writing (cả Thi thử lẫn Luyện tập) chạy trong khung mô phỏng màn hình thi IELTS trên máy tính:
số báo danh và đồng hồ "N minutes left" (báo khi còn 10 và 5 phút), khung "Part N – Read the text and answer questions …",
bài đọc / câu hỏi chia 2 cột kéo được, thanh dưới có Part, số câu (gạch chân = đã làm, viền = đang ở, viền tròn trên = Review), ← → và nút ✓ nộp bài.
Options (☰): cỡ chữ Standard / Large / Extra large, nền Black on white / White on black / Yellow on black. Hide che màn hình.
Thi thử cả đề có màn hướng dẫn (Listening thêm kiểm tra âm thanh); Listening phát audio liền 4 phần một lần, không dừng/tua, hết audio còn 2 phút rồi tự nộp.

### Thêm audio thật

1. Tải thư mục đề trên Google Drive về máy, **giữ nguyên cấu trúc thư mục** (ví dụ `VOL 5- ORIGINAL EXAMS/…/Listening/Test 3/P2.mp3`).
2. Chạy `npm run audio -- "<thư mục vừa tải>"`. Script tự nhận ra:
   - VOL: tên thư mục có `VOL N`.
   - Test: cụm `test N` cuối cùng trong đường dẫn.
   - Section: lấy từ tên file, ví dụ `Track 2`, `Part 2`, `P2`, `S2`, `Section 2`, `SECCTION 2`, `audio 2`, `01 Track 1 (2)`, `02.MP3`, `P1 (2).mp3`.
   - Định dạng: mp3, m4a, wav, wma, aac, ogg, flac.
   - Nếu máy có **ffmpeg**, file được nén về 64 kbps mono. File `.wma` bắt buộc phải có ffmpeg vì trình duyệt không phát được wma.
   - Nếu máy có **whisper** (`pip install openai-whisper`), script tạo thêm `.srt`. Nhờ vậy chép chính tả khớp đúng từng câu, và bài nào tài liệu gốc thiếu transcript sẽ có transcript.
   - Với file gộp cả bài (tên file không có số section), script cắt theo mốc `cut` trong file content (cần ffmpeg).
3. Chạy `npm run data` (hoặc `npm run dev`). Section nào chưa có audio thì app dùng giọng máy đọc transcript.

### Audio trên MinIO / S3

Bản deploy không chở audio theo: file nằm ở bucket `ieltsweb-audio` trên MinIO `https://s3.hairbui76.id.vn` (đọc công khai).

1. Sau bước `npm run audio`, đặt khoá vào `.env.local` (không commit):
   ```
   S3_ENDPOINT=https://s3.hairbui76.id.vn
   S3_ACCESS_KEY=…
   S3_SECRET_KEY=…
   S3_BUCKET=ieltsweb-audio
   ```
2. `npm run audio:upload` (thêm `-- --force` để ghi đè): tạo bucket nếu chưa có, đặt quyền đọc công khai, đẩy `public/audio/**` (mp3, srt) với key `vol<N>/test<M>/s<K>.mp3`, rồi ghi `content/audio-manifest.json`.
3. `content/audio-manifest.json` được commit: `npm run data` gắn audio cho mọi section có trong manifest, kể cả khi máy không có `public/audio`.
4. `.env` đặt `VITE_AUDIO_BASE=https://s3.hairbui76.id.vn/ieltsweb-audio/`; `src/db.ts` đổi `audio/…` thành URL đó. Bản build không chở `public/audio` (thư mục này nằm trong `.gitignore`).

### Định dạng `content/vol<N>/test<M>.json`

```json
{ "vol": 5, "test": 3, "source": "…",
  "listening": { "audioDir": "audio/vol5/test3", "sections": [
    { "section": 2, "title": "…", "topic": "…", "offset": 419,
      "transcript": "[06:59] Narrator: Part two…\n[08:02] Dave: Good morning…",
      "groups": [ { "instruction": "…", "wordLimit": "ONE WORD ONLY", "context": "…", "bank": ["…"],
        "questions": [ { "no": 11, "type": "fill", "text": "Starting point: the ___", "answer": ["castle"], "explanation": "…" } ] } ] } ] },
  "reading": [ { "passage": 1, "title": "…", "topic": "…", "level": "easy", "passage_text": "…", "groups": [] } ],
  "writing": [], "speaking": [] }
```

- Mỗi dòng transcript có dạng `[mm:ss] Người nói: lời`, với mốc tính theo audio gốc.
- Khi transcript là một dòng thời gian liền mạch nhưng audio tách theo section, dùng `offset` (số giây) = mốc bắt đầu section.
- Khi audio là một file gộp, dùng `cut` (`"m:ss"`) = mốc cắt.
- Lúc build, mốc giờ được dời về 0 cho từng `s<N>.mp3`. Có file `.srt` thì `.srt` được ưu tiên.
- Các loại câu hỏi:
  - `mcq`: đáp án là chỉ số.
  - `multi`: mảng chỉ số; một câu tính cho 2–3 số.
  - `tfng` / `ynng`: đáp án là chuỗi.
  - `fill`: trong `text` có `___`; đáp án là mảng các cách viết được chấp nhận.
  - `match`: đáp án là chỉ số trong `bank`.
- Trình bày như đề giấy (tuỳ chọn, trên group): `layout` = `form` | `notes` | `table` | `flowchart`. Không ghi thì app tự đoán theo dạng câu (form/note/flow-chart chỉ gồm fill/match, không có hình).
  - `table: { title?, columns?, rows: string[][] }`: mỗi ô là chuỗi, chỗ trống ghi `{{số câu}}`, xuống dòng bằng `\n`. Mỗi câu của group phải xuất hiện đúng một lần; nếu có `columns` thì mỗi hàng đủ số ô.
  - Với `form`/`notes`, `rows` là các dòng: một ô = một dòng (bắt đầu `•` là gạch đầu dòng), `"# Tiêu đề"` = tiêu đề nhỏ, hai ô = nhãn | giá trị.
- `npm run data` cảnh báo khi có câu trùng số, đáp án nằm ngoài options/bank, câu fill thiếu `___`, hoặc bảng thiếu/thừa `{{n}}`, sai số ô.

### Tình trạng chuyển đổi (08/11/2026)

| Bộ | Trạng thái |
|---|---|
| VOL 1–4 | Xong 40 đề. VOL 4 Test 5 không có audio; Test 7 (Q15–20) và Test 9 (Section 1) thiếu transcript; Writing của VOL 4 trùng VOL 3 nên bỏ qua |
| VOL 5 | Xong 10 đề + 19 đề Writing lẻ (`writing-bank.json`) |
| VOL 6 | 6 đề (chưa có Writing). Listening VOL 6 không có transcript (Test 1 dựng bằng Whisper), đáp án theo L-key |
| VOL 7–8 | Chưa làm |
| Speaking | 240 bộ (forecast 2023 Q1, Q2, "gộp đề ver 1", 2024 Q1, Sep 2024–Apr 2025, 2025 Q2) |

Lưu ý về chất lượng dữ liệu:
- VOL 5 không kèm key Listening, nên đáp án được suy từ transcript.
- `offset` của VOL 5 là ước lượng và có thể lệch vài giây. Chạy whisper để có mốc chính xác.
- Câu điền bản đồ không có hình, nên vị trí được mô tả bằng chữ.
- Chỗ nào key gốc mâu thuẫn với bài đọc/transcript thì đã ghi trong phần giải thích của câu đó.

## Cấu trúc mã

```
src/types.ts            schema Material / Question
src/db.ts               IndexedDB + state (materials, attempts, vocab, notes, drafts, blobs, bundle = cache bộ đề theo hash trong index.json)
src/content/samples.ts  nội dung mẫu
src/lib/                band.ts (quy đổi), text.ts (tách câu, diff từ, so đáp án), tts.ts, srs.ts (FSRS), vocab.ts (bộ từ, bài tập), dictation.ts (chia bài, chấm khớp), context.ts, stats.ts (XP, chuỗi ngày, Hôm nay), importers.ts (JSON/MD/SRT)
src/ai/                 client.ts (Claude SDK + backend OpenAI-compatible), models.ts (nhà cung cấp, model, giá), writing.ts, speaking.ts, assist.ts (dịch, tra từ, sinh đề)
src/components/         Questions (mọi dạng câu hỏi), WordPopover, Recorder, AudioPlayer, AiSettings, misc (diff, chart, band)
src/pages/              SkillList, ReadingTest, ReadingStudy, ListeningTest, Dictation (hub + bài), GapFill, MockTest, Speaking, Writing, Vocab, VocabSession (học/ôn/ngữ cảnh), Stats, Library, History, Guide, Settings
server/grader-proxy/    Cloudflare Worker giữ API key, cấp mã truy cập + giới hạn lượt/ngày
content/                đề gốc đã bóc tách (xem mục trên)
CLAUDE.md               ghi chú cho Claude Code: lệnh, quy ước dữ liệu, việc còn lại
scripts/                build-data.mjs (content → public/data), copy-audio.mjs (audio Drive → public/audio)
```

Thêm nội dung mẫu: sửa `src/content/samples.ts` (hoặc nạp JSON trong app, rồi xuất ra).
