// Ghi âm (MediaRecorder) + nhận dạng giọng nói trực tiếp (Web Speech API – Chrome/Edge/Safari).
import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { fmtTime } from '../lib/text';

type SR = typeof window extends { SpeechRecognition: infer T } ? T : never;
const getSR = (): (new () => SpeechRecognition) | null => (window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: SR }).webkitSpeechRecognition ?? null;
export const speechRecognitionAvailable = () => !!getSR();

export interface Recording { url: string; blob: Blob; seconds: number; transcript: string }

export default function Recorder({ onDone, maxSeconds, autoStart, label }: { onDone: (r: Recording) => void; maxSeconds?: number; autoStart?: boolean; label?: string }) {
  const [rec, setRec] = useState(false);
  const [sec, setSec] = useState(0);
  const [live, setLive] = useState('');
  const [err, setErr] = useState('');
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const sr = useRef<SpeechRecognition | null>(null);
  const finalText = useRef('');
  const timer = useRef(0);
  const startedAt = useRef(0);

  const stop = () => {
    mr.current?.state !== 'inactive' && mr.current?.stop();
    try { sr.current?.stop(); } catch { /* ignore */ }
    window.clearInterval(timer.current);
    setRec(false);
  };

  const start = async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = new MediaRecorder(stream);
      chunks.current = [];
      finalText.current = '';
      setLive('');
      m.ondataavailable = (e) => chunks.current.push(e.data);
      m.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: m.mimeType || 'audio/webm' });
        onDone({ url: URL.createObjectURL(blob), blob, seconds: Math.round((Date.now() - startedAt.current) / 1000), transcript: finalText.current.trim() });
      };
      mr.current = m;
      m.start(250);
      startedAt.current = Date.now();
      setSec(0);
      setRec(true);
      timer.current = window.setInterval(() => {
        const s = Math.round((Date.now() - startedAt.current) / 1000);
        setSec(s);
        if (maxSeconds && s >= maxSeconds) stop();
      }, 500);
      const SRC = getSR();
      if (SRC) {
        const r = new SRC();
        r.lang = 'en-US'; r.continuous = true; r.interimResults = true;
        r.onresult = (e: SpeechRecognitionEvent) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalText.current += t + ' '; else interim += t;
          }
          setLive(finalText.current + interim);
        };
        r.onend = () => { if (mr.current?.state === 'recording') { try { r.start(); } catch { /* ignore */ } } };
        try { r.start(); } catch { /* ignore */ }
        sr.current = r;
      }
    } catch (e) {
      setErr('Không truy cập được micro. Hãy cho phép quyền micro trong trình duyệt.');
      console.error(e);
    }
  };

  useEffect(() => { if (autoStart) start(); return () => { window.clearInterval(timer.current); try { sr.current?.stop(); } catch { /* ignore */ } if (mr.current?.state === 'recording') mr.current.stop(); }; }, []); // eslint-disable-line

  return (
    <div className={`rec${rec ? ' is-rec' : ''}`}>
      <button className={`rec__btn${rec ? ' is-rec' : ''}`} onClick={rec ? stop : start} aria-label={rec ? 'Dừng' : 'Ghi âm'}>
        {rec ? <Square size={22} fill="currentColor" /> : <Mic size={24} />}
      </button>
      <div className="rec__body">
        <div className="rec__status">
          {rec ? <><span className="rec__dot" /> Đang ghi {fmtTime(sec)}{maxSeconds ? ` / ${fmtTime(maxSeconds)}` : ''}</> : label ?? 'Bấm để ghi âm câu trả lời'}
        </div>
        {rec && (live ? <div className="rec__live">{live}</div> : speechRecognitionAvailable() ? <div className="rec__live muted">Đang nghe…</div> : <div className="rec__live muted">Trình duyệt không hỗ trợ nhận dạng giọng nói – sau khi ghi, bạn có thể gõ lại transcript để AI chấm.</div>)}
        {err && <div className="no-text small">{err}</div>}
      </div>
    </div>
  );
}
