# IELTS Practice – ghi chú cho Claude

Web app luyện IELTS 4 kỹ năng: Reading, Listening, Speaking, Writing.
- Công nghệ: Vite 8 + React 19 + TypeScript, HashRouter, IndexedDB, PWA.
- Giao diện viết bằng tiếng Việt; nội dung đề giữ nguyên tiếng Anh.
- Phần chấm Writing/Speaking bằng AI: Claude qua Anthropic SDK; DeepSeek/OpenAI/Gemini/OpenRouter/tuỳ chỉnh qua backend OpenAI-compatible trong `src/ai/client.ts` (JSON + zod, hỏi lại 1 lần). Danh sách model/giá ở `src/ai/models.ts`. Người dùng dán key trong *Cài đặt → AI*, hoặc dùng proxy `server/grader-proxy/` (mã truy cập + giới hạn/ngày).
- Tính năng và hướng dẫn dùng xem `README.md`.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm install` | cài thư viện (Node `^20.19` hoặc `>=22.12`) |
| `npm run dev` | dựng dữ liệu rồi chạy Vite ở http://localhost:5173 |
| `npm run data` | `content/` → `public/data/`. Script in `⚠` nếu câu hỏi lỗi. **Chạy lại sau mỗi lần sửa content** |
| `npm run audio -- "<thư mục>"` | chép/nén audio đề gốc vào `public/audio/vol<N>/test<M>/s1..s4.mp3`. ffmpeg bắt buộc với `.wma`; whisper tạo `.srt` (tuỳ chọn) |
| `npx tsc -b` | kiểm tra kiểu |
| `npm run build` | data + tsc + vite build → `dist/` |
| `npm run smoke [lọc]` | sau `npm run build`: mở `dist/` bằng Chrome headless (desktop + iPhone), đi qua mọi trang và các kiểm tra theo mục audit (A1–C16). `BASE_URL=… npm run smoke` để kiểm tra bản đang chạy |
| `npm run deploy` | build rồi đẩy `dist/` lên nhánh `gh-pages` → https://phungtrinhuet.github.io/ieltsweb/ (Actions bị khoá do billing nên deploy từ máy) |

Chưa có unit test; có `scripts/smoke.mjs` (trình duyệt thật). Sau khi sửa, chạy `npm run data` (không được còn `⚠`), `npx tsc -b`, `npm run build && npm run smoke`, rồi mở vài trang để xem, ví dụ `#/listening/vol5-t6-l2`, `#/reading/vol5-t6-r2`.

## Bản đồ mã

- `src/types.ts`: schema `Material` / `Question`. Đây là nguồn chuẩn cho các dạng câu hỏi.
- `src/db.ts`: IndexedDB (DB v2). Khi app mở, file này hỏi `public/data/index.json` rồi chỉ tải file có `hash` khác bản đã cache trong store `bundle`.
- `src/components/Questions.tsx`: hiển thị và chấm mọi dạng câu hỏi.
- `src/pages/`: các màn hình. Gồm SkillList, ReadingTest/ReadingStudy, ListeningTest, Dictation, GapFill, MockTest, Speaking, Writing, Vocab, Library, History, Guide, Settings.
- `src/ai/`: gọi Claude (structured output) để chấm Writing/Speaking, dịch, tra từ, sinh đề.
- `scripts/build-data.mjs`: chuyển content → material. Script tự xử lý `offset`/`cut`, `.srt`, và kiểm tra đáp án.
- `scripts/copy-audio.mjs`: đoán VOL/test/section từ đường dẫn và tên file audio.
- `content/`: **dữ liệu đề gốc đã bóc tách** (đây là "database"). Các thư mục `public/data/` và `public/audio/` là file sinh ra, đã nằm trong `.gitignore`.

## Định dạng content

Đầy đủ ở mục "Định dạng content/vol<N>/test<M>.json" trong README. Tóm tắt:

- File `content/vol<N>/test<M>.json` chứa `{ vol, test, source, listening: { audioDir, timingNote?, sections[] }, reading[], writing[] }`.
- ID của material: `vol<N>-t<M>-l<section>`, `-r<passage>`, `-w<task>`.
- Đề Writing lẻ nằm ở `content/vol<N>/writing-bank.json` (mẫu: `vol2`, `vol3`). Bộ Speaking nằm ở `content/speaking/forecast-*.json` (mẫu: `forecast-2023q2.json`).
- Transcript Listening: mỗi dòng `[mm:ss] Người nói: lời`, mốc tính theo audio gốc.
  - VOL 5 trở đi: transcript là một dòng thời gian liền cả bài, còn audio tách P1–P4. Đặt `offset` = số giây tại câu "Part/Section N" của người dẫn.
  - Audio gộp một file: dùng `cut: "m:ss"`.
