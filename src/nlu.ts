/**
 * Small, dependency-free natural-language helpers for the receptionist chat.
 * Built for spoken input: "next Monday at two PM", "my name is Ana Reyes", "zero nine one seven ...".
 * All date logic takes `today` (YYYY-MM-DD, Asia/Manila) so it is deterministic and testable.
 */

const MS_DAY = 86_400_000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', o: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

const pad = (n: number) => String(n).padStart(2, '0');

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * MS_DAY).toISOString().slice(0, 10);
}
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function validIso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Resolve a date phrase to YYYY-MM-DD, or null. Plain weekday = soonest upcoming; "next <weekday>" skips into next week. */
export function parseDate(text: string, today: string): string | null {
  const t = text.toLowerCase();
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return validIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  if (/\bday after tomorrow\b/.test(t)) return addDays(today, 2);
  if (/\btomorrow\b|\btomorow\b/.test(t)) return addDays(today, 1);
  if (/\b(today|tonight)\b/.test(t)) return today;

  const wd = t.match(/\b(next|this|on)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2]);
    const diff = (target - weekdayOf(today) + 7) % 7 || 7; // strictly after today
    let date = addDays(today, diff);
    if (wd[1] === 'next') {
      // "next Friday" said on a Monday means next week's Friday, not this coming one
      const daysSinceMonday = (weekdayOf(today) + 6) % 7;
      if (diff <= 6 - daysSinceMonday) date = addDays(date, 7);
    }
    return date;
  }

  const monthRe = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const md = t.match(new RegExp(`\\b${monthRe}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`));
  const dm = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthRe}\\.?(?:,?\\s+(\\d{4}))?\\b`));
  const m = md ? { mon: md[1], day: md[2], year: md[3] } : dm ? { mon: dm[2], day: dm[1], year: dm[3] } : null;
  if (m) {
    const month = MONTHS.indexOf(m.mon.slice(0, 3)) + 1;
    const [ty] = today.split('-').map(Number);
    if (m.year) return validIso(Number(m.year), month, Number(m.day));
    const thisYear = validIso(ty, month, Number(m.day));
    if (thisYear && thisYear >= today) return thisYear;
    return validIso(ty + 1, month, Number(m.day));
  }
  return null;
}

/** All explicit ISO dates in the text (used for reschedule "from X to Y"). */
export function allIsoDates(text: string): string[] {
  return [...text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)]
    .map((m) => validIso(Number(m[1]), Number(m[2]), Number(m[3])))
    .filter((d): d is string => !!d);
}

/** "2pm", "2:30 p.m.", "two o'clock in the afternoon", "noon", "14:00", "at 10" -> HH:MM (24h) or null. */
export function parseTime(text: string): string | null {
  const t = text.toLowerCase();
  const h24 = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]\.?m)/);
  const ampm = t.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([ap])\.?\s*m\b\.?/);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (ampm[3] === 'p') h += 12;
    return `${pad(h)}:${ampm[2] ?? '00'}`;
  }
  if (h24) return `${pad(Number(h24[1]))}:${h24[2]}`;
  if (/\bnoon\b/.test(t)) return '12:00';
  const words = t.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+o'?clock)?\s*(?:in the\s+)?(am|pm|morning|afternoon|evening)?\b/);
  if (words && (words[2] || /o'?clock/.test(words[0]))) {
    let h = NUM_WORDS[words[1]] % 12;
    const pm = words[2] ? words[2] !== 'am' && words[2] !== 'morning' : NUM_WORDS[words[1]] >= 1 && NUM_WORDS[words[1]] <= 6;
    if (pm) h += 12;
    return `${pad(h)}:00`;
  }
  const bare = t.match(/\bat\s+(1[0-2]|[1-9])\b(?!\s*[:\d])/);
  if (bare) {
    const n = Number(bare[1]);
    const h = n === 12 ? 12 : n >= 9 && n <= 11 ? n : n >= 1 && n <= 6 ? n + 12 : n; // clinic hours: 9-11 morning, 12-6 afternoon
    return `${pad(h)}:00`;
  }
  return null;
}

/** Digits, or spoken digits ("zero nine one seven ..."). Returns a normalised number string or null. */
export function parsePhone(text: string): string | null {
  const spoken = text.replace(
    /\b((?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)[\s,.-]*){7,13})\b/gi,
    (seq) => seq.toLowerCase().split(/[\s,.-]+/).filter(Boolean).map((w) => DIGIT_WORDS[w] ?? '').join(''),
  );
  const scrubbed = spoken
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, ' ');
  const m = scrubbed.match(/\+?\d[\d\s-]{6,14}\d/);
  const digits = m ? m[0].replace(/[\s-]/g, '') : null;
  return digits && digits.replace(/\D/g, '').length >= 7 ? digits : null;
}

const NAME_STOP = '(?:\\s+(?:and|my|phone|number|mobile|email|for|on|at|tomorrow|today)\\b|[,.;0-9@]|$)';
/** "my name is Ana Reyes", "I'm Ana", "this is Ana", "name: Ana". Returns a capitalised name or null. */
export function parseName(text: string): string | null {
  const m =
    text.match(new RegExp(`\\b(?:my name is|name is|name's|i am|i'm|this is|call me|name)\\s*[:\\-]?\\s*([A-Za-z][A-Za-z .'-]{0,40}?)${NAME_STOP}`, 'i'));
  if (!m) return null;
  const name = m[1].trim().replace(/\s+/g, ' ');
  if (!name || /^(a|an|the|looking|calling|here|just|interested|booking|trying|not)\b/i.test(name)) return null;
  return name.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** When the bot just asked for a name, a short letters-only reply is the name. */
export function looksLikeBareName(text: string): string | null {
  const t = text.trim().replace(/[.!]$/, '');
  if (!/^[A-Za-z][A-Za-z .'-]{1,40}$/.test(t)) return null;
  const words = t.split(/\s+/);
  if (words.length > 4) return null;
  if (/\b(yes|no|yeah|nope|cancel|book|slots?|help|hello|hi|hours?|receipt|please|thanks?)\b/i.test(t)) return null;
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

export type ServiceName =
  | 'cleaning' | 'checkup' | 'filling' | 'braces' | 'whitening' | 'extraction' | 'root canal' | 'denture' | 'consultation' | 'urgent dental concern';
const SERVICE_PATTERNS: [ServiceName, RegExp][] = [
  ['root canal', /root\s*canal/],
  ['urgent dental concern', /toothache|tooth ache|emergency|urgent|swollen|swelling|bleeding|severe pain|pain/],
  ['cleaning', /clean|prophylaxis|prophy/],
  ['checkup', /check[\s-]?up|examin/],
  ['filling', /filling|cavity|cavities|restoration|\bfill\b|pasta/],
  ['braces', /brace|ortho/],
  ['whitening', /whiten|bleach/],
  ['extraction', /extract|pull(?:ed)?\s+(?:a|my|the)?\s*tooth|wisdom/],
  ['denture', /denture/],
  ['consultation', /consult/],
];
export function parseService(text: string): ServiceName | null {
  const t = text.toLowerCase();
  return SERVICE_PATTERNS.find(([, re]) => re.test(t))?.[0] ?? null;
}

export function isYes(text: string): boolean {
  return /^\s*(yes|yeah|yep|yup|sure|ok(?:ay)?|correct|confirm(?:ed)?|go ahead|please do|sige|oo|tama|that'?s right|book it)\b/i.test(text);
}
export function isNo(text: string): boolean {
  return /^\s*(no|nope|nah|wrong|incorrect|hindi|don'?t|do not|cancel that|stop|never ?mind)\b/i.test(text);
}

const ORD = ['th', 'st', 'nd', 'rd'];
const MON_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function spokenDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const v = d % 100;
  const ord = v >= 11 && v <= 13 ? 'th' : ORD[d % 10] ?? 'th';
  return `${MON_ABBR[m - 1]} ${d}${ord} ${y}`;
}
export function spokenTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Turn a chat reply into text that sounds right when read aloud (no ISO dates, 24h times, URLs, markdown, emoji). */
export function toSpeech(reply: string): string {
  return reply
    .replace(/\[Receipt:[^\]]*\]/gi, '')
    .replace(/(?:View|Proof)[^.\n]*?:\s*\S*\/receipt\S*/gi, '')
    .replace(/https?:\/\/\S+|\/receipt\S*|\/admin\S*/g, '')
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (s) => spokenDate(s))
    .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]\.?m)/gi, (s) => spokenTime(s)) // leave times already in 12-hour form alone
    .replace(/\*\*|__|[`•]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
