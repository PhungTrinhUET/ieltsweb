import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ListeningMaterial } from '../types';
import { useDb } from '../db';
import { getSettings, setLastOpen } from '../store';
import { speak, stopSpeak, speakerVoices } from '../lib/tts';
import { parseId, saveMode } from '../lib/tests';
import { ExamRunner } from './MockTest';

/** Đọc các dòng transcript bằng giọng máy; đổi giọng theo người nói nếu có nhiều giọng. Dừng khi `stopped()` trả true. */
export async function speakLines(lines: string[], stopped: () => boolean, onLine?: (i: number) => void, from = 0) {
  const st = getSettings();
  const narrator = st.ttsVoice;
  const voices = st.ttsOneVoice ? [] : speakerVoices(narrator);
  const speakers = new Map<string, string>();
  for (let i = from; i < lines.length; i++) {
    if (stopped()) break;
    onLine?.(i);
    const sm = lines[i].match(/^([A-Z][A-Za-z ]{0,20}):\s*/);
    // Người dẫn (Narrator/Announcer) và dòng không tên: giọng chọn trong Cài đặt; nhân vật khác xoay vòng giọng tốt.
    let voice = narrator;
    if (sm && voices.length && !/^(narrator|announcer|presenter)$/i.test(sm[1].trim())) {
      if (!speakers.has(sm[1])) speakers.set(sm[1], voices[speakers.size % voices.length]);
      voice = speakers.get(sm[1])!;
    }
    await speak(sm ? lines[i].slice(sm[0].length) : lines[i], { voice });
  }
}

/** Đọc cả kịch bản bằng giọng máy, đổi giọng theo người nói nếu có nhiều giọng. */
export function useScriptSpeaker(m: ListeningMaterial | undefined) {
  const [line, setLine] = useState<number | null>(null);
  const stop = useRef(false);
  const lines = useMemo(() => (m ? m.transcript.split('\n').map((l) => l.trim()).filter(Boolean) : []), [m]);
  const play = async (from = 0) => {
    stop.current = false;
    await speakLines(lines, () => stop.current, setLine, from);
    setLine(null);
  };
  const halt = () => { stop.current = true; stopSpeak(); setLine(null); };
  useEffect(() => () => halt(), []); // eslint-disable-line
  return { line, play, halt, lines };
}

/** Thi thử một section (route /listening/:id): khung máy thi, audio phát một lần ngay khi vào, 2 phút kiểm tra rồi tự nộp. */
export default function ListeningTest() {
  const { id } = useParams();
  const db = useDb();
  const m = db.materials[id!] as ListeningMaterial | undefined;
  useEffect(() => { if (m) { setLastOpen(m.id, `/listening/${m.id}`, 'test'); saveMode('listening', 'test'); } }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m || m.skill !== 'listening') return <div className="page"><p className="empty">Không tìm thấy bài.</p></div>;
  const t = parseId(m.id);
  return <ExamRunner key={m.id} skill="listening" ids={[m.id]} name={m.title} back={t ? `/test/listening/${t.key}` : '/listening'} />;
}