- Các dạng câu hỏi và cách ghi đáp án:
  - `mcq`: chỉ số (0 = A).
  - `multi`: mảng chỉ số; một câu tính cho 2–3 số.
  - `tfng` / `ynng`: chuỗi `TRUE` / `FALSE` / `NOT GIVEN` (hoặc `YES` / `NO`).
  - `fill`: phải có `___` trong `text`; đáp án là mảng các cách viết được chấp nhận.
  - `match`: chỉ số trong `bank` của group.
- Group có thể ghi `layout` (`form`/`notes`/`table`/`flowchart`) và `table: { title?, columns?, rows }`: ô chứa `{{n}}` cho chỗ trống, mỗi câu đúng một lần (`npm run data` kiểm tra). Form/notes: hàng 1 ô = dòng, `"# X"` = tiêu đề, 2 ô = nhãn | giá trị.
- `explanation`: trích nguyên câu làm bằng chứng từ transcript hoặc bài đọc, có thể thêm ghi chú tiếng Việt ngắn.
  - Khi key gốc sai hoặc mâu thuẫn với bài: chọn đáp án đúng theo bài và ghi "(key trong file giải thích ghi X)".
  - Khi bộ đề không có key: ghi rằng đáp án được suy từ transcript.
- Câu điền bản đồ/sơ đồ không có hình: `bank` là các vị trí mô tả bằng chữ, lấy từ lời chỉ đường. Xáo thứ tự, thêm 1–2 vị trí nhiễu, và ghi chú trong `instruction` rằng không có hình.
- Câu thiếu ngay trong đề gốc (không tìm được bản đủ): không bịa. Ghi vào `"gaps": [{ "skill": "reading", "passage": 3, "nos": [27], "note": "…" }]` ở đầu file test (listening dùng `"section"`). `note` hiện trên trang bài đó; `npm run data` báo `⚠` nếu một số 1–40 vừa không có câu vừa không nằm trong `gaps` (câu `multi` tính đủ số theo `answer.length`).
- Lỗi OCR: sửa chính tả, sắp lại đoạn bị đảo, không bịa thêm nội dung. Nếu buộc phải dựng lại câu hay phương án bị mất, ghi rõ trong `source` hoặc `explanation`.

## Tình trạng (08/11/2026)

- **Đã xong 64 file / 707 bài luyện**: VOL 1–4 đủ 40 đề; VOL 5 đủ 10 đề + 19 đề Writing lẻ; VOL 6 đủ 6 đề (chưa có Writing); 240 bộ Speaking (forecast 2023 Q1, Q2, "gộp đề ver 1", 2024 Q1: 87, Sep 2024–Apr 2025: 74, 2025 Q2: 35).
- **TẠM DỪNG 08/11/2026 theo yêu cầu người dùng**; chờ người dùng bảo chạy tiếp (dự kiến tuần sau). Khi tiếp tục: làm VOL 6 Writing, rồi VOL 7 từ Test 1.
- Đợt audit 08/11/2026 (nhánh `fix/audit-1108`, đã merge vào `master`): A1–A7, B8–B12, C13–C16 xong; smoke 100/100. Audio (A4) tải từ Drive bằng `../ieltsweb-src/tools/dlaudio.py` (gdown), Drive hay chặn tạm ("Cannot retrieve the public link") → chạy lại sau, rồi `npm run audio`.
- VOL 4 có vài chỗ thiếu: Test 7 (Q15–20) và Test 9 (Section 1) thiếu transcript; Writing trùng VOL 3 nên bỏ qua.

## Tiến độ phiên chuyển đổi (cập nhật liên tục)

