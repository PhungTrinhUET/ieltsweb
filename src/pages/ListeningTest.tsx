import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpenCheck, Check, GraduationCap, Keyboard, Pause, PenLine, Play, RotateCcw, Volume2 } from 'lucide-react';
import type { ListeningMaterial } from '../types';
import { addAttempt, resolveUrl, useDb } from '../db';
import { getSettings, setLastOpen, touchStreak } from '../store';
import AudioPlayer, { stopAudio, type AudioHandle } from '../components/AudioPlayer';
import { GroupsView, scoreGroups, type Answers } from '../components/Questions';
import { rawToBand, fmtBand } from '../lib/band';
import { speak, stopSpeak, ttsAvailable, speakerVoices } from '../lib/tts';
import { SKILL_META } from './SkillList';
import { parseId, saveMode } from '../lib/tests';
import Timer from '../components/Timer';

/** Một section: ~7–8 phút audio + thời gian kiểm tra. */
const SECTION_MINUTES = 10;
import { RichText } from '../components/ui';

/** Đọc cả kịch bản bằng giọng máy, đổi giọng theo người nói nếu có nhiều giọng. */
export function useScriptSpeaker(m: ListeningMaterial | undefined) {
  const [line, setLine] = useState<number | null>(null);
  const stop = useRef(false);
  const lines = useMemo(() => (m ? m.transcript.split('\n').map((l) => l.trim()).filter(Boolean) : []), [m]);
  const play = async (from = 0) => {
    stop.current = false;
    const st = getSettings();
    const narrator = st.ttsVoice;
    const voices = st.ttsOneVoice ? [] : speakerVoices(narrator);
    const speakers = new Map<string, string>();
    for (let i = from; i < lines.length; i++) {
      if (stop.current) break;
      setLine(i);
      const sm = lines[i].match(/^([A-Z][A-Za-z ]{0,20}):\s*/);
      // Người dẫn (Narrator/Announcer) và dòng không tên: giọng chọn trong Cài đặt; nhân vật khác xoay vòng giọng tốt.
      let voice = narrator;
      if (sm && voices.length && !/^(narrator|announcer|presenter)$/i.test(sm[1].trim())) {
        if (!speakers.has(sm[1])) speakers.set(sm[1], voices[speakers.size % voices.length]);
        voice = speakers.get(sm[1])!;
      }
      await speak(sm ? lines[i].slice(sm[0].length) : lines[i], { voice });
    }
    setLine(null);
  };
  const halt = () => { stop.current = true; stopSpeak(); setLine(null); };
  useEffect(() => () => halt(), []); // eslint-disable-line
  return { line, play, halt, lines };
}

