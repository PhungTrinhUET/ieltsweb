import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, RotateCw, Volume2 } from 'lucide-react';
import { getSettings, updateSettings, useSettings } from '../store';
import { fmtTime } from '../lib/text';

const SPEEDS = [0.75, 1, 1.25, 1.5];
let current: HTMLAudioElement | null = null;
export function stopAudio() { current?.pause(); }

export interface AudioHandle {
  /** Phát một đoạn [start, end) giây – dùng cho chép chính tả theo câu. */
  playRange(start: number, end: number): void;
  play(): void;
  pause(): void;
  seek(t: number): void;
  readonly el: HTMLAudioElement | null;
}

const AudioPlayer = forwardRef<AudioHandle, { src: string | null; label?: string; compact?: boolean; tts?: boolean; onEnded?: () => void }>(
  function AudioPlayer({ src, label, compact, tts, onEnded }, ref) {
    const a = useRef<HTMLAudioElement>(null);
    const settings = useSettings();
    const [playing, setPlaying] = useState(false);
    const [cur, setCur] = useState(0);
    const [dur, setDur] = useState(0);
    const [error, setError] = useState(false);
    const stopAt = useRef<number | null>(null);

    useEffect(() => { if (a.current) a.current.playbackRate = settings.speed; }, [settings.speed, src]);
    useEffect(() => () => { if (current === a.current) current = null; }, []);

    const start = () => {
      const el = a.current; if (!el) return;
      if (current && current !== el) current.pause();
      current = el;
      el.playbackRate = getSettings().speed;
      el.play().catch(() => setError(true));
    };
    useImperativeHandle(ref, () => ({
      playRange(s, e) { const el = a.current; if (!el) return; stopAt.current = e; el.currentTime = Math.max(0, s); start(); },
      play() { stopAt.current = null; start(); },
      pause() { a.current?.pause(); },
      seek(t) { if (a.current) a.current.currentTime = t; },
      get el() { return a.current; },
    }));

    if (!src) {
      return (
        <div className="audio audio--missing">
          <Volume2 size={18} />
          <span>{tts ? 'Bài này không có file audio – dùng giọng đọc máy ở phần luyện tập.' : 'Không có audio.'}</span>
        </div>
      );
    }
    const skip = (d: number) => { const el = a.current; if (el) el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + d)); };
    const pct = dur ? (cur / dur) * 100 : 0;
    return (
      <div className={`audio${compact ? ' audio--compact' : ''}`}>
        <audio
          ref={a} src={src} preload="metadata"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); onEnded?.(); }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget; setCur(el.currentTime);
            if (stopAt.current !== null && el.currentTime >= stopAt.current) { el.pause(); stopAt.current = null; }
          }}
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            if (isFinite(el.duration)) return setDur(el.duration);
            el.addEventListener('durationchange', function fix() { if (!isFinite(el.duration)) return; el.removeEventListener('durationchange', fix); setDur(el.duration); el.currentTime = 0; });
            el.currentTime = 1e9;
          }}
          onError={() => setError(true)}
        />
        <button className="audio__play" onClick={() => (playing ? a.current?.pause() : (stopAt.current = null, start()))} disabled={error} aria-label={playing ? 'Tạm dừng' : 'Phát'}>
          {playing ? <Pause size={compact ? 18 : 22} fill="currentColor" /> : <Play size={compact ? 18 : 22} fill="currentColor" />}
        </button>
        <div className="audio__body">
          {label && <div className="audio__label">{label}</div>}
          <input className="audio__seek" type="range" min={0} max={dur || 0} step={0.1} value={cur} style={{ ['--pct' as string]: `${pct}%` }}
            onChange={(e) => { if (a.current) a.current.currentTime = +e.target.value; }} aria-label="Tua" disabled={error} />
          <div className="audio__meta"><span>{error ? 'Không tải được audio' : `${fmtTime(cur)} / ${fmtTime(dur)}`}</span></div>
        </div>
        {!compact && <button className="audio__btn" onClick={() => skip(-5)} aria-label="Lùi 5 giây"><RotateCcw size={18} /></button>}
        {!compact && <button className="audio__btn" onClick={() => skip(5)} aria-label="Tới 5 giây"><RotateCw size={18} /></button>}
        <button className="audio__speed" onClick={() => updateSettings({ speed: SPEEDS[(SPEEDS.indexOf(settings.speed) + 1) % SPEEDS.length] })} title="Tốc độ phát">{settings.speed}×</button>
      </div>
    );
  },
);
export default AudioPlayer;