Task list (đánh dấu `[x]` khi xong; dòng `→` là đang làm):
- [x] VOL 5 Test 7 · [x] Test 8 · [x] Test 9 · [x] Test 10
- [x] 2. VOL 5 Writing → `content/vol5/writing-bank.json` (19 đề: 9 Task 1 + 10 Task 2, ảnh ở `public/img/vol5/`; Drive không có file Task 1 số 8; đề Task 1 viết lại theo hình vì file gốc chỉ có hình + bài mẫu, đã ghi trong `source`)
- [x] 3. Speaking quý 1.2024 → `content/speaking/forecast-2024q1.json` (87 bộ; "50 đề mới update.pdf" là scan không đọc được; "CÁC GÓI DỰ ĐOÁN…" chỉ là tờ quảng cáo)
- → 4a. VOL 6: [x] Test 2 · [x] Test 3 · [x] Test 4 · [x] Test 1 · [x] Test 5 · [x] Test 6 · [x] Speaking (`forecast-2024sep-2025apr.json` 74 bộ, `forecast-2025q2.json` 35 bộ có bài mẫu) · [ ] Writing (đã dừng giữa chừng, làm lại từ đầu). ID thêm: `L-TEST 5.pdf` `1BTzFTv7mUd2dqRKYkO42vznYdP9OBzFN`, `expl 1-4.pdf` `1Fr6tiPAWmwHXFPv57gRco95fCPZIit0e`; Audio Lis: Test 1 `1dP2C3xIe67DyEHbVxzhoLVW3y3v_sxni`, Test 2 `1jf9BOusktTVs8BqyblInKa-9aQwukCnH`, Test 3 `13s3vKn6oiAXwVeWZNvLiGRGeK_d7_td_`, Test 4 `10S_zJ20o5wAJaKOtJXJ9LrwD3I9LbTEG`, Test 6 `1tWYBG7t4FxwDDYlgc3pZVvlusBlb78W3` Test 5 `1N5aWYH9DQxzsS8_3657lv6jQu4EMsKQP`.
- [ ] 4b. VOL 7 (bản nháp Test 1 do subagent bị dừng, chưa soát, để ở scratchpad phiên cũ; không dùng được ở phiên sau → làm lại) · [ ] 4c. VOL 8
- [x] 5. Audio (09/11/2026): 214 file Drive VOL 1–6 → `npm run audio` → 222 file s<N>.mp3 → MinIO bucket `ieltsweb-audio` (`npm run audio:upload`, ghi `content/audio-manifest.json`). 214/216 section Listening có audio; thiếu VOL1 T5 Part 1 và VOL1 T8 Part 2 (Drive không có; `VOL 7/Reading/các đề update web…/Test 5 vol 1 audio.mp3` 29 phút có thể là cả đề VOL1 T5, chưa cắt). VOL 7 có audio gộp T3, T7, T11 (chưa có content).
- [ ] 6. `npm run build` + báo cáo cuối

Quyết định đã ghi:
- 09/11/2026: audio đề host ở MinIO `https://s3.hairbui76.id.vn/ieltsweb-audio/` (`.env` → `VITE_AUDIO_BASE`); khoá S3 chỉ ở `.env.local`. Node trong máy cloud cần `NODE_USE_ENV_PROXY=1` để `fetch` đi qua proxy. Tải cả cây Drive: gdown `_download_and_parse_google_drive_link` (embedded folder view) rồi `gdown.download(id=…)`.
- 08/11/2026: repo ban đầu chỉ có `ielts-practice.zip`; đã giải nén nội dung ra gốc repo, commit "baseline: 50 đề"; zip để trong `.gitignore`.
- Máy không có `node`/`npm` trong PATH: đã tải Node v22 LTS vào `~/.local/opt/node` → trước khi chạy lệnh: `export PATH=$HOME/.local/opt/node/bin:$PATH`.
- Không có tesseract/whisper; nguồn đề lấy qua Google Drive connector (`read_file_content` tự OCR PDF).
- Ở VOL 5, ID cột "Transcript" là **file PDF** ("test N- transcripts.pdf"), không phải thư mục.
- Audio đề chỉ có trên Drive (connector không tải được file mp3 lớn) → bước `npm run audio` chờ người dùng tải thư mục về máy.

