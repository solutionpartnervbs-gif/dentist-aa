import {
  BRANCHES,
  branchOpenOn,
  clinicHoursFor,
  withinClinicHours,
  assertValidDate,
  assertValidTime,
  fetchConfirmedTimes,
  AppointmentRow,
} from './db.js';

export interface BookInput {
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  serviceType: string;
  date: string;
  time: string;
}

export interface CancelInput {
  patientPhone: string;
  date: string;
}

export interface RescheduleInput {
  patientPhone: string;
  oldDate: string;
  newDate: string;
  newTime: string;
}

export interface AppointmentReceipt {
  id: string;
  referenceNumber: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  serviceType: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  branch: string;
  branchAddress: string;
  instructions: string[];
  receiptUrl: string;
  createdAt: string;
}

export interface ClinicReport {
  date: string;
  totalBookings: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
  servicesBreakdown: Record<string, number>;
  appointments: {
    id: string;
    patientName: string;
    patientPhone: string;
    serviceType: string;
    appointmentDate: string;
    appointmentTime: string;
    status: string;
  }[];
}

export function getBranchForDate(date: string): { name: string; address: string } {
  // Closed days (Sunday) fall back to Project 6, as before; nothing can be booked on them anyway.
  const b = branchOpenOn(date) ?? BRANCHES[BRANCHES.length - 1];
  return { name: b.name, address: `${b.address} (${b.daysLabel} ${b.hoursLabel})` };
}

export async function checkAvailableSlots(
  db: D1Database,
  date: string,
): Promise<string[]> {
  assertValidDate(date);
  const taken = new Set(await fetchConfirmedTimes(db, date));
  return clinicHoursFor(date).filter((t) => !taken.has(t));
}

export async function bookAppointment(
  db: D1Database,
  input: BookInput,
): Promise<{ id: string; receiptUrl: string; referenceNumber: string }> {
  if (!input.patientName?.trim()) throw new Error('INVALID_NAME');
  if (!input.patientPhone?.trim()) throw new Error('INVALID_PHONE');
  if (!input.serviceType?.trim()) throw new Error('INVALID_SERVICE');
  assertValidDate(input.date);
  assertValidTime(input.time);
  if (!withinClinicHours(input.date, input.time)) throw new Error('INVALID_TIME');

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO appointments
          (id, patient_name, patient_phone, patient_email, service_type,
           appointment_date, appointment_time, status, reminder_sent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', 0, ?)`,
      )
      .bind(
        id,
        input.patientName.trim(),
        input.patientPhone.trim(),
        input.patientEmail?.trim() || null,
        input.serviceType.trim(),
        input.date,
        input.time,
        createdAt,
      )
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/SLOT_TAKEN|UNIQUE constraint|idx_unique_slot/i.test(msg)) {
      throw new Error('SLOT_TAKEN');
    }
    throw err;
  }
  const referenceNumber = `SUYAT-${id.slice(0, 8).toUpperCase()}`;
  return { id, receiptUrl: `/receipt.html?id=${id}`, referenceNumber };
}

export async function cancelAppointment(
  db: D1Database,
  input: CancelInput,
): Promise<{ cancelled: number }> {
  if (!input.patientPhone?.trim()) throw new Error('INVALID_PHONE');
  assertValidDate(input.date);

  const existing = await db
    .prepare(
      "SELECT id FROM appointments WHERE patient_phone = ? AND appointment_date = ? AND status = 'confirmed'",
    )
    .bind(input.patientPhone.trim(), input.date)
    .all<{ id: string }>();
  if (existing.results.length === 0) return { cancelled: 0 };

  await db
    .prepare(
      "UPDATE appointments SET status = 'cancelled' WHERE patient_phone = ? AND appointment_date = ? AND status = 'confirmed'",
    )
    .bind(input.patientPhone.trim(), input.date)
    .run();
  return { cancelled: existing.results.length };
}

