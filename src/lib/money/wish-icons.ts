// Picks an icon for a wish-list item from its name, so a sweater gets a shirt
// and a laptop gets a laptop. First match wins; a bag when nothing fits.

export type WishIcon = 'shirt' | 'shoe' | 'laptop' | 'phone' | 'headphones' | 'plane' | 'sofa' | 'bike' | 'car' | 'watch' | 'book' | 'game' | 'sparkle' | 'gift' | 'camera' | 'bag';

const RULES: Array<[RegExp, WishIcon]> = [
  [/sneaker|shoe|boot|trainer|heel|sandal|loafer|kengä|saappa/i, 'shoe'],
  [/sweater|hoodie|flannel|shirt|jacket|coat|jeans|trouser|pants|dress|skirt|jumper|cardigan|blazer|suit|parka|vest|knit|tee\b|t-shirt|top\b|acne|zara|h&m|cos\b|uniqlo|arket|takki|paita|housut|villapaita|huppari|mekko/i, 'shirt'],
  [/headphone|airpods|earbud|earphone|buds|kuuloke|speaker|sonos/i, 'headphones'],
  [/laptop|macbook|computer|notebook pc|\bpc\b|monitor|ipad|tablet|kannettava|tietokone/i, 'laptop'],
  [/iphone|phone|pixel|galaxy|puhelin/i, 'phone'],
  [/camera|lens|gopro|kamera/i, 'camera'],
  [/watch|jewel|ring|necklace|bracelet|earring|kello|koru/i, 'watch'],
  [/flight|trip|holiday|vacation|travel|hotel|weekend in|tallinn|matka|loma|lento/i, 'plane'],
  [/sofa|couch|chair|table|desk|bed|lamp|rug|shelf|ikea|furniture|sohva|tuoli|pöytä|sänky/i, 'sofa'],
  [/bike|bicycle|scooter|pyörä/i, 'bike'],
  [/\bcar\b|tesla|tyre|tire|auto\b/i, 'car'],
  [/book|kindle|kirja/i, 'book'],
  [/playstation|\bps5\b|xbox|nintendo|switch|game|steam|peli/i, 'game'],
  [/perfume|cream|serum|makeup|skincare|lipstick|hair|beauty|hajuvesi|meikki/i, 'sparkle'],
  [/gift|present|lahja|birthday/i, 'gift'],
];

export function wishIcon(name: string): WishIcon {
  return RULES.find(([re]) => re.test(name))?.[1] ?? 'bag';
}

// Stroke paths (24 x 24) for the icons above.
export const WISH_PATHS: Record<WishIcon, string> = {
  shirt: 'M8 3 4 5.5 2 10l3 1.5V21h14v-9.5l3-1.5-2-4.5L16 3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3Z',
  shoe: 'M3 17v-5l3-1 2-5h3l1 4 5 2 4 1.5a2 2 0 0 1 1 1.7V17ZM3 17h19M7 11l1.5 1M10 10l1.5 1',
  laptop: 'M4 5h16v10H4ZM2 19h20M9.5 19l.5-1h4l.5 1',
  phone: 'M7 2.5h10a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V4A1.5 1.5 0 0 1 7 2.5ZM11 18h2',
  headphones: 'M3 17v-4a9 9 0 0 1 18 0v4M3 14h3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1ZM21 14h-3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1Z',
  plane: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z',
  sofa: 'M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2M2 11a2 2 0 0 1 4 0v3h12v-3a2 2 0 0 1 4 0v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2ZM5 18v2M19 18v2',
  bike: 'M5.5 17.5a3.5 3.5 0 1 0 0-.01ZM18.5 17.5a3.5 3.5 0 1 0 0-.01ZM15 6h2l1.5 11.5M5.5 17.5 9 10h7M12 17.5 9 10',
  car: 'M5 17H3v-4l2-5h14l2 5v4h-2M5 13h14M7 17a2 2 0 1 0 0 .01M17 17a2 2 0 1 0 0 .01M9 17h6',
  watch: 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM12 9v3l1.5 1.5M9 6l.5-3.5h5L15 6M9 18l.5 3.5h5L15 18',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  game: 'M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-4 3.6l-.7 6.3a3 3 0 0 0 5.4 2L9 15h6l1.6 1.9a3 3 0 0 0 5.4-2l-.7-6.3A4 4 0 0 0 17.3 5Z',
  sparkle: 'M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z',
  gift: 'M20 12v10H4V12M2 7h20v5H2ZM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z',
  camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3ZM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0',
};

// A photo as a data: URL small enough to keep in the database.
export const MAX_PHOTO_CHARS = 400_000;
export function validPhoto(v: string): boolean {
  return v.length <= MAX_PHOTO_CHARS && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
}

// The photo field of a form: a new picture, a request to remove it, or no
// change (nothing to update).
export function photoChange(formData: FormData): { photo?: string | null } {
  const photo = String(formData.get('photo') ?? '');
  if (photo && validPhoto(photo)) return { photo };
  if (formData.get('photoClear')) return { photo: null };
  return {};
}
