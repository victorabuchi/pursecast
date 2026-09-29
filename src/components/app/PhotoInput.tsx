'use client';

import { useRef, useState } from 'react';
import styles from './app.module.css';
import I from './Icon';

const MAX_SIDE = 480;

// Shrinks a picked photo in the browser to a small JPEG, so uploads are quick
// and the database stays light. Posts `photo` (a data: URL, or empty) and
// `photoClear` when an existing photo was removed.
export default function PhotoInput({ current, label = 'Photo', round, max = MAX_SIDE }: { current?: string | null; label?: string; round?: boolean; max?: number }) {
  const [photo, setPhoto] = useState(current ?? '');
  const [cleared, setCleared] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose a picture.');
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      setPhoto(canvas.toDataURL('image/jpeg', 0.82));
      setCleared(false);
    } catch {
      setError('That picture could not be read. Try a JPG or PNG.');
    }
  };

  return (
    <div className={styles.field}>
      {label}
      <div className={styles.photoRow}>
        <button type="button" className={`${styles.photoBox} ${round ? styles.photoRound : ''}`} onClick={() => input.current?.click()} aria-label={photo ? 'Change photo' : 'Add a photo'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img src={photo} alt="" /> : <I d="camera" size={20} />}
        </button>
        <span className={styles.stack} style={{ gap: 4 }}>
          <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} onClick={() => input.current?.click()}>
            {photo ? 'Change photo' : 'Add a photo'}
          </button>
          {photo && (
            <button
              type="button"
              className={styles.linkBtn}
              style={{ color: 'var(--muted)', fontSize: 12.5, fontWeight: 600 }}
              onClick={() => {
                setPhoto('');
                setCleared(true);
              }}
            >
              Remove
            </button>
          )}
        </span>
      </div>
      {error && <small className={styles.neg}>{error}</small>}
      <input ref={input} type="file" accept="image/*" className={styles.visuallyHidden} onChange={(e) => void pick(e.target.files?.[0])} />
      <input type="hidden" name="photo" value={photo.startsWith('data:') && photo !== current ? photo : ''} />
      {cleared && <input type="hidden" name="photoClear" value="1" />}
    </div>
  );
}