export async function queryAppointments(
  db: D1Database,
  filter: { patientPhone?: string; date?: string; id?: string },
): Promise<AppointmentRow[]> {
  const clauses: string[] = [];
  const values: string[] = [];

  if (filter.id) {
    clauses.push('id = ?');
    values.push(filter.id);
  }
  if (filter.patientPhone) {
    clauses.push('patient_phone = ?');
    values.push(filter.patientPhone.trim());
  }
  if (filter.date) {
    assertValidDate(filter.date);
    clauses.push('appointment_date = ?');
    values.push(filter.date);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await db
    .prepare(
      `SELECT id, patient_name, patient_phone, patient_email, service_type,
              appointment_date, appointment_time, status, reminder_sent, created_at
       FROM appointments ${where}
       ORDER BY appointment_date DESC, appointment_time DESC`,
    )
    .bind(...values)
    .all<AppointmentRow>();

  return results;
}

export async function rescheduleAppointment(
  db: D1Database,
  input: RescheduleInput,
): Promise<{ success: boolean; appointment: AppointmentReceipt }> {
  if (!input.patientPhone?.trim()) throw new Error('INVALID_PHONE');
  assertValidDate(input.oldDate);
  assertValidDate(input.newDate);
  assertValidTime(input.newTime);
  if (!withinClinicHours(input.newDate, input.newTime)) {
    throw new Error('INVALID_TIME');
  }

  const found = await queryAppointments(db, {
    patientPhone: input.patientPhone.trim(),
    date: input.oldDate,
  });
  const current = found.find((a) => a.status === 'confirmed');
  if (!current) throw new Error('APPOINTMENT_NOT_FOUND');

  // Check if new slot is taken
  const taken = await checkAvailableSlots(db, input.newDate);
  if (!taken.includes(input.newTime)) {
    throw new Error('SLOT_TAKEN');
  }

  await db
    .prepare(
      `UPDATE appointments
       SET appointment_date = ?, appointment_time = ?, reminder_sent = 0
       WHERE id = ?`,
    )
    .bind(input.newDate, input.newTime, current.id)
    .run();

  const receipt = await getAppointmentReceipt(db, current.id);
  if (!receipt) throw new Error('FAILED_TO_GENERATE_RECEIPT');
  return { success: true, appointment: receipt };
}

export async function getAppointmentReceipt(
  db: D1Database,
  id: string,
): Promise<AppointmentReceipt | null> {
  const { results } = await db
    .prepare(
      `SELECT id, patient_name, patient_phone, patient_email, service_type,
              appointment_date, appointment_time, status, reminder_sent, created_at
       FROM appointments WHERE id = ?`,
    )
    .bind(id)
    .all<AppointmentRow>();

  const appt = results[0];
  if (!appt) return null;

  const branch = getBranchForDate(appt.appointment_date);
  return {
    id: appt.id,
    referenceNumber: `SUYAT-${appt.id.slice(0, 8).toUpperCase()}`,
    patientName: appt.patient_name,
    patientPhone: appt.patient_phone,
    patientEmail: appt.patient_email,
    serviceType: appt.service_type,
    appointmentDate: appt.appointment_date,
    appointmentTime: appt.appointment_time,
    status: appt.status,
    branch: branch.name,
    branchAddress: branch.address,
    instructions: [
      'Please arrive 10-15 minutes prior to your scheduled time.',
      'Bring a valid government-issued ID.',
      'If you need to cancel or reschedule, notify the clinic at least 24 hours ahead.',
    ],
    receiptUrl: `/receipt.html?id=${appt.id}`,
    createdAt: appt.created_at,
  };
}

export async function generateClinicReport(
  db: D1Database,
  options: { date?: string } = {},
): Promise<ClinicReport> {
  const targetDate = options.date ?? new Date().toISOString().slice(0, 10);
  const { results } = await db
    .prepare(
      `SELECT id, patient_name, patient_phone, service_type,
              appointment_date, appointment_time, status
       FROM appointments
       ORDER BY appointment_date, appointment_time`,
    )
    .bind()
    .all<{
      id: string;
      patient_name: string;
      patient_phone: string;
      service_type: string;
      appointment_date: string;
      appointment_time: string;
      status: string;
    }>();

  const filtered = options.date
    ? results.filter((r) => r.appointment_date === options.date)
    : results;

  const servicesBreakdown: Record<string, number> = {};
  let confirmed = 0;
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;

  for (const r of filtered) {
    if (r.status === 'confirmed') confirmed++;
    else if (r.status === 'completed') completed++;
    else if (r.status === 'cancelled') cancelled++;
    else if (r.status === 'no_show') noShow++;

    const s = r.service_type || 'other';
    servicesBreakdown[s] = (servicesBreakdown[s] || 0) + 1;
  }

  return {
    date: targetDate,
    totalBookings: filtered.length,
    confirmed,
    completed,
    cancelled,
    noShow,
    servicesBreakdown,
    appointments: filtered.map((r) => ({
      id: r.id,
      patientName: r.patient_name,
      patientPhone: r.patient_phone,
      serviceType: r.service_type,
      appointmentDate: r.appointment_date,
      appointmentTime: r.appointment_time,
      status: r.status,
    })),
  };
}

