import type { Mood } from '../../lib/money/worth';

// The three Worth-It answers as line-drawn faces: loved it, it was fine,
// regret it. Colored by the mood unless a color is given.
const FACE = 'M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19Z';
const PARTS: Record<Mood, string> = {
  love: 'M8 10q1.1-1.6 2.2 0M13.8 10q1.1-1.6 2.2 0M7.8 13.6a4.3 4.3 0 0 0 8.4 0',
  meh: 'M9 10h.01M15 10h.01M8.6 15.2h6.8',
  regret: 'M9 10h.01M15 10h.01M8.2 16.6a4.3 4.3 0 0 1 7.6 0',
};
const COLOR: Record<Mood, string> = { love: '#16a34a', meh: '#d97706', regret: '#dc2626' };

export default function MoodIcon({ mood, size = 20, color }: { mood: Mood; size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color ?? COLOR[mood]} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', verticalAlign: '-0.2em' }}>
      <path d={FACE} />
      <path d={PARTS[mood]} strokeWidth={mood === 'love' ? 1.9 : 2.4} />
    </svg>
  );
}
