import {
  bookAppointment,
  cancelAppointment,
  checkAvailableSlots,
  getBranchForDate,
  queryAppointments,
  rescheduleAppointment,
} from './tools.js';
import {
  allIsoDates,
  isNo,
  isYes,
  looksLikeBareName,
  parseDate,
  parseName,
  parsePhone,
  parseService,
  parseTime,
  spokenDate,
  spokenTime,
} from './nlu.js';

/** Conversation state. The client stores it and sends it back, so the Worker stays stateless. Never trusted: see cleanDraft. */
export interface Draft {
  intent?: 'book' | 'cancel' | 'reschedule';
  awaiting?: 'service' | 'date' | 'time' | 'name' | 'phone' | 'confirm' | 'change';
  service?: string;
  date?: string;
  time?: string;
  name?: string;
  phone?: string;
  email?: string;
  oldDate?: string;
}

export interface BookedSummary {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string | null;
  service_type: string;
  appointment_date: string;
  appointment_time: string;
  receipt_url?: string;
  reference_number?: string;
}

export interface ConverseResult {
  reply: string;
  booked?: BookedSummary;
  draft?: Draft | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const INTENTS = ['book', 'cancel', 'reschedule'];
const AWAITING = ['service', 'date', 'time', 'name', 'phone', 'confirm', 'change'];

/** Accept only known keys with sane shapes from the client. Anything else is dropped. */
export function cleanDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const s = (k: string, max = 60): string | undefined =>
    typeof r[k] === 'string' && (r[k] as string).trim() && (r[k] as string).length <= max ? (r[k] as string).trim() : undefined;
  const d: Draft = {};
  if (typeof r.intent === 'string' && INTENTS.includes(r.intent)) d.intent = r.intent as Draft['intent'];
  if (typeof r.awaiting === 'string' && AWAITING.includes(r.awaiting)) d.awaiting = r.awaiting as Draft['awaiting'];
  d.service = s('service', 40);
  d.name = s('name', 60);
  d.phone = s('phone', 20);
  d.email = s('email', 80);
  const date = s('date', 10), oldDate = s('oldDate', 10), time = s('time', 5);
  if (date && DATE_RE.test(date)) d.date = date;
  if (oldDate && DATE_RE.test(oldDate)) d.oldDate = oldDate;
  if (time && TIME_RE.test(time)) d.time = time;
  for (const k of Object.keys(d) as (keyof Draft)[]) if (d[k] === undefined) delete d[k];
  return d.intent ? d : null;
}

function extractEmail(text: string): string | undefined {
  return text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
}

function listTimes(slots: string[], n = 5): string {
  const t = slots.slice(0, n).map(spokenTime);
  return t.length > 1 ? `${t.slice(0, -1).join(', ')} and ${t[t.length - 1]}` : t[0] ?? '';
}

const q = {
  service: 'What would you like to come in for? For example a cleaning, filling, braces, whitening or an extraction.',
  date: 'Which day works for you? You can say tomorrow, next Monday, or a date like November 20th.',
  name: 'May I have your full name, please?',
  phone: 'And your mobile number?',
};

/** Pull everything we can understand out of one message, using what we last asked for as a hint. */
function extract(text: string, today: string, d: Draft): Partial<Draft> & { two?: string[] } {
  const out: Partial<Draft> & { two?: string[] } = {};
  const isos = allIsoDates(text);
  if (isos.length >= 2) out.two = isos;
  const date = parseDate(text, today);
  if (date) out.date = date;
  const time = parseTime(text);
  if (time) out.time = time;
  const phone = parsePhone(text);
  if (phone) out.phone = phone;
  const name = parseName(text) ?? (d.awaiting === 'name' ? looksLikeBareName(text) : null);
  if (name) out.name = name;
  const service = parseService(text);
  if (service) out.service = service;
  const email = extractEmail(text);
  if (email) out.email = email;
  return out;
}

export async function converse(
  db: D1Database,
  text: string,
  incoming: Draft | null,
  today: string,
  intentHint?: Draft['intent'],
): Promise<ConverseResult> {
  const prev: Draft = incoming ?? {};
  const intent = intentHint ?? prev.intent ?? 'book';
  const got = extract(text, today, prev);
  const d: Draft = { ...prev, intent };

  if (/^\s*(cancel that|never ?mind|forget it|start over|stop)\b/i.test(text) && incoming) {
    return { reply: 'No problem, I cleared that. What else can I help you with?', draft: null };
  }

  if (intent === 'cancel') return doCancel(db, d, got, today);
  if (intent === 'reschedule') return doReschedule(db, d, got, today);
  return doBook(db, text, d, got, today, !incoming);
}

