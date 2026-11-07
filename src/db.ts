/**
 * SINGLE SOURCE OF TRUTH for opening hours. Everything that talks about hours or branches
 * (slot lists, booking validation, receipts, chat answers) reads from here.
 * Slots are hourly: the last bookable slot starts one hour before closing.
 * Days use JS getUTCDay(): 0 = Sunday. A day in no branch's list is closed.
 */
export interface Branch {
  id: string;
  name: string;
  address: string;
  days: number[];
  open: string; // HH:MM
  close: string; // HH:MM
  daysLabel: string;
  hoursLabel: string;
}

export const BRANCHES: Branch[] = [
  {
    id: 'san-nicolas',
    name: 'San Nicolas Branch',
    address: 'Sta. Maria West, San Nicolas, Pangasinan',
    days: [1, 2],
    open: '09:00',
    close: '18:00',
    daysLabel: 'Mon-Tue',
    hoursLabel: '9:00 AM - 6:00 PM',
  },
  {
    id: 'project-6',
    name: 'Project 6 Branch',
    address: '111 – B2 Rd 3, Cor. Road 7, Project 6, Quezon City',
    days: [3, 4, 5, 6],
    open: '10:00',
    close: '18:00',
    daysLabel: 'Wed-Sat',
    hoursLabel: '10:00 AM - 6:00 PM',
  },
];

function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The branch open on this date, or null when the clinic is closed (Sunday). */
export function branchOpenOn(date: string): Branch | null {
  const day = dayOfWeek(date);
  return BRANCHES.find((b) => b.days.includes(day)) ?? null;
}

function hourlySlots(open: string, close: string): string[] {
  const out: string[] = [];
  for (let h = Number(open.slice(0, 2)); h < Number(close.slice(0, 2)); h++) {
    out.push(`${String(h).padStart(2, '0')}:00`);
  }
  return out;
}

export interface AppointmentRow {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string | null;
  service_type: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reminder_sent: number;
  created_at: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function assertValidDate(date: string): void {
  if (!DATE_RE.test(date)) throw new Error(`INVALID_DATE: ${date}`);
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new Error(`INVALID_DATE: ${date}`);
  }
}

export function assertValidTime(time: string): void {
  if (!TIME_RE.test(time)) throw new Error(`INVALID_TIME: ${time}`);
}

/** Bookable start times for a date (empty when closed). */
export function clinicHoursFor(date: string): string[] {
  const b = branchOpenOn(date);
  return b ? hourlySlots(b.open, b.close) : [];
}

export function withinClinicHours(date: string, time: string): boolean {
  return clinicHoursFor(date).includes(time);
}

export async function fetchConfirmedTimes(
  db: D1Database,
  date: string,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      "SELECT appointment_time FROM appointments WHERE appointment_date = ? AND status = 'confirmed'",
    )
    .bind(date)
    .all<{ appointment_time: string }>();
  return results.map((r) => r.appointment_time);
}
