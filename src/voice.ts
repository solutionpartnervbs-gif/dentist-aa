import { secretsEqual } from './admin.js';
import {
  bookAppointment,
  cancelAppointment,
  checkAvailableSlots,
  getBranchForDate,
  rescheduleAppointment,
} from './tools.js';
import type { Env } from './server.js';

/**
 * Tool endpoint for the external voice-agent service (see voice/).
 * POST /api/voice/tool  { tool, arguments }  with  Authorization: Bearer VOICE_TOOL_SECRET
 * Fails closed: if VOICE_TOOL_SECRET is not configured the endpoint is disabled.
 * Every response has { status, response_text } so the voice LLM can speak it directly.
 */
const ERRORS: Record<string, string> = {
  INVALID_NAME: 'I still need the patient’s full name.',
  INVALID_PHONE: 'I still need a mobile number for the booking.',
  INVALID_SERVICE: 'I still need to know which service the patient wants.',
  INVALID_DATE: 'That date does not look valid. Please give me the date again.',
  INVALID_TIME: 'That time is outside our clinic hours. Please pick another time.',
  SLOT_TAKEN: 'That time was just taken. Let me offer another time.',
  APPOINTMENT_NOT_FOUND: 'I could not find a confirmed appointment for that number and date.',
};


const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-11-10" -> "Nov 10th 2026" (spoken format: abbreviated month, ordinal day, no comma). */
export function spokenDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const v = d % 100;
  const ord = v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][d % 10] ?? 'th';
  return `${MONTHS[m - 1]} ${d}${ord} ${y}`;
}
/** "13:00" -> "1:00 PM" */
export function spokenTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function handleVoiceTool(request: Request, env: Env): Promise<Response> {
  const secret = (env as unknown as { VOICE_TOOL_SECRET?: string }).VOICE_TOOL_SECRET;
  if (!secret) return Response.json({ error: 'Voice tools not configured' }, { status: 503 });
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ') || !(await secretsEqual(auth.slice(7), secret))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!env.DB) return Response.json({ error: 'Database not configured' }, { status: 500 });

  let body: { tool?: unknown; arguments?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const a = body.arguments ?? {};
  try {
    switch (body.tool) {
      case 'check_available_slots': {
        const date = str(a.date);
        const slots = await checkAvailableSlots(env.DB, date);
        const branch = getBranchForDate(date);
        return Response.json({
          status: slots.length ? 'found' : 'none_found',
          date,
          branch: branch.name,
          slots,
          response_text: slots.length
            ? `On ${spokenDate(date)} we have ${slots.slice(0, 3).map(spokenTime).join(', ')} available at our ${branch.name}.`
            : 'There are no open times on that date. Would you like to try another day?',
        });
      }
      case 'book_appointment': {
        const r = await bookAppointment(env.DB, {
          patientName: str(a.patient_name),
          patientPhone: str(a.patient_phone),
          serviceType: str(a.service_type),
          date: str(a.date),
          time: str(a.time),
        });
        return Response.json({
          status: 'booked',
          booking_reference: r.referenceNumber,
          receipt_path: `/receipt/${r.id}`,
          response_text: `Your appointment is booked. Your reference number is ${r.referenceNumber}. We also sent a proof of appointment to your chat receipt link.`,
        });
      }
      case 'cancel_appointment': {
        const r = await cancelAppointment(env.DB, { patientPhone: str(a.patient_phone), date: str(a.date) });
        return Response.json({
          status: r.cancelled ? 'cancelled' : 'not_found',
          cancelled: r.cancelled,
          response_text: r.cancelled
            ? 'Your appointment has been cancelled.'
            : ERRORS.APPOINTMENT_NOT_FOUND,
        });
      }
      case 'reschedule_appointment': {
        const r = await rescheduleAppointment(env.DB, {
          patientPhone: str(a.patient_phone),
          oldDate: str(a.old_date),
          newDate: str(a.new_date),
          newTime: str(a.new_time),
        });
        return Response.json({
          status: 'rescheduled',
          booking_reference: r.appointment.referenceNumber,
          response_text: `Done. Your appointment is moved to ${spokenDate(r.appointment.appointmentDate)} at ${spokenTime(r.appointment.appointmentTime)}.`,
        });
      }
      default:
        return Response.json({ error: 'Unknown tool' }, { status: 400 });
    }
  } catch (err) {
    const code = (err instanceof Error ? err.message : '').split(':')[0];
    if (ERRORS[code]) {
      return Response.json({ status: 'error', code, response_text: ERRORS[code] });
    }
    console.error('voice tool failed', err);
    return Response.json({ error: 'Tool failed' }, { status: 500 });
  }
}
