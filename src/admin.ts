import { assertValidDate, assertValidTime, withinClinicHours } from './db.js';
import type { Env } from './server.js';

async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  );
  return new Uint8Array(digest);
}

export async function secretsEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function verifyAdmin(
  request: Request,
  env: Env,
): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return false;
  const given = header.slice('Bearer '.length);
  if (!given) return false;
  return secretsEqual(given, env.ADMIN_PASSWORD);
}

export interface AppointmentFilters {
  date?: string;
  status?: string;
  q?: string;
}

const STATUSES = ['confirmed', 'completed', 'cancelled', 'no_show'];

const COLUMNS = `id, patient_name, patient_phone, patient_email, service_type,
  appointment_date, appointment_time, status, reminder_sent, created_at`;

export async function listAppointments(
  db: D1Database,
  filters: AppointmentFilters,
) {
  const clauses: string[] = [];
  const values: string[] = [];
  if (filters.date) {
    assertValidDate(filters.date);
    clauses.push('appointment_date = ?');
    values.push(filters.date);
  }
  if (filters.status) {
    if (!STATUSES.includes(filters.status)) throw new Error('INVALID_STATUS');
    clauses.push('status = ?');
    values.push(filters.status);
  }
  if (filters.q) {
    clauses.push('(patient_name LIKE ? OR patient_phone LIKE ?)');
    values.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNS} FROM appointments ${where} ORDER BY appointment_date, appointment_time`,
    )
    .bind(...values)
    .all();
  return results;
}

export async function getAppointment(db: D1Database, id: string) {
  const { results } = await db
    .prepare(`SELECT ${COLUMNS} FROM appointments WHERE id = ?`)
    .bind(id)
    .all();
  return results[0] ?? null;
}

export interface AppointmentPatch {
  status?: string;
  appointment_date?: string;
  appointment_time?: string;
}

export async function updateAppointment(
  db: D1Database,
  id: string,
  patch: AppointmentPatch,
) {
  const current = await getAppointment(db, id);
  if (!current) return null;

  const next = {
    status:
      typeof patch.status === 'string'
        ? patch.status
        : (current as { status: string }).status,
    appointment_date:
      typeof patch.appointment_date === 'string'
        ? patch.appointment_date
        : (current as { appointment_date: string }).appointment_date,
    appointment_time:
      typeof patch.appointment_time === 'string'
        ? patch.appointment_time
        : (current as { appointment_time: string }).appointment_time,
  };
  if (!STATUSES.includes(next.status)) throw new Error('INVALID_STATUS');
  assertValidDate(next.appointment_date);
  assertValidTime(next.appointment_time);

  if (next.status === 'confirmed') {
    if (!withinClinicHours(next.appointment_date, next.appointment_time)) {
      throw new Error('INVALID_TIME');
    }
    const { results } = await db
      .prepare(
        `SELECT id FROM appointments WHERE appointment_date = ? AND appointment_time = ? AND status = 'confirmed' AND id != ?`,
      )
      .bind(next.appointment_date, next.appointment_time, id)
      .all<{ id: string }>();
    if (results.length > 0) {
      const err = new Error('SLOT_TAKEN');
      (err as { statusCode?: number }).statusCode = 409;
      throw err;
    }
  }

  await db
    .prepare(
      `UPDATE appointments SET status = ?, appointment_date = ?, appointment_time = ? WHERE id = ?`,
    )
    .bind(next.status, next.appointment_date, next.appointment_time, id)
    .run();
  return getAppointment(db, id);
}

export async function deleteAppointment(
  db: D1Database,
  id: string,
): Promise<{ deleted: number }> {
  const current = await getAppointment(db, id);
  if (!current) return { deleted: 0 };
  await db.prepare(`DELETE FROM appointments WHERE id = ?`).bind(id).run();
  return { deleted: 1 };
}
