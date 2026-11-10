# Kho đề Writing tự soạn (156 đề)

Giải nén ở **gốc repo** `ieltsweb`. Các file sẽ vào đúng chỗ:

| File | Nội dung |
|---|---|
| `content/writing/task2-original.json` | Task 2: 60 đề, 6 dạng × 10 (opinion, discussion, advantage, problem, double, **development**) |
| `content/writing/task1-academic.json` | Task 1 Academic: **72 đề** (line 14, bar 13, pie 11, table 11, **mixed 6**, process 9, map 8) – **đề nào cũng có hình vẽ sẵn** |
| `content/writing/gt-letters.json` | Task 1 General Training: 24 thư (formal 8, semi-formal 8, informal 8), `module: "general"` |
| `public/img/writing/*.svg` | 72 hình SVG nền trắng như đề thi: biểu đồ (`l1.svg`, `b9.svg`, `x1.svg`…), process có icon, map 2 thời điểm |

Mỗi đề có: `prompt` (đề tiếng Anh như đề thi), `sample` (bài mẫu ~band 8, đoạn cách nhau bằng dòng trống), `outline` (dàn ý tiếng Việt), `vocab` (`[từ/cụm, loại từ, nghĩa Việt, ví dụ]`), `tags` (tên dạng; thư có thêm mục đích). Task 1 dạng biểu đồ có cả `image` (hình SVG vẽ sẵn) và `chart` (số liệu gốc, để AI chấm và để hiện bảng số liệu); dạng `mixed` có `charts` (mảng 2 biểu đồ) + `image` + `imageAlt`; process/map có `image` + `imageAlt` (mô tả hình bằng chữ, để AI chấm hiểu hình). Thư GT có thêm `purpose` (Phàn nàn, Xin việc, Cảm ơn…).

Quy ước `chart`:
- `line` / `bar`: `labels` = trục x hoặc nhóm cột; mỗi `series` = một đường / một màu cột.
- `pie`: **mỗi `series` là một biểu đồ tròn** (vd. 1994 và 2024), `labels` = các phần; tổng mỗi series = 100.
- `table`: `labels` = cột, `series` = hàng.
- `title`: tiêu đề biểu đồ; `unit`: đơn vị.

Đã kiểm tra tự động: id không trùng; bài mẫu Task 2 ≥ 250 từ (250–304), Task 1 156–210 từ, thư 182–211 từ; hình được vẽ từ chính số liệu trong `chart`, mở thử trong app đều hiện; số giá trị khớp số nhãn; tổng mỗi biểu đồ tròn = 100; mọi con số trong bài mẫu Task 1 đều có trong dữ liệu (trừ các số suy ra như hiệu số, tổng, số năm, đã soát tay); `node scripts/build-data.mjs` chạy được, ra thêm 156 bài (tổng 863) (`wr-t2-w…`, `wr-t1-w…`, `wr-gt-w…`), không có ⚠.

Số liệu biểu đồ là số liệu minh hoạ tự soạn (đã ghi trong `source`), không phải thống kê thật. Tên thành phố, làng (Northport, Elmbridge…) là tên giả định.
