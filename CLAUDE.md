# IELTS Practice – ghi chú cho Claude

Web app luyện IELTS 4 kỹ năng: Reading, Listening, Speaking, Writing.
- Công nghệ: Vite 8 + React 19 + TypeScript, HashRouter, IndexedDB, PWA.
- Giao diện viết bằng tiếng Việt; nội dung đề giữ nguyên tiếng Anh.
- Phần chấm Writing/Speaking bằng AI gọi Anthropic SDK. Người dùng dán API key trong *Cài đặt → AI*, hoặc dựng proxy theo `server/grader-proxy/`.
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

Dự án chưa có test tự động. Sau khi sửa, chạy `npm run data` (không được còn `⚠`) và `npx tsc -b`, rồi mở vài trang để xem, ví dụ `#/listening/vol5-t6-l2`, `#/reading/vol5-t6-r2`.

## Bản đồ mã

- `src/types.ts`: schema `Material` / `Question`. Đây là nguồn chuẩn cho các dạng câu hỏi.
- `src/db.ts`: IndexedDB. Khi app mở, file này nạp `public/data/index.json`.
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
- `explanation`: trích nguyên câu làm bằng chứng từ transcript hoặc bài đọc, có thể thêm ghi chú tiếng Việt ngắn.
  - Khi key gốc sai hoặc mâu thuẫn với bài: chọn đáp án đúng theo bài và ghi "(key trong file giải thích ghi X)".
  - Khi bộ đề không có key: ghi rằng đáp án được suy từ transcript.
- Câu điền bản đồ/sơ đồ không có hình: `bank` là các vị trí mô tả bằng chữ, lấy từ lời chỉ đường. Xáo thứ tự, thêm 1–2 vị trí nhiễu, và ghi chú trong `instruction` rằng không có hình.
- Lỗi OCR: sửa chính tả, sắp lại đoạn bị đảo, không bịa thêm nội dung. Nếu buộc phải dựng lại câu hay phương án bị mất, ghi rõ trong `source` hoặc `explanation`.

## Tình trạng (08/11/2026)

- **Đã xong 50 đề / 422 bài luyện**: VOL 1–4 đủ 40 đề; VOL 5 Test 1–6; 44 bộ Speaking (forecast 2023 Q1, Q2, "gộp đề ver 1").
- VOL 4 có vài chỗ thiếu: Test 5 không có audio; Test 7 (Q15–20) và Test 9 (Section 1) thiếu transcript; Writing trùng VOL 3 nên bỏ qua.

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
