// Bắt lỗi render của một trang: hiện thông báo + nút Tải lại / Về trang chủ thay vì trắng trang.
import { Component, type ReactNode } from 'react';
import { AlertTriangle, House, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.warn('Lỗi hiển thị trang:', error); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="page crash" role="alert">
        <AlertTriangle size={36} className="crash__icon" />
        <h1>Trang này gặp lỗi</h1>
        <p className="muted">Bài làm đang dở ở trang này có thể chưa được lưu. Dữ liệu khác (lịch sử, sổ từ, nháp Writing) vẫn còn nguyên.</p>
        <pre className="crash__msg">{error.message}</pre>
        <div className="row wrap">
          <button className="btn btn--primary" onClick={() => location.reload()}><RotateCcw size={16} /> Tải lại</button>
          <a className="btn btn--ghost" href="#/" onClick={() => this.setState({ error: null })}><House size={16} /> Về trang chủ</a>
        </div>
      </div>
    );
  }
}
