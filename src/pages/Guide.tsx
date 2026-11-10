// Cẩm nang: cấu trúc đề, chiến lược từng dạng câu hỏi, khung bài Writing/Speaking, band descriptors tóm tắt.
import { useState } from 'react';
import { Collapse } from '../components/ui';
import { KeepDataTips } from '../components/BackupPanel';
import { AiSetupGuide } from '../components/AiGuide';

const TABS = ['Tổng quan', 'Cài AI', 'Reading', 'Listening', 'Speaking', 'Writing', 'Band'] as const;

export default function Guide() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Tổng quan');
  return (
    <div className="page">
      <div className="page-head"><div><h1>Cẩm nang IELTS</h1><p>Chiến lược và khung bài để dùng ngay trong lúc luyện.</p></div></div>
      <div className="tabs">{TABS.map((t) => <button key={t} className={`tabs__btn${tab === t ? ' is-on' : ''}`} onClick={() => setTab(t)}>{t}</button>)}</div>

      {tab === 'Tổng quan' && (
        <div className="guide">
          <section className="card pad"><h3>Cấu trúc bài thi</h3>
            <table className="table"><tbody>
              <tr><td><strong>Listening</strong></td><td>30 phút + 10 phút chép đáp án (giấy) · 4 section · 40 câu · nghe 1 lần</td></tr>
              <tr><td><strong>Reading</strong></td><td>60 phút · 3 bài · 40 câu · không có thời gian chép đáp án</td></tr>
              <tr><td><strong>Writing</strong></td><td>60 phút · Task 1 (≥150 từ, 20 phút) · Task 2 (≥250 từ, 40 phút, tính gấp đôi)</td></tr>
              <tr><td><strong>Speaking</strong></td><td>11–14 phút · Part 1 (4–5') · Part 2 (1' chuẩn bị + 2' nói) · Part 3 (4–5')</td></tr>
            </tbody></table>
          </section>
          <section className="card pad"><h3>Cách dùng app hiệu quả</h3>
            <ol className="plan">
              <li><strong>Làm đề có bấm giờ trước, học sâu sau.</strong> Reading/Listening: nộp bài → vào “Học bài này” để đọc lại, dịch từng câu, lưu từ.</li>
              <li><strong>Chép chính tả</strong> là cách nhanh nhất tăng Listening: 1 đoạn/ngày, mục tiêu ≥ 90% từ đúng, sau đó shadowing.</li>
              <li><strong>Từ vựng:</strong> chỉ lưu từ gặp trong ngữ cảnh; ôn hằng ngày theo lịch SRS (10–15 phút).</li>
              <li><strong>Writing:</strong> viết đúng giờ, nộp AI chấm, học bảng “nâng cấp cụm từ”, viết lại bài đó sau 3 ngày.</li>
              <li><strong>Speaking:</strong> ghi âm, nghe lại ít nhất 1 lần trước khi xem mẫu; học câu mẫu AI viết lại từ chính ý của bạn.</li>
              <li><strong>Nạp tài liệu:</strong> bạn có thể nạp cả bộ Cambridge của mình (JSON/Markdown + audio + SRT) hoặc dán bài báo cho AI soạn đề.</li>
            </ol>
          </section>
          <section className="card pad" id="keep-data"><KeepDataTips /><p className="small muted">Sao lưu / khôi phục ở <a href="#/settings">Cài đặt → Sao lưu</a>.</p></section>
        </div>
      )}

      {tab === 'Cài AI' && (
        <div className="guide" data-testid="guide-ai">
          <section className="card pad"><h3>Cài AI chấm bài (3 phút)</h3><AiSetupGuide /></section>
        </div>
      )}

      {tab === 'Reading' && (
        <div className="guide">
          <Collapse title="Matching headings" defaultOpen tone="tip"><ul><li>Đọc tiêu đề trước, gạch từ khoá; đọc câu đầu + câu cuối mỗi đoạn.</li><li>Tiêu đề đúng bao quát <em>cả đoạn</em>, không chỉ một chi tiết; cẩn thận tiêu đề chứa từ xuất hiện trong đoạn (bẫy).</li><li>Làm đoạn dễ trước, loại trừ dần.</li></ul></Collapse>
          <Collapse title="True / False / Not Given – Yes / No / Not Given" tone="tip"><ul><li>Câu hỏi theo thứ tự bài. Tìm vị trí bằng tên riêng, số, danh từ.</li><li><strong>FALSE/NO</strong> = bài nói <em>ngược lại</em>; <strong>NOT GIVEN</strong> = không có thông tin để khẳng định hay phủ định.</li><li>Để ý từ tuyệt đối (all, only, always, first) và từ so sánh – thường là điểm bị bóp méo.</li><li>Y/N/NG hỏi về <em>quan điểm của tác giả</em>, không phải sự kiện.</li></ul></Collapse>
          <Collapse title="Sentence / summary / note completion" tone="tip"><ul><li>Đọc giới hạn từ (ONE WORD / NO MORE THAN TWO WORDS AND/OR A NUMBER).</li><li>Đoán loại từ cần điền (danh từ số nhiều? động từ?), đáp án thường là từ <em>nguyên văn</em> trong bài.</li><li>Chép đúng chính tả; chữ viết hoa không bị trừ.</li></ul></Collapse>
          <Collapse title="Multiple choice" tone="tip"><ul><li>Đọc câu hỏi, gạch từ khoá, định vị trong bài, rồi mới đọc đáp án (tránh bị đáp án dẫn dắt).</li><li>Đáp án đúng là paraphrase; đáp án sai thường có từ đúng nhưng ý sai, hoặc đúng nhưng không được nhắc.</li></ul></Collapse>
          <Collapse title="Matching information / features / sentence endings" tone="tip"><ul><li>Matching information: câu hỏi <em>không theo thứ tự</em>; một đoạn có thể dùng 2 lần (NB).</li><li>Matching features (tên người/tổ chức): highlight tất cả tên trước, đọc quanh mỗi tên.</li><li>Sentence endings: ghép phải đúng ngữ pháp <em>và</em> đúng ý bài.</li></ul></Collapse>
          <Collapse title="Quản lý thời gian" tone="info"><p>20 phút/bài, bài 3 khó nhất. Không dành quá 1,5 phút cho một câu; điền mọi câu (không trừ điểm sai). Skim 2–3 phút để nắm ý mỗi đoạn, rồi làm theo dạng câu hỏi.</p></Collapse>
        </div>
      )}

      {tab === 'Listening' && (
        <div className="guide">
          <Collapse title="Trước khi nghe" defaultOpen tone="tip"><ul><li>Dùng thời gian đọc câu hỏi: gạch từ khoá, đoán loại từ/số cần điền, đọc giới hạn từ.</li><li>Section 1: tên, số, ngày, địa chỉ – luyện đánh vần, số điện thoại, 13/30, 15/50.</li><li>Section 3–4: đọc trước các mục, đoán paraphrase.</li></ul></Collapse>
          <Collapse title="Bẫy thường gặp" tone="tip"><ul><li><strong>Đổi ý:</strong> “I was going to… but actually…”, “No, wait…” – đáp án là ý sau cùng.</li><li><strong>Distractor:</strong> nhiều lựa chọn được nhắc; nghe kỹ phủ định và từ nối (however, although).</li><li><strong>Số nhiều / -ed:</strong> “books” vs “book” bị trừ điểm; nghe đuôi âm.</li><li>Trả lời đúng số từ; không chép thừa mạo từ nếu vượt giới hạn.</li></ul></Collapse>
          <Collapse title="Luyện nghe hằng ngày" tone="info"><ul><li><strong>Chép chính tả</strong> (app: Listening → Chép chính tả): nghe 3 lần, gõ, so từng từ, đọc lại.</li><li><strong>Điền từ transcript:</strong> tăng độ khó dần; tập trung từ chức năng (a/the, of, to) và đuôi từ.</li><li><strong>Shadowing:</strong> đọc đồng thời với audio, giữ ngữ điệu và nối âm – vừa cải thiện nghe vừa phát âm.</li><li>Nguồn thêm: BBC 6 Minute English, TED-Ed, IELTS Listening Cambridge 10–19 (nạp audio + transcript vào app).</li></ul></Collapse>
        </div>
      )}

      {tab === 'Speaking' && (
        <div className="guide">
          <Collapse title="Part 1 – mở rộng câu trả lời (AREA)" defaultOpen tone="tip"><p><strong>A</strong>nswer → <strong>R</strong>eason → <strong>E</strong>xample → <strong>A</strong>lternative/feeling. 2–4 câu mỗi câu hỏi, không học thuộc. Dùng “Well, to be honest…”, “It depends, but generally…”.</p></Collapse>
          <Collapse title="Part 2 – khung 2 phút" tone="tip"><ul><li>1 phút chuẩn bị: ghi 4–6 từ khoá cho 4 gạch đầu dòng + 1 chi tiết sống động.</li><li>Mở: “The X I'd like to talk about is…”; thân: trả lời từng gạch đầu dòng, kể một kỷ niệm cụ thể (quá khứ); kết: cảm nhận/lý do.</li><li>Nói đến khi giám khảo dừng. Thì quá khứ + từ nối thời gian (at first, eventually, looking back).</li></ul></Collapse>
          <Collapse title="Part 3 – trả lời câu hỏi trừu tượng" tone="tip"><ul><li>Quan điểm → lý do → ví dụ → mặt khác / điều kiện (“It largely depends on…”, “That said…”).</li><li>Nói chung về xã hội (people tend to…), không chỉ bản thân.</li><li>Ngôn ngữ suy đoán: might, could well, I'd imagine, arguably.</li></ul></Collapse>
          <Collapse title="Tiêu chí chấm" tone="info"><ul><li><strong>Fluency & Coherence:</strong> nói dài, ít ngập ngừng, từ nối đa dạng.</li><li><strong>Lexical Resource:</strong> từ ít phổ biến, collocation, idiom tự nhiên, paraphrase.</li><li><strong>Grammar:</strong> trộn câu đơn/phức, thì, điều kiện, mệnh đề quan hệ, ít lỗi.</li><li><strong>Pronunciation:</strong> trọng âm, ngữ điệu, nối âm, âm cuối – app không chấm được từ transcript, hãy nghe lại bản ghi và tự đánh giá.</li></ul></Collapse>
        </div>
      )}

      {tab === 'Writing' && (
        <div className="guide">
          <Collapse title="Task 2 – khung 4 đoạn (250–300 từ, 40 phút)" defaultOpen tone="tip"><ul><li><strong>5 phút lập dàn ý</strong>: xác định dạng (opinion / discussion / advantage / problem / double), 2 ý chính, ví dụ.</li><li>Intro (2 câu): paraphrase đề + thesis/outline. Không dùng mẫu “In today's modern world…”.</li><li>Body ×2: câu chủ đề → giải thích → ví dụ → liên kết. Mỗi đoạn 1 ý được phát triển.</li><li>Conclusion (1–2 câu): tóm tắt, khẳng định lại; không thêm ý mới.</li><li><strong>5 phút soát lỗi:</strong> mạo từ, số nhiều, chủ-vị, thì, dấu câu.</li></ul></Collapse>
          <Collapse title="Task 1 Academic (150–190 từ, 20 phút)" tone="tip"><ul><li>Intro: paraphrase (The graph illustrates / The chart compares…).</li><li><strong>Overview bắt buộc</strong> (2 câu, không số liệu): xu hướng chính, cao nhất/thấp nhất, thay đổi lớn nhất.</li><li>Body: nhóm dữ liệu hợp lý, mỗi đoạn 3–4 số liệu, so sánh (twice as high as, by contrast, respectively).</li><li>Không nêu ý kiến, không giải thích nguyên nhân.</li><li>Process: bị động, trình tự (Initially, following this, once…, the final stage). Map: vị trí (to the north of, adjacent to), thay đổi (was demolished / converted into / extended).</li></ul></Collapse>
          <Collapse title="Task 1 General – thư" tone="tip"><ul><li>Formal: Dear Sir or Madam → Yours faithfully; Dear Mr Smith → Yours sincerely. Không viết tắt, không contractions.</li><li>Informal: Dear/Hi + tên, contractions, idiom thân mật; kết Love / Best wishes / Take care.</li><li>Mỗi gạch đầu dòng một đoạn, mở rộng chi tiết.</li></ul></Collapse>
          <Collapse title="Từ nối theo chức năng" tone="info">
            <table className="table"><tbody>
              <tr><td>Thêm ý</td><td>Furthermore, In addition, What is more, Another key point is</td></tr>
              <tr><td>Đối lập</td><td>However, Nevertheless, By contrast, Admittedly…, but</td></tr>
              <tr><td>Nguyên nhân – kết quả</td><td>As a result, Consequently, This leads to, owing to, stems from</td></tr>
              <tr><td>Ví dụ</td><td>For instance, A case in point is, This is illustrated by</td></tr>
              <tr><td>Kết luận</td><td>In conclusion, Overall, To sum up, On balance</td></tr>
            </tbody></table>
          </Collapse>
        </div>
      )}

      {tab === 'Band' && (
        <div className="guide">
          <section className="card pad"><h3>Reading / Listening: số câu đúng → band (đề 40 câu)</h3>
            <table className="table"><thead><tr><th>Band</th><th>Listening</th><th>Reading Academic</th><th>Reading GT</th></tr></thead><tbody>
              {[[9, '39–40', '39–40', '40'], [8.5, '37–38', '37–38', '39'], [8, '35–36', '35–36', '37–38'], [7.5, '32–34', '33–34', '36'], [7, '30–31', '30–32', '34–35'], [6.5, '26–29', '27–29', '32–33'], [6, '23–25', '23–26', '30–31'], [5.5, '18–22', '19–22', '27–29'], [5, '16–17', '15–18', '23–26'], [4.5, '13–15', '13–14', '19–22'], [4, '10–12', '10–12', '15–18']].map((r) => <tr key={r[0]}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>)}
            </tbody></table>
            <p className="small muted">Bảng quy đổi tham khảo (có thể lệch ±1 câu theo từng đề). App nhân tỉ lệ về 40 câu nếu đề ngắn hơn.</p>
          </section>
          <section className="card pad"><h3>Writing & Speaking – band tổng</h3>
            <p>Mỗi tiêu chí chấm theo band nguyên hoặc .5; band tổng = trung bình 4 tiêu chí làm tròn xuống 0.5. Overall 4 kỹ năng = trung bình, .25 làm tròn lên .5, .75 làm tròn lên 1.</p>
            <ul className="plan">
              <li><strong>Band 6:</strong> đủ ý nhưng phát triển chưa sâu; từ nối có nhưng máy móc; từ vựng đủ dùng, vài lỗi; trộn câu đơn/phức, lỗi không cản trở hiểu.</li>
              <li><strong>Band 7:</strong> lập trường rõ xuyên suốt, ý được mở rộng; liên kết tự nhiên, mỗi đoạn một ý; từ ít phổ biến, collocation; nhiều câu không lỗi.</li>
              <li><strong>Band 8:</strong> đủ và sâu; liên kết không gây chú ý; từ vựng rộng, linh hoạt, lỗi hiếm; đa số câu không lỗi.</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
