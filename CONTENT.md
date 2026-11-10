# Định dạng tài liệu nạp vào IELTS Practice

Mọi bài đều là một **Material** (object JSON). Một file JSON có thể chứa một object hoặc một mảng nhiều object (nạp hàng loạt). Kéo thả vào trang **Tài liệu**.

Trường chung: `skill` (`reading | listening | speaking | writing`), `title`, `topic?`, `level?` (`easy|medium|hard`), `source?`, `tags?`. `id` tự sinh nếu thiếu.

## Câu hỏi (Reading & Listening)

```json
"groups": [
  {
    "instruction": "Do the following statements agree with the information…",
    "wordLimit": "NO MORE THAN TWO WORDS",
    "bank": ["Heading i", "Heading ii"],
    "context": "Tiêu đề bảng / đoạn tóm tắt (tuỳ chọn)",
    "questions": [
      { "no": 1, "type": "tfng", "text": "…", "answer": "TRUE", "explanation": "…" },
      { "no": 2, "type": "ynng", "text": "…", "answer": "NOT GIVEN" },
      { "no": 3, "type": "mcq",  "text": "…", "options": ["A…", "B…", "C…"], "answer": 1 },
      { "no": 4, "type": "multi","text": "Choose TWO…", "options": ["…"], "answer": [0, 2] },
      { "no": 5, "type": "fill", "text": "The ___ was built in 1900.", "answer": ["bridge", "the bridge"] },
      { "no": 6, "type": "match","text": "Paragraph A", "answer": 0 }
    ]
  }
]
```

- `fill`: dùng `___` ở chỗ điền; `answer` là chuỗi hoặc mảng các cách chấp nhận; phần trong ngoặc `(the) bridge` là tuỳ chọn.
- `match`: `answer` là chỉ số (0-based) trong `bank` của nhóm (hoặc `options` riêng của câu).

## Reading

```json
{ "skill": "reading", "title": "…", "module": "academic", "minutes": 20,
  "passage": "A Đoạn 1…\n\nB Đoạn 2…",
  "groups": [...],
  "translation": ["Dịch đoạn 1", "Dịch đoạn 2"],
  "vocab": [["word", "n", "nghĩa", "cụm trong bài"]] }
```

Đoạn cách nhau bằng dòng trống; bắt đầu đoạn bằng `A `, `B `… để đánh nhãn. Thiếu `translation` thì bấm “Dịch cả bài” bằng AI trong chế độ học.

### Reading dạng Markdown (nhanh hơn JSON)

```
# The Rise of Urban Beekeeping
topic: Environment
level: medium

A Over the past two decades…

B The appeal is easy…

## Questions 1-3
> Choose the correct heading for each paragraph.
bank: Why keeping bees attracts people | The spread of a hobby | A better alternative
1. [MATCH] Paragraph A :: ii
2. [MATCH] Paragraph B :: i
## Questions 4-6
> Do the following statements agree…
4. [TFNG] Honeybees are at risk. :: FALSE
5. [FILL] Hives would need four times the ___ available. :: floral resources
6. [MCQ] What did the study find? | A Lower wild bee numbers | B More honey | C Nothing :: A
```

## Listening

```json
{ "skill": "listening", "title": "…", "section": 1,
  "audio": "file:section1.mp3",
  "transcript": "Receptionist: Good morning…\nCaller: Hello…",
  "segments": [{ "start": 0.5, "end": 4.2, "text": "Good morning, Riverside Sports Centre." }],
  "groups": [...], "translation": [...], "vocab": [...] }
```

- `audio`: URL (https://…) hoặc `file:<tên file>` – kéo file audio cùng lúc với file JSON. Không có audio → app đọc transcript bằng giọng máy.
- `segments`: mốc thời gian từng câu để **chép chính tả theo đúng đoạn audio**. Kéo kèm file `.srt`/`.vtt` **cùng tên với file JSON** sẽ tự nạp. Không có segments → chép chính tả dùng giọng máy đọc từng câu.
- **Cách nhanh nhất:** kéo `bai1.mp3` + `bai1.txt` (transcript) hoặc `bai1.srt` → app tự tạo bài Listening (chưa có câu hỏi); sau đó có thể nhờ AI soạn câu hỏi ở mục “Tạo bài Listening”.

## Speaking

```json
{ "skill": "speaking", "title": "…", "topic": "Places",
  "part1": [{ "topic": "Hometown", "questions": ["…"], "samples": ["…"] }],
  "part2": { "topic": "…", "cue": "Describe a place…", "points": ["where it is", "…"], "followUp": ["…"], "sample": "…" },
  "part3": { "questions": ["…"], "samples": ["…"] },
  "vocab": [...] }
```

## Writing

```json
{ "skill": "writing", "title": "…", "task": 1, "module": "academic", "type": "line",
  "prompt": "The graph below shows…\n\nSummarise the information…",
  "image": "file:chart.png",
  "chart": { "kind": "line", "unit": "%", "labels": ["2005", "2010"], "series": [{ "name": "Europe", "values": [46, 67] }] },
  "outline": ["…"], "sample": "Bài mẫu band 8…", "vocab": [...] }
```

`type`: Task 2 – `opinion | discussion | advantage | problem | double`; Task 1 Academic – `line | bar | pie | table | process | map | mixed`; Task 1 General – `letter-formal | letter-semi | letter-informal`. Có `chart` thì app tự vẽ biểu đồ khi không có ảnh.

## Mẹo nạp hàng loạt

- Gom nhiều bài vào một mảng JSON: `[ {...}, {...} ]`.
- Hoặc dán bài báo / transcript vào mục **AI soạn đề** – AI trả về đúng cấu trúc trên và lưu luôn.
- Sao lưu toàn bộ (tài liệu + kết quả + từ vựng) ở **Cài đặt → Sao lưu**.
