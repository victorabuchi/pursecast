// Photos live in the database as small data: URLs. Pages link to them as
// images (/api/photo/...), versioned by a short hash of the picture, so the
// page stays light and the browser caches each picture until it changes.
export type PhotoKind = 'user' | 'wish' | 'debt';

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 7) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + s.length.toString(36);
}

export function photoUrl(kind: PhotoKind, id: string, data: string | null | undefined): string | null {
  return data ? `/api/photo/${kind}/${id}?v=${hash(data)}` : null;
}