Đáp án chưa chắc chắn (gom cho báo cáo cuối):
- VOL5 T7: L Q2 (số điện thoại ghép "0784, double 0, 51963"), L Q17–18 (C, D), L Q24 (transcript ghi "effective", hiểu là "affected"), L Q30 (phụ thuộc việc sắp lại Step 3/5 bị OCR đảo), R Q1 "adaptation" (câu ghi chú OCR lộn xộn). R P1 đoạn 2 và R P2 đoạn A có chữ dựng lại/mất; P3 không có tiêu đề gốc.
- VOL5 T8: L Q5 (đuôi "EG" từ transcript "e g"), L Q21 (B, có thể là A), L Q25–26 (A, E). R Q7 FALSE theo key (có thể NOT GIVEN).
- VOL5 T9: L Q21–22 (A, B), L Q26, L Q27 (A, C cũng hợp lý), L Q37 (nhận "materials"/"content"). R Q34 không có trong đề gốc → dựng lại từ bản công khai (ielts.xdf.cn), khớp key C. R Q35 NO theo key. Đoạn H P3 "more enduring" là đoán.
- VOL5 T10: L Q1 "0478883925" (ghép "triple 8"), L Q2 "Vander" (dựng từ đánh vần), L Q13 bed/bedroom, L Q15 "rare", L Q18–20 (C, F, E; đã đối chiếu bản đồ gốc), L Q21–23 (A, B, D: phân vai transcript không chắc). R Q2 NOT GIVEN (key ghi TRUE). Offset S2–S4 (7:44 / 13:01 / 18:41) ước lượng; mốc trong S2, S4 nội suy. R P2 dựng lại "the arrival of humans on the continent".
- VOL6 T2: không có transcript Listening; bản đồ Q16–20 chỉ có chữ A–I (PDF 8 MB, connector không tải được hình). L Q25–30 key lặp C, D dù đề "Choose SIX" (chưa kiểm được). R Q2 NOT GIVEN (key ghi FALSE). R Q38–40 F, B, C (key ghi D, C, B; key có vẻ bị lệch chữ).
- VOL6 T3: Listening KHÔNG có transcript (nguồn gốc không có) → đáp án theo L-key; bản đồ Q15–20 chỉ có chữ A–I, không có hình. L Q14 thứ tự B/C khác nhau giữa PDF và docx (theo PDF). R Q25–26 chọn C, E (key ghi B, E). R Q30–32 file giải thích đánh số lệch: 30 C, 31 B, 32 G suy từ bài. R Q34 hai chỗ trống tính một câu. P2 đoạn F dựng lại "experiments to find out how wings work".
- VOL6 T4: không có transcript; key Listening OCR lộn cột, đã ghép lại (P2: 11B 12E 13C 14F 15G 16A 17B 18B 19A 20A; P3: 21A 22B 23B 24C 25C 26C 27F 28A 29E 30B). R Q7 FALSE theo key (có thể đọc TRUE). R Q29 B suy luận. R Q40 chữ "positive" lấy từ expl (PDF bị cắt).
- VOL6 T1: transcript Listening tự dựng bằng Whisper từ audio Drive (offset 0, mỗi file S1–S4 từ 0:00); 2 chỗ nghe không ra để `[…]`. L Q24 A (key ghi C). R Q10 NOT GIVEN (key ghi FALSE). R Q29 G / Q30 F / Q36 D: chữ trong key mâu thuẫn lời giải thích (key F/E/C). R Q40 C (key ghi E), chưa chắc.
- VOL6 T5: không có transcript (đáp án theo L-key); sơ đồ Q16–20 mô tả bằng chữ từ hình gốc. R Q24–26 lấy từ expl 5-6.pdf (đề PDF thiếu). R Q24 G (key ghi E). R Q38 H "period" (key ghi B). R Q27–30 D, B, C, B suy từ giải thích (Q28 kém chắc). P2 đoạn G "about 10 seconds" dựng lại (gốc mất số).
- VOL6 T6: không có transcript (đáp án theo L-key); bản đồ Q11–14 chỉ chữ A–I. L Q14 I (OCR key ghi "1"); L Q26–30 H E I A D ghép lại từ OCR. R3 câu Canton dựng lại "mixes the quantitative and the qualitative" (gốc chỉ còn "mixes the qualitative") – cần soát. Audio tên `P1 - .mp3`, `P3 .mp3` cần xem copy-audio đoán đúng.
- VOL5 T7: transcript tách từng phần (mỗi phần bắt đầu từ 0:00) nên offset = 0 cho cả 4 section.

