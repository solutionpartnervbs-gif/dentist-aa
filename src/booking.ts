import { branchOpenOn, BRANCHES } from './db.js';
import { addDays } from './nlu.js';
import {
  bookAppointment,
  checkAvailableSlots,
  getBranchForDate,
} from './tools.js';
import { sendBookingAlert } from './telegram.js';
import { sendBookingConfirmation } from './email.js';
import type { BookedSummary } from './converse.js';
import type { Env } from './server.js';

/** Services offered on the booking form (value -> label). The value is what is stored. */
export const BOOKABLE_SERVICES: Record<string, string> = {
  cleaning: 'Cleaning & checkups',
  filling: 'Restorations (fillings)',
  braces: 'Braces & consultations',
  whitening: 'Teeth whitening',
  extraction: 'Extractions',
  'urgent dental concern': 'Dental concerns (urgent)',
};

const MAX_DAYS_AHEAD = 90;
const PH_MOBILE = /^(?:\+?63|0)9\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function today(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/** The window of dates a patient may book, in Manila time. */
export function bookingWindow(now = today()): { min: string; max: string } {
  return { min: now, max: addDays(now, MAX_DAYS_AHEAD) };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });

/** GET /api/availability?date=YYYY-MM-DD -> open slots, branch and booking window. Public, read-only. */
export async function handleAvailability(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: 'Database not configured' }, 500);
  const date = new URL(request.url).searchParams.get('date') ?? '';
  const win = bookingWindow();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'date is required (YYYY-MM-DD)', window: win }, 400);
  if (date < win.min || date > win.max) {
    return json({ date, open: false, reason: date < win.min ? 'past' : 'too_far', slots: [], window: win });
  }
  let slots: string[];
  try {
    slots = await checkAvailableSlots(env.DB, date);
  } catch {
    return json({ error: 'Invalid date', window: win }, 400);
  }
  const branch = branchOpenOn(date);
  return json({
    date,
    open: !!branch,
    reason: branch ? (slots.length ? undefined : 'fully_booked') : 'closed',
    branch: branch ? { name: branch.name, address: branch.address, hours: `${branch.daysLabel} ${branch.hoursLabel}` } : null,
    slots,
    window: win,
  });
}

/** GET /api/config -> what the booking form needs: services, branches, window. Lets the form follow the server's rules. */
export function handleBookingConfig(): Response {
  return json({
    services: Object.entries(BOOKABLE_SERVICES).map(([value, label]) => ({ value, label })),
    branches: BRANCHES.map((b) => ({ id: b.id, name: b.name, address: b.address, days: b.daysLabel, hours: b.hoursLabel })),
    window: bookingWindow(),
  });
}

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** POST /api/book -> create an appointment from the website form. Same rules as the chat (double-booking, hours). */
export async function handleBook(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  if (!env.DB) return json({ error: 'Database not configured' }, 500);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const name = clean(body.name, 80);
  const phoneRaw = clean(body.phone, 20).replace(/[\s()-]/g, '');
  const email = clean(body.email, 120);
  const service = clean(body.service, 40);
  const date = clean(body.date, 10);
  const time = clean(body.time, 5);

  const fields: Record<string, string> = {};
  if (name.length < 2 || !/^[\p{L}][\p{L} .'’-]*$/u.test(name)) fields.name = 'Enter your full name.';
  if (!PH_MOBILE.test(phoneRaw)) fields.phone = 'Enter a Philippine mobile number, for example 0917 123 4567.';
  if (email && !EMAIL.test(email)) fields.email = 'Enter a valid email address or leave it blank.';
  if (!(service in BOOKABLE_SERVICES)) fields.service = 'Choose a service.';
  const win = bookingWindow();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < win.min || date > win.max) fields.date = 'Choose a date within the next 90 days.';
  else if (!branchOpenOn(date)) fields.date = 'We are closed on Sundays. Please choose another day.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fields.time = 'Choose a time.';
  if (Object.keys(fields).length) return json({ error: 'Please check the highlighted fields.', fields }, 400);

  const phone = phoneRaw.startsWith('+63') ? '0' + phoneRaw.slice(3) : phoneRaw.startsWith('63') ? '0' + phoneRaw.slice(2) : phoneRaw;
  try {
    const { id, referenceNumber } = await bookAppointment(env.DB, {
      patientName: name,
      patientPhone: phone,
      patientEmail: email || undefined,
      serviceType: service,
      date,
      time,
    });
    const branch = getBranchForDate(date);
    const booked: BookedSummary = {
      id,
      patient_name: name,
      patient_phone: phone,
      patient_email: email || null,
      service_type: service,
      appointment_date: date,
      appointment_time: time,
      receipt_url: `/receipt/${id}`,
      reference_number: referenceNumber,
    };
    if (ctx?.waitUntil) ctx.waitUntil(Promise.all([sendBookingAlert(env, booked), sendBookingConfirmation(env, booked)]).then(() => {}));
    return json({
      booked: true,
      id,
      reference: referenceNumber,
      receiptPath: `/receipt/${id}`,
      service: BOOKABLE_SERVICES[service],
      date,
      time,
      branch: branch.name,
      address: branch.address,
    }, 201);
  } catch (err) {
    const m = err instanceof Error ? err.message : '';
    if (m === 'SLOT_TAKEN') {
      return json({ error: 'That time was just taken. Please choose another time.', fields: { time: 'That time was just taken.' }, refresh: true }, 409);
    }
    if (m.startsWith('INVALID_')) {
      return json({ error: 'That date or time is outside our opening hours.', fields: { time: 'Choose one of the listed times.' }, refresh: true }, 400);
    }
    console.error('book failed', err);
    return json({ error: 'We could not book that right now. Please try again.' }, 500);
  }
}
