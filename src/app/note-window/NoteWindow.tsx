'use client';

import Notepad from '../../components/tools/Notepad';

// The note, filling the whole page, for the phone app's floating window (which
// does the dragging and resizing). The close button tells the app to close it.
export default function NoteWindow({ initial, savedAt }: { initial: string; savedAt: string | null }) {
  return (
    <>
      <style>{`
        html, body { height: 100%; margin: 0; overflow: hidden; background: transparent; }
        [role="dialog"][aria-label="Note"] {
          left: 0 !important; top: 0 !important;
          width: 100vw !important; height: 100dvh !important;
          min-width: 0 !important; min-height: 0 !important; max-width: none !important; max-height: none !important;
          border-radius: 14px !important; border: none !important; box-shadow: none !important;
          resize: none !important; animation: none !important;
        }
      `}</style>
      <Notepad
        initial={initial}
        savedAt={savedAt}
        onClose={() => (window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView?.postMessage('close')}
      />
    </>
  );
}
