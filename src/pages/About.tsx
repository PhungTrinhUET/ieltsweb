// Giới thiệu dự án + nhóm tác giả (#/about).
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Headphones, Mic, PenLine } from 'lucide-react';
// Ảnh qua Vite để tên file có mã hash: đổi ảnh là trình duyệt tải ảnh mới ngay.
import trinh from '../assets/team/trinh.webp';
import hung from '../assets/team/hung.webp';
import hai from '../assets/team/hai.webp';

export const AUTHORS = [
  { name: 'Phùng Trường Trinh', initials: 'PT', photo: trinh, grad: 'linear-gradient(135deg, #0f766e, #22c55e)' },
  { name: 'Hà Quang Hưng', initials: 'HH', photo: hung, grad: 'linear-gradient(135deg, #2563eb, #7c3aed)' },
  { name: 'Bùi Đức Hải', initials: 'BH', photo: hai, grad: 'linear-gradient(135deg, #ea580c, #db2777)' },
];
export const FOOTER_TEXT = `IELTS Practice · ${AUTHORS.map((a) => a.name).join(' · ')} · Khoa CNTT – Trường ĐH Công nghệ, ĐHQG HN`;

export function Avatar({ a, size = 72 }: { a: (typeof AUTHORS)[number]; size?: number }) {
  // Ảnh nằm đè lên chữ viết tắt; ảnh lỗi thì ẩn đi, còn lại chữ trên nền màu.
  return (
    <span className="ab-avatar" style={{ background: a.grad, width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {a.initials}
      <img src={a.photo} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    </span>
  );
}

export default function About() {
  return (
    <div className="page about" data-testid="about">
      <div className="page-head"><div><h1>Giới thiệu</h1><p>Web app luyện thi IELTS miễn phí, chạy ngay trên trình duyệt.</p></div></div>
      <section className="card pad stack">
        <h2 className="h3">Về dự án</h2>
        <p>
          <strong>IELTS Practice</strong> giúp người học luyện đủ bốn kỹ năng trên một nơi: làm đề Reading và Listening trong khung mô phỏng máy thi
          (tính giờ, chấm band ngay), viết Writing và nói Speaking rồi chấm bằng AI theo 4 tiêu chí của IELTS hoặc tự chấm theo checklist,
          thi thử đủ 4 kỹ năng như ngày thi thật. Kèm theo là từ vựng ôn theo lịch lặp lại ngắt quãng (FSRS), nghe-chép từng câu, thống kê tiến độ.
        </p>
        <p>
          Kho đề được bóc tách và soát lại từ các bộ đề gốc, có giải thích trích câu làm bằng chứng. Dữ liệu học lưu trong trình duyệt
          (IndexedDB), đăng nhập (tuỳ chọn) để đồng bộ giữa các máy; cài được như ứng dụng (PWA) và dùng được khi không có mạng.
        </p>
        <div className="ab-skills">
          <span><BookOpen size={16} /> Reading</span><span><Headphones size={16} /> Listening</span><span><PenLine size={16} /> Writing</span><span><Mic size={16} /> Speaking</span>
        </div>
      </section>

      <h2 className="h3">Nhóm tác giả</h2>
      <div className="ab-team" data-testid="ab-team">
        {AUTHORS.map((a) => (
          <article key={a.name} className="card ab-card">
            <Avatar a={a} size={96} />
            <h3 className="ab-name">{a.name}</h3>
            <p className="small">Thạc sĩ · Khoa Công nghệ Thông tin</p>
            <p className="small muted">Trường Đại học Công nghệ – ĐHQG Hà Nội</p>
          </article>
        ))}
      </div>

      <p className="small muted"><Link to="/guide">Cẩm nang dùng app <ArrowRight size={13} /></Link></p>
      <p className="ab-copy small muted">© 2026 · Phát triển bởi nhóm thạc sĩ Khoa CNTT, Trường ĐH Công nghệ, ĐHQG Hà Nội</p>
    </div>
  );
}