// ───────────────────────── cancel ─────────────────────────
async function doCancel(db: D1Database, d: Draft, got: Partial<Draft>, today: string): Promise<ConverseResult> {
  if (got.phone) d.phone = got.phone;
  if (got.date) d.date = got.date;
  if (!d.phone) return ask(d, 'phone', 'Sure, I can help you cancel. What mobile number did you book with?');
  if (!d.date) {
    const appts = (await queryAppointments(db, { patientPhone: d.phone })).filter((a) => a.status === 'confirmed' && a.appointment_date >= today);
    if (appts.length === 1) d.date = appts[0].appointment_date;
    else return ask(d, 'date', 'And which date is the appointment you want to cancel?');
  }
  const { cancelled } = await cancelAppointment(db, { patientPhone: d.phone, date: d.date });
  return {
    reply:
      cancelled > 0
        ? `Done — your appointment on ${d.date} is cancelled. The slot is now open if you want to rebook.`
        : `I couldn't find a confirmed appointment for ${d.phone} on ${d.date}. Please check the details and try again.`,
    draft: null,
  };
}

// ───────────────────────── reschedule ─────────────────────────
async function doReschedule(db: D1Database, d: Draft, got: Partial<Draft> & { two?: string[] }, today: string): Promise<ConverseResult> {
  if (got.phone) d.phone = got.phone;
  if (got.two) {
    d.oldDate = got.two[0];
    d.date = got.two[1];
  } else if (got.date) {
    // one date: it is the NEW date if we already know the old one (or can find it), else the old one
    if (d.oldDate || d.awaiting === 'date') d.date = got.date;
    else d.oldDate = got.date;
  }
  if (got.time) d.time = got.time;

  if (!d.phone) {
    return ask(d, 'phone', 'Of course. What mobile number is the appointment under?');
  }
  if (!d.oldDate) {
    const appts = (await queryAppointments(db, { patientPhone: d.phone })).filter((a) => a.status === 'confirmed' && a.appointment_date >= today);
    if (appts.length === 1) d.oldDate = appts[0].appointment_date;
    else return ask(d, 'change', 'Which date is your current appointment?');
  }
  if (!d.date) return ask(d, 'date', 'What new day would you like?');
  if (!d.time) {
    const slots = await safeSlots(db, d.date);
    if (!slots.length) {
      delete d.date;
      return ask(d, 'date', `We have no open times on ${spokenDate(d.date ?? today)}. Which other day works?`);
    }
    return ask(d, 'time', `On ${spokenDate(d.date)} we have ${listTimes(slots)}. Which time would you like?`);
  }
  try {
    const res = await rescheduleAppointment(db, { patientPhone: d.phone, oldDate: d.oldDate, newDate: d.date, newTime: d.time });
    return {
      reply:
        `Your appointment has been successfully rescheduled to ${res.appointment.appointmentDate} at ${res.appointment.appointmentTime} at our ${res.appointment.branch}. ` +
        `Ref: ${res.appointment.referenceNumber}. View your updated proof of appointment: ${res.appointment.receiptUrl}`,
      draft: null,
    };
  } catch (err) {
    const m = err instanceof Error ? err.message : '';
    if (m === 'APPOINTMENT_NOT_FOUND') {
      return { reply: `I couldn't find a confirmed appointment for ${d.phone} on ${d.oldDate}. Please check your phone number and date.`, draft: null };
    }
    if (m === 'SLOT_TAKEN' || m === 'INVALID_TIME') {
      const alt = await safeSlots(db, d.date);
      delete d.time;
      return ask(d, 'time', alt.length ? `Sorry, that time isn't available. Open times on ${spokenDate(d.date)}: ${listTimes(alt)}. Which one?` : 'Sorry, that day has no open times. Which other day works?');
    }
    if (m.startsWith('INVALID_')) {
      return { reply: 'Sorry, we could not reschedule that. Please check the date and time and try again.', draft: null };
    }
    throw err;
  }
}

// ───────────────────────── book ─────────────────────────
async function safeSlots(db: D1Database, date: string): Promise<string[]> {
  try {
    return await checkAvailableSlots(db, date);
  } catch {
    return [];
  }
}

function ask(d: Draft, awaiting: NonNullable<Draft['awaiting']>, reply: string): ConverseResult {
  d.awaiting = awaiting;
  return { reply, draft: d };
}

