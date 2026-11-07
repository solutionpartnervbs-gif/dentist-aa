/** Escapes a value for CSV and neutralises spreadsheet formula injection. */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** "13:00" -> "1:00 PM" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "2026-11-11" -> "Wednesday, Nov 11, 2026" (parsed as a calendar date, never shifted by timezone) */
export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Today's date (YYYY-MM-DD) in Manila, plus n days. */
export function manilaDate(plusDays = 0, now: Date = new Date()): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + plusDays)).toISOString().slice(0, 10);
}

export const PH_MOBILE = /^(?:\+?63|0)9\d{9}$/;
export const isPhMobile = (v: string) => PH_MOBILE.test(v.replace(/[\s()-]/g, ''));

export type Spot = 'br' | 'bl' | 'ml' | 'mr';
const EDGE = 16;
const CONTENT_MAX = 1180; // matches --maxw

/**
 * Where the roaming icon sits for a named spot, as top-left pixel coordinates inside the viewport.
 * 'ml'/'mr' use the empty gutters beside the centred content when they are wide enough, otherwise fall back to the
 * bottom corners, so the icon never covers text or the booking form on narrow screens.
 */
export function mascotSpot(spot: Spot, vw: number, vh: number, size: number): { x: number; y: number } {
  const gutter = (vw - CONTENT_MAX) / 2;
  const roomy = gutter >= size + EDGE * 2;
  const bottom = Math.max(EDGE, vh - size - EDGE - 8);
  const right = vw - size - EDGE;
  switch (spot) {
    case 'bl':
      return { x: EDGE, y: bottom };
    case 'ml':
      return roomy ? { x: Math.round((gutter - size) / 2), y: Math.round(vh * 0.5 - size / 2) } : { x: EDGE, y: bottom };
    case 'mr':
      return roomy ? { x: Math.round(vw - gutter + (gutter - size) / 2), y: Math.round(vh * 0.42 - size / 2) } : { x: right, y: bottom };
    default:
      return { x: right, y: bottom };
  }
}
