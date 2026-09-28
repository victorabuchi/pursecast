'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './app.module.css';
import I from './Icon';
import Submit from './Submit';
import { CloseButton } from './Sheet';
import { createNoteAction } from '../../lib/money/note-actions';

const MAX_SECONDS = 60;

// Text plus an optional voice recording, kept as a data: URL.
export default function NoteForm({ categories, today }: { categories: Array<{ id: string; name: string }>; today: string }) {
  const [audio, setAudio] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const stop = () => {
    if (timer.current) window.clearInterval(timer.current);
    recorder.current?.stop();
    setRecording(false);
  };

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const reader = new FileReader();
        reader.onload = () => setAudio(String(reader.result));
        reader.readAsDataURL(new Blob(chunks, { type: rec.mimeType }));
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setRecording(true);
      timer.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError('Pursecast could not use the microphone. Allow it in your browser, or write the note instead.');
    }
  };

  return (
    <form action={createNoteAction} className={styles.form}>
      <label className={styles.whatIf}>
        <small>Dear future me…</small>
        <input name="text" placeholder="You're saving for Japan. Is this worth 2 days there?" required maxLength={280} autoFocus autoComplete="off" />
      </label>

      <div className={styles.field}>
        Say it in your own voice
        <small>Optional. Up to a minute. It plays back with the note.</small>
        <div className={styles.row} style={{ alignItems: 'center' }}>
          {recording ? (
            <button type="button" className={styles.btnDanger} onClick={stop}>
              <span className={styles.recDot} /> Stop · {MAX_SECONDS - seconds}s left
            </button>
          ) : (
            <button type="button" className={styles.btnGhost} onClick={start}>
              <I d="mic" size={16} /> {audio ? 'Record again' : 'Record'}
            </button>
          )}
          {audio && !recording && (
            <>
              <audio src={audio} controls style={{ flex: '2 1 200px', height: 40 }} />
              <button type="button" className={styles.xBtn} aria-label="Remove recording" onClick={() => setAudio('')}>
                <I d="x" size={14} />
              </button>
            </>
          )}
        </div>
        {error && <small className={styles.neg}>{error}</small>}
      </div>
      <input type="hidden" name="audio" value={audio} />

      <div className={styles.row}>
        <label className={styles.field}>
          Play it before spending on
          <select name="categoryId" className={styles.select} defaultValue="">
            <option value="">Anything I tend to regret</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Until <small>optional, like the day of your trip</small>
          <input className={styles.input} type="date" name="until" min={today} />
        </label>
      </div>

      <div className={styles.sheetActions}>
        <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
        <Submit className={styles.btn} pending="Saving…">
          Save note
        </Submit>
      </div>
    </form>
  );
}
