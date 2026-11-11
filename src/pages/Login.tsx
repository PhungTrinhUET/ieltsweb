// Màn hình chào + đăng nhập: hiện khi mở web lần đầu (chưa đăng nhập, chưa chọn dùng không tài khoản).
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Cloud, Headphones, Layers, Mic, NotebookPen } from 'lucide-react';
import { init } from '../db';
import { Logo } from '../App';
import { LoginForm } from '../components/CloudPanel';
import { cloudEnabled, setGuest, useCloud } from '../lib/cloud';

export default function Login() {
  const c = useCloud();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next') || '/';
  useEffect(() => { init(); }, []);
  useEffect(() => { if (c.user || !cloudEnabled) nav(next, { replace: true }); }, [c.user, nav, next]);
  const guest = () => { setGuest(true); nav(next, { replace: true }); };
  return (
    <div className="login" data-testid="login-page">
      <div className="login__box card">
        <div className="login__brand"><Logo size={40} /> <strong>IELTS Practice</strong></div>
        <p className="login__tag">Luyện đủ 4 kỹ năng <span className="login__ic"><BookOpen size={15} /><Headphones size={15} /><Mic size={15} /><NotebookPen size={15} /><Layers size={15} /></span> – đề thật, chấm tự động, AI chữa Writing/Speaking.</p>
        <LoginForm />
        <div className="login__or"><span>hoặc</span></div>
        <button className="btn btn--ghost login__guest" onClick={guest} data-testid="login-guest">Dùng không cần tài khoản</button>
        <p className="small muted login__note"><Cloud size={14} /> Có tài khoản: kết quả, từ vựng, bộ từ, ghi chú, bài viết tự đồng bộ giữa các máy. Không có: dữ liệu chỉ lưu trong trình duyệt này – đăng nhập sau ở <strong>Cài đặt</strong> vẫn giữ nguyên dữ liệu.</p>
      </div>
      <p className="small muted login__foot"><Link to="/about" onClick={() => setGuest(true)}>Giới thiệu</Link></p>
    </div>
  );
}