export default function ListeningTest() {
  const { id } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const m = db.materials[id!] as ListeningMaterial | undefined;
  const [answers, setAnswers] = useState<Answers>({});
  const [checked, setChecked] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [showScript, setShowScript] = useState(false);
  const audio = useRef<AudioHandle>(null);
  const sp = useScriptSpeaker(m);
  useEffect(() => { if (m) { setLastOpen(m.id, `/listening/${m.id}`, 'test'); saveMode('listening', 'test'); } setAnswers({}); setChecked(false); setShowScript(false); if (m?.audio) resolveUrl(m.audio).then(setSrc); else setSrc(null); return () => stopAudio(); }, [id]); // eslint-disable-line

  if (!m) return <div className="page"><p className="empty">Không tìm thấy bài.</p></div>;
  const hasScript = !!m.transcript.trim();
  const total = m.groups.reduce((n, g) => n + g.questions.length, 0);
  const done = Object.values(answers).filter((a) => a !== null && a !== '' && !(Array.isArray(a) && !a.length)).length;
  const res = checked ? scoreGroups(m.groups, answers) : null;
  const band = res ? rawToBand('listening', res.score, res.max) : null;
  const submit = async () => {
    const r = scoreGroups(m.groups, answers);
    setChecked(true); sp.halt(); stopAudio(); touchStreak();
    await addAttempt({ materialId: m.id, skill: 'listening', title: m.title, mode: 'test', score: r.score, max: r.max, band: rawToBand('listening', r.score, r.max), detail: { answers, wrong: r.wrong } });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="page page--practice" style={{ ['--skill' as string]: SKILL_META.listening.color }}>
      <div className="topbar topbar--sticky">
        <button className="icon-btn" onClick={() => nav(parseId(m.id) ? `/test/listening/${parseId(m.id)!.key}` : '/listening')} aria-label="Quay lại"><ArrowLeft size={20} /></button>
        <div className="topbar__title"><small>Thi thử · Listening · Section {m.section ?? '?'}</small><strong>{m.title}</strong></div>
        <div className="topbar__actions">{!checked && <Link to={`/listening/${m.id}/practice`} className="btn btn--ghost btn--sm mode-switch" title="Chuyển sang Luyện tập: không tính giờ, xem đáp án từng câu" onClick={(e) => { if (done > 0 && !confirm('Chuyển sang Luyện tập? Các câu đã làm ở bài thi này sẽ không được lưu.')) e.preventDefault(); }}><GraduationCap size={15} /> <span>Luyện tập</span></Link>}{!checked && <Timer key={m.id} minutes={SECTION_MINUTES} warnAt={120} onEnd={submit} autoStart />}</div>
        <div className="topbar__progress" style={{ width: `${(done / total) * 100}%` }} />
      </div>

      {m.audio ? <AudioPlayer ref={audio} src={src} label={m.title} /> : !hasScript ? <div className="banner"><span>Đề này chưa có audio và bộ đề gốc không có transcript, nên chưa nghe được. Bạn vẫn có thể làm câu hỏi (đáp án theo key gốc).</span></div> : (
        <div className="audio">
          <button className="audio__play" onClick={() => (sp.line === null ? sp.play() : sp.halt())} disabled={!ttsAvailable()} aria-label="Phát">{sp.line === null ? <Play size={22} fill="currentColor" /> : <Pause size={22} fill="currentColor" />}</button>
          <div className="audio__body">
            <div className="audio__label">Giọng đọc máy (không có file audio)</div>
            <div className="audio__meta"><span>{sp.line === null ? `${sp.lines.length} lượt lời` : `Đang đọc dòng ${sp.line + 1}/${sp.lines.length}`}</span>{!ttsAvailable() && <span className="no-text">Trình duyệt không hỗ trợ TTS</span>}</div>
          </div>
          <Volume2 size={18} className="muted" />
        </div>
      )}
      {!checked && <p className="muted small">Như thi thật: nghe một lần, vừa nghe vừa điền. Sau khi nộp bài có transcript, giải thích và các chế độ luyện sâu.</p>}

      {checked && res && (
        <div className="final card">
          <div className="final__head">
            <div><strong style={{ fontSize: 28 }}>{res.score}/{res.max}</strong><div className="muted small">câu đúng</div></div>
            <div><strong style={{ fontSize: 28 }}>Band {fmtBand(band)}</strong><div className="muted small">ước tính</div></div>
            <div className="final__next"><button className="btn btn--ghost btn--sm" onClick={() => { setAnswers({}); setChecked(false); }}><RotateCcw size={15} /> Làm lại</button></div>
          </div>
          {hasScript ? <div className="row wrap">
            <Link to={`/listening/${m.id}/practice`} className="btn btn--primary btn--sm"><GraduationCap size={15} /> Luyện tập bài này</Link>
            <Link to={`/listening/${m.id}/dictation`} className="btn btn--ghost btn--sm"><Keyboard size={15} /> Chép chính tả</Link>
            <Link to={`/listening/${m.id}/gapfill`} className="btn btn--ghost btn--sm"><PenLine size={15} /> Điền từ transcript</Link>
            <Link to={`/listening/${m.id}/study`} className="btn btn--ghost btn--sm"><BookOpenCheck size={15} /> Học transcript (dịch, từ vựng)</Link>
            <button className="btn btn--text btn--sm" onClick={() => setShowScript(!showScript)}>{showScript ? 'Ẩn transcript' : 'Xem transcript'}</button>
          </div> : <div className="row wrap"><Link to={`/listening/${m.id}/practice`} className="btn btn--primary btn--sm"><GraduationCap size={15} /> Xem lại từng câu ở chế độ Luyện tập</Link></div>}
          {showScript && <div className="rich rich--transcript"><RichText text={m.transcript.split('\n').join('\n')} /></div>}
        </div>
      )}

      <GroupsView groups={m.groups} note={m.note} answers={answers} onChange={(no, a) => setAnswers((s) => ({ ...s, [no]: a }))} checked={checked} />

      {!checked && (
        <div className="actionbar"><div className="actionbar__inner">
          <span className="result">{done}/{total} câu đã trả lời</span>
          <button className="btn btn--primary" onClick={submit}><Check size={18} /> Nộp bài</button>
        </div></div>
      )}
    </div>
  );
}
