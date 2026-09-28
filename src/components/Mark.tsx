// The Pursecast mark: a sun rising over a horizon line.
export default function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M6 15a6 6 0 0 1 12 0" fill="none" stroke="#f5a524" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M3 18.5h18" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12 3.5v2.5M5.2 6.8l1.6 1.6M18.8 6.8l-1.6 1.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