Cấu trúc Drive đã dò (listing hay thiếu file → lọc thêm `title contains '<số>'`):
- VOL 5 Writing `1yTW_…`: thư mục con `task 1` `1UF83fXEQ8DZDfu2wi1a-RmRzC3L5K9CU`, `task 2` `1DL5DnW9tfM_t3ze2fvhscJTQAs9UCv1d`.
- Speaking quý 1.2024 `1Ar2…`: thư mục "gom đề speaking quý 1.2024" `1fVyT7VlaO7GS0umBl4425hY8OUKBoe6_`, "50 đề giữ lại" `1zxK1f_1a07BaItHMrOlJKijbOM7iMBZH`, "50 đề mới update" `1IRkjjnxIW_utU34ji1UzjiISIfE5NXEl`, sách "IELTS SPEAKING NGOCBACH 2024.pdf" `1oLCdl0MPvIyGKdJzR7eNd5ZsQgfUabrk`.
- VOL 6 (`VOL 6- ORIGINAL EXAMS` `1_3MYuZ3fzO4Aelo-b5rrPQtZHxYb8Atn`), 6 test:
  - `Lis` `1KyuRW5nngpAEU-WgLqTlJL2T4pCO2yBG`: `L-TEST 1..6.pdf`, `L-key.pdf` `1ywS-FYaMtjYVj7CbmAzJEAIexcdqWhZ-`, `Full Listening.docx` `1i8OJaKF_y3MMWEOafh2ZvTmmghc04BS-`, thư mục `Audio Lis/Test 1..6`.
  - `Read` `14feG6uALluIqWZ7F0UKDD8d8OBLO8NHI`: `R-TEST 1-update.pdf`, `R-TEST 2..6.pdf`, `expl 5-6.pdf` (…), `Full Reading.docx` `1VhcxLcklfOVkVkxOnnccL8OnBiA6n1dO`.
  - `Writing` `1UIBWSRIa6Lw-hpwBJAhKRXO71TnV-66Y`: 2 PDF dự đoán Writing 2025. `Speaking` `1qLOOTj8pYXrQ5f3CAIoawHGdKrM6AL7m`: 3 PDF Speaking quý 2/2025, Sep 2024–Apr 2025.
- VOL 7 (`10IMzuyZ7EEIl47h4vofuOl52DXlB_h90`), có vẻ 16 test:
  - `Listening` `1N7W-lR0VgoXHx3KhN8-2YEfulhEEmhI1`: thư mục `Test 1-10` `1m-iTmQdWvFryfEpLJ5Pk4g1RdeipIZGu`, `Test 11` `1kudW--PJfBcFeIyemGY9fFhA94j33zpT`.
  - `Reading` `1TMv_UxVBkLanzKB-TWT65yk-YPBIaObj`: `Test 1-10` `177ZK952BY-sh39w0nix6DtYb4j_69AcB`, `Test 11-16` `1nbRnKQyf-GcV7jIbmP-gzMreR9AYyP3z`, `Explaination Read VOL 7` `1kCzgWTZ_sf2WARJkpOJc4Wpu2h_FdcS9`, `các đề update web khác trên bản pdf` `1QTMRC4ZK1okV8fldjXl-ItceGiPYFvZ0`, `Reading T1-10 VOL 7.pdf` `1wiz6POF32Bptz2RxBT4kGBRFSaOXI3Kg`.
- VOL 8 (`1b1KUbK1IYj20EzP0wrs8_cFntsuiU9bC`):
  - `LISTENING` `1D3Q90kRTp2h2GX4NfRxTO5L-3vPGawGk`: `TRANSCRIPT-KEY` `12zhHCpT80q-bWRPv4cGA2jPaTvdbs5Gn`, `AUDIO` `1bDkMX0QQ2nADnLIx9yHS7rKRyISLOB7H`, `VOL 8 TEST N LIS.docx` (thấy N = 1, 2, 8).
  - `READING` `1bQced4SqsAeOVMHfVV4RoIbtvcP9JL5E`: `Test N.pdf` (thấy 1, 2), `Key.pdf` `1NHSfOHagX13W-D7eRXAN5M0sIFHMgrPc` (43 MB), 2 Google Doc "Test 2".

## Việc tiếp theo, theo thứ tự

