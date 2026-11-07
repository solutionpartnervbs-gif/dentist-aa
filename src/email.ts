import type { Env } from './server.js';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

type FetchImpl = typeof fetch;

function resendKey(env: Env): string | null {
  return (
    (env as unknown as Record<string, string | undefined>)['RESEND_API_KEY'] ??
    null
  );
}

function fromAddress(env: Env): string {
  return (
    (env as unknown as Record<string, string | undefined>)[
      'CLINIC_NOTIFICATION_EMAIL'
    ] ?? 'clinic@example.com'
  );
}

export async function sendEmail(
  env: Env,
  email: OutgoingEmail,
  fetchImpl: FetchImpl = fetch,
): Promise<boolean> {
  const key = resendKey(env);
  if (!key) {
    console.log('resend skipped (missing secret)', email.subject);
    return false;
  }
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: fromAddress(env), ...email }),
  });
  return res.ok;
}

export async function sendBookingConfirmation(
  env: Env,
  appt: {
    patient_email: string | null;
    patient_name: string;
    service_type: string;
    appointment_date: string;
    appointment_time: string;
  },
  fetchImpl: FetchImpl = fetch,
): Promise<boolean> {
  if (!appt.patient_email) return false;
  return sendEmail(
    env,
    {
      to: appt.patient_email,
      subject: `Appointment confirmed — ${appt.appointment_date} ${appt.appointment_time}`,
      text:
        `Hi ${appt.patient_name},\n\nYour ${appt.service_type} appointment is confirmed ` +
        `for ${appt.appointment_date} at ${appt.appointment_time}.\n\nSee you soon!`,
    },
    fetchImpl,
  );
}

export async function sendReminderBatch(
  env: Env,
  appts: {
    patient_email: string | null;
    patient_name: string;
    service_type: string;
    appointment_date: string;
    appointment_time: string;
  }[],
  fetchImpl: FetchImpl = fetch,
): Promise<number> {
  const withEmail = appts.filter((a) => a.patient_email);
  if (withEmail.length === 0) return 0;
  const key = resendKey(env);
  if (!key) {
    console.log('resend batch skipped (missing secret)');
    return 0;
  }
  const res = await fetchImpl('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(
      withEmail.map((a) => ({
        from: fromAddress(env),
        to: a.patient_email as string,
        subject: `Reminder: appointment tomorrow ${a.appointment_time}`,
        text:
          `Hi ${a.patient_name},\n\nThis is a reminder of your ${a.service_type} ` +
          `appointment on ${a.appointment_date} at ${a.appointment_time}.\n\nSee you soon!`,
      })),
    ),
  });
  return res.ok ? withEmail.length : 0;
}
