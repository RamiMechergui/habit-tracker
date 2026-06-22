import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Play, Trash2 } from 'lucide-react';

export default function VoiceRecorder({ word }) {
  const [state, setState] = useState('idle');
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const timer = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timer.current) clearInterval(timer.current);
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorder.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: mime });
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState('done');
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setState('recording');
      setDuration(0);
      const start = Date.now();
      timer.current = setInterval(() => setDuration(Math.floor((Date.now() - start) / 1000)), 200);
    } catch {
      setState('idle');
    }
  }, [audioUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
      if (timer.current) clearInterval(timer.current);
    }
  }, []);

  const clearRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    setPlaying(false);
    setState('idle');
  }, [audioUrl]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
      audioRef.current.onended = () => setPlaying(false);
    }
  }, [playing, audioUrl]);

  if (state === 'recording') {
    return (
      <button onClick={stopRecording} title="Stop recording" style={{
        background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626',
        padding: 2, display: 'inline-flex', position: 'relative',
      }}>
        <Square size={13} />
        <span style={{
          position: 'absolute', top: -6, right: -10, fontSize: '0.6rem',
          fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums',
        }}>{duration}s</span>
      </button>
    );
  }

  if (state === 'done' && audioUrl) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 1 }}>
        <audio ref={audioRef} src={audioUrl} />
        <button onClick={togglePlay} title={playing ? 'Stop' : 'Play your recording'} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: playing ? '#10b981' : 'var(--text-primary)', padding: 2, display: 'inline-flex', opacity: 0.7,
        }}>
          <Play size={13} />
        </button>
        <button onClick={clearRecording} title="Delete recording" style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'inline-flex', opacity: 0.5,
        }}>
          <Trash2 size={11} />
        </button>
      </span>
    );
  }

  return (
    <button onClick={startRecording} title={`Record "${word || ''}"`} style={{
      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
      padding: 2, display: 'inline-flex', opacity: 0.5, transition: 'opacity 0.2s', marginLeft: 1,
    }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
      <Mic size={13} />
    </button>
  );
}
