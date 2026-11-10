import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { BarChart3, BookOpen, ChevronLeft, ChevronRight, FolderInput, GraduationCap, Headphones, History as HistoryIcon, House, Keyboard, Layers, Mic, NotebookPen, Settings as SettingsIcon } from 'lucide-react';
import { init, useDb } from './db';
import Home from './pages/Home';
import SkillList from './pages/SkillList';
import WritingList from './pages/WritingList';
import ReadingTest from './pages/ReadingTest';
import ReadingStudy from './pages/ReadingStudy';
import ListeningTest from './pages/ListeningTest';
import DictLesson, { DictRedirect } from './pages/DictLesson';
import DictHub from './pages/DictHub';
import GapFill from './pages/GapFill';
import Speaking from './pages/Speaking';
import Writing from './pages/Writing';
import Vocab from './pages/Vocab';
import { VocabContext, VocabLearn, VocabReview } from './pages/VocabSession';
import Library from './pages/Library';
import History from './pages/History';
import HistoryDetail from './pages/HistoryDetail';
import Guide from './pages/Guide';
import Settings from './pages/Settings';
import MockTest from './pages/MockTest';
import Practice from './pages/Practice';
import TestPage from './pages/TestPage';
import Stats from './pages/Stats';

const NAV: { to: string; label: string; icon: typeof House; end?: boolean }[] = [
  { to: '/', label: 'Trang chủ', icon: House, end: true },
  { to: '/reading', label: 'Reading', icon: BookOpen },
  { to: '/listening', label: 'Listening', icon: Headphones },
  { to: '/speaking', label: 'Speaking', icon: Mic },
  { to: '/writing', label: 'Writing', icon: NotebookPen },
  { to: '/vocab', label: 'Từ vựng', icon: Layers },
  { to: '/dictation', label: 'Nghe & chép', icon: Keyboard },
];
const NAV2: { to: string; label: string; icon: typeof House; end?: boolean }[] = [
  { to: '/library', label: 'Tài liệu', icon: FolderInput },
  { to: '/guide', label: 'Cẩm nang', icon: GraduationCap },
  { to: '/stats', label: 'Thống kê', icon: BarChart3 },
  { to: '/history', label: 'Lịch sử', icon: HistoryIcon },
  { to: '/settings', label: 'Cài đặt', icon: SettingsIcon },
];

function Shell() {
  const loc = useLocation();
  const db = useDb();
  const focus = /^\/(reading|listening|speaking|writing|mock|dictation)\/[^/]+|^\/test\/[^/]+\/[^/]+\/full/.test(loc.pathname);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('ielts:nav-collapsed') === '1'; } catch { return false; } });
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem('ielts:nav-collapsed', c ? '0' : '1'); } catch { /* ignore */ } return !c; });
  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);
  useEffect(() => { init(); }, []);
  if (!db.ready) return <div className="boot">Đang mở dữ liệu…</div>;
  return (
    <div className={`app${focus ? ' app--focus' : ''}${collapsed ? ' app--nav-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar__brand"><Logo /> <span>IELTS Practice</span></div>
        <button className="sidebar__toggle" onClick={toggle} aria-label="Thu gọn">{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
        <nav className="sidebar__nav">
          {NAV.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className="sidebar__link" title={label}><Icon size={20} /> <span>{label}</span></NavLink>)}
          <div className="sidebar__sep" />
          {NAV2.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className="sidebar__link" title={label}><Icon size={20} /> <span>{label}</span></NavLink>)}
        </nav>
        <p className="sidebar__foot">Reading · Listening · Speaking · Writing – tự nạp tài liệu, AI chấm bài</p>
      </aside>
      <main className="main"><ErrorBoundary key={loc.pathname}><Outlet /></ErrorBoundary></main>
      <nav className="tabbar">
        {[...NAV.slice(0, 5), NAV2[0]].map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className="tabbar__link"><Icon size={22} /><span>{label}</span></NavLink>)}
      </nav>
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="14" fill="#0f766e" /><path d="M18 20h28M18 32h28M18 44h18" stroke="#fff" strokeWidth="6" strokeLinecap="round" /></svg>;
}

/** Đổi :skill / :tid → dựng lại MockTest từ đầu (không giữ state của skill cũ). */
function MockKeyed() { const { skill, tid } = useParams(); return <MockTest key={`${skill}-${tid ?? ''}`} />; }

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="reading" element={<SkillList skill="reading" />} />
          <Route path="reading/:id" element={<ReadingTest />} />
          <Route path="reading/:id/study" element={<ReadingStudy />} />
          <Route path="reading/:id/practice" element={<Practice />} />
          <Route path="listening" element={<SkillList skill="listening" />} />
          <Route path="listening/:id" element={<ListeningTest />} />
          <Route path="listening/:id/dictation" element={<DictRedirect />} />
          <Route path="listening/:id/gapfill" element={<GapFill />} />
          <Route path="listening/:id/study" element={<ReadingStudy />} />
          <Route path="listening/:id/practice" element={<Practice />} />
          <Route path="speaking" element={<SkillList skill="speaking" />} />
          <Route path="speaking/:id" element={<Speaking />} />
          <Route path="writing" element={<WritingList />} />
          <Route path="writing/:id" element={<Writing />} />
          <Route path="mock/:skill" element={<MockKeyed />} />
          <Route path="test/:skill/:tid" element={<TestPage />} />
          <Route path="test/:skill/:tid/full" element={<MockKeyed />} />
          <Route path="vocab" element={<Vocab />} />
          <Route path="vocab/learn" element={<VocabLearn />} />
          <Route path="vocab/review" element={<VocabReview />} />
          <Route path="vocab/context" element={<VocabContext />} />
          <Route path="stats" element={<Stats />} />
          <Route path="dictation" element={<DictHub />} />
          <Route path="dictation/:lid" element={<DictLesson />} />
          <Route path="library" element={<Library />} />
          <Route path="history" element={<History />} />
          <Route path="history/:aid" element={<HistoryDetail />} />
          <Route path="guide" element={<Guide />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