async function doBook(
  db: D1Database,
  text: string,
  d: Draft,
  got: Partial<Draft>,
  today: string,
  fresh: boolean,
): Promise<ConverseResult> {
  const hadConfirm = d.awaiting === 'confirm';
  if (hadConfirm && isYes(text) && !got.date && !got.time && !got.phone) return finishBooking(db, d);
  if (hadConfirm && isNo(text) && !got.date && !got.time) {
    return ask(d, 'change', 'No problem. What would you like to change: the day, the time, or your details?');
  }

  for (const k of ['service', 'date', 'time', 'name', 'phone', 'email'] as const) {
    if (got[k]) d[k] = got[k] as string;
  }
  // "Reschedule"-style "from X to Y" is handled elsewhere; for booking the first ISO date wins.

  // One-shot: a complete request (name, phone, date, time) in a single message books immediately, as before.
  const oneShot = fresh && d.name && d.phone && d.date && d.time;

  const urgent = fresh && d.service === 'urgent dental concern';
  const lead = urgent
    ? "I'm sorry you're in discomfort. I can't give medical advice, but I'll get you in as soon as possible. If it's severe, please contact the clinic directly or go to the nearest emergency room. "
    : '';

  if (d.date) {
    if (d.date < today) {
      delete d.date;
      delete d.time;
      return ask(d, 'date', `${lead}That date has already passed. ${q.date}`);
    }
    const slots = await safeSlots(db, d.date);
    if (slots.length === 0) {
      const bad = d.date;
      delete d.date;
      delete d.time;
      return ask(d, 'date', `${lead}We're closed or fully booked on ${spokenDate(bad)}. Which other day works?`);
    }
    if (d.time && !slots.includes(d.time)) {
      const bad = d.time;
      delete d.time;
      if (oneShot) {
        return { reply: `Sorry, ${spokenDate(d.date)} at ${spokenTime(bad)} isn't available. Open times: ${listTimes(slots)}.`, draft: d };
      }
      return ask(d, 'time', `${lead}${spokenTime(bad)} isn't open on ${spokenDate(d.date)}. We have ${listTimes(slots)}. Which one works?`);
    }
  }

  if (!d.service && !oneShot) return ask(d, 'service', `${lead}${q.service}`);
  if (!d.date) return ask(d, 'date', `${lead}${q.date}`);
  if (!d.time) {
    const slots = await safeSlots(db, d.date);
    const b = getBranchForDate(d.date);
    return ask(d, 'time', `${lead}On ${spokenDate(d.date)} we have ${listTimes(slots)} at our ${b.name}. Which time works for you?`);
  }
  if (!d.name) return ask(d, 'name', `${lead}${q.name}`);
  if (!d.phone) return ask(d, 'phone', `${lead}${q.phone}`);

  if (oneShot) return finishBooking(db, d);
  const b = getBranchForDate(d.date);
  return ask(
    d,
    'confirm',
    `Let me confirm: ${d.service ?? 'a general consultation'} on ${spokenDate(d.date)} at ${spokenTime(d.time)} at our ${b.name}, for ${d.name}, mobile ${d.phone}. Shall I book it?`,
  );
}

async function finishBooking(db: D1Database, d: Draft): Promise<ConverseResult> {
  const service = d.service ?? 'general consultation';
  try {
    const { id, receiptUrl, referenceNumber } = await bookAppointment(db, {
      patientName: d.name!,
      patientPhone: d.phone!,
      patientEmail: d.email,
      serviceType: service,
      date: d.date!,
      time: d.time!,
    });
    const booked: BookedSummary = {
      id,
      patient_name: d.name!,
      patient_phone: d.phone!,
      patient_email: d.email ?? null,
      service_type: service,
      appointment_date: d.date!,
      appointment_time: d.time!,
      receipt_url: receiptUrl,
      reference_number: referenceNumber,
    };
    return {
      reply:
        `You're booked, ${d.name}! ${service} on ${d.date} at ${d.time}. ` +
        `Booking Ref: ${referenceNumber}. ` +
        `Proof of appointment & digital receipt: ${receiptUrl}. ` +
        `We'll also send reminders before your visit!`,
      booked,
      draft: null,
    };
  } catch (err) {
    const m = err instanceof Error ? err.message : '';
    if (m === 'SLOT_TAKEN') {
      const alt = (await safeSlots(db, d.date!)).filter((t) => t !== d.time).slice(0, 4);
      const t = d.time!;
      delete d.time;
      return alt.length
        ? ask(d, 'time', `Sorry, ${d.date} at ${t} is already taken. Other open slots: ${alt.join(', ')}. Which one would you like?`)
        : { reply: `Sorry, ${d.date} at ${t} is already taken. Please try another date.`, draft: { ...d, awaiting: 'date', date: undefined } as Draft };
    }
    if (m.startsWith('INVALID_')) {
      return { reply: 'That date or time looks invalid. We are open Monday and Tuesday 9 AM to 6 PM in San Nicolas, and Wednesday to Saturday 10 AM to 6 PM at Project 6. We are closed on Sundays.', draft: null };
    }
    throw err;
  }
}