1. **VOL 5 Test 7–10**: mỗi test là một file `content/vol5/test<N>.json`, theo mẫu `content/vol5/test6.json`.
2. **VOL 5 Writing** → `content/vol5/writing-bank.json`.
3. **VOL 5 "Speaking quý 1.2024"** → `content/speaking/forecast-2024q1.json`. Tham khảo thêm "CÁC GÓI DỰ ĐOÁN PAGE CUNG CẤP 2024.pdf".
4. **VOL 6, 7, 8.**
5. Sau mỗi VOL:
   - chạy `npm run data` và `npx tsc -b`, mở thử vài trang;
   - cập nhật bảng tình trạng ở đây và trong README;
   - báo người dùng một dòng tiến độ.

Một test VOL 5 làm theo các bước:
1. Đọc PDF câu hỏi Listening ("Test N- up.pdf" trong `Listening/Test N`).
2. Đọc transcript ("test N- transcripts.pdf" trong "Transcripts & Keys"). Phân vai người nói cho đúng: transcript tự động hay gán nhầm vai.
3. Suy đáp án Listening từ transcript.
4. Đọc Reading ("Test N- up.pdf") và "Explanation- N.pdf" (có key và câu trích).
5. Viết JSON, rồi chạy `npm run data`.

## Lấy tài liệu gốc

Có hai cách:
- **Google Drive connector**, nếu phiên có. Dùng `search_files` với `parentId = '<id>'`, từng thư mục một, và `read_file_content` để đọc/OCR PDF.
  - Truy vấn OR thường trả về rỗng.
  - `nextPageToken` hay lặp lại trang cũ, nên lọc thêm theo `mimeType` hoặc `title contains`.
- **Tải thư mục Drive về máy**, giữ nguyên cấu trúc thư mục.
  - PDF có chữ: đọc bằng `pdftotext -layout`.
  - PDF scan: OCR bằng `tesseract` / `ocrmypdf`, hoặc tìm bản công khai của cùng bài đọc trên web rồi đối chiếu với file Explanation.
  - Audio: chạy `npm run audio -- "<thư mục>"`.

Thư mục gốc trên Drive: https://drive.google.com/drive/folders/179iZJpFg1g-0uHzBFSfUA7QCd8h8_rcq

VOL 5 (thư mục trong: `1dhtdBx9yx1jS76R9K7m6rrlN3rDi4JOD`)

| | Listening (câu hỏi + audio) | Transcript | Reading (đề + Explanation) |
|---|---|---|---|
| Test 7 | `1-VBDLcFLh2KAYF6qy7NnNEM0bKT-5CKj` | `1kMngseSZPXUKfLKK9LRTlYLNyGnA1bzq` | `1-6UT6bdmib2-V6ECW5WcGKFxcXexegru` |
| Test 8 | `1Nr7PsulXyjQBU3Y9LoHotxKsBjFotqWC` | `11GS4qhf5hHEH5l85LP49kJYXfv9bkZCH` | `11v7jq-8PmhVM6orpB1pBpawEJaVyscmd` |
| Test 9 | `1I8PITh6kp_E-c_ecyrGEEjH_zTi7wXIs` | `1Oh_Ac68xISUXHmvxp3SKWTjvCeE9LwrL` | `10CzYI2Ii1jsSGLc1UkUNcb3M55T7QUa-` |
| Test 10 | `1bUgBCWSDKeKWbFHefTnsPsUt4KKNtmfC` | `1Tx5gJCQ6RdOMd-KyHCc_DSLHv5fuT9WH` | `1L3CWFxrQIctR9DCYY1yCB96c4xDRqHj_` |

- Writing VOL 5: `1yTW_yJqtWHEHNSaoeG64Y6w4hBAY7BBg`
- Speaking quý 1.2024: `1Ar2EuuZOnjWbt6g4oqNfVj5YFmuychpR`
- CÁC GÓI DỰ ĐOÁN PAGE CUNG CẤP 2024.pdf: `1CgvX8VaD-a_rtsYX3AuR5t9WBeJYWIzt`
- VOL 6: `1O456vLZ5whqPRuNSL1zq93PA7ys6kWhB` · VOL 7: `1dwSwqJt5UppjFcHMWVJkt6Hmg2I5Zaqx` · VOL 8: `1H2Yg-vqvoHIIToIFvCMl8C-KpzrGYWO0`. Mỗi thư mục bọc thêm một thư mục con.

## Quy ước

- Không thêm thư viện nếu không thật cần.
- Không sửa file trong `public/data/`: đó là output của `npm run data`.
- Khi tạo JSON bằng Python, dùng `ensure_ascii=False` để giữ tiếng Việt.
