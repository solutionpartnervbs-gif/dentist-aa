import { test, expect, vi } from 'vitest';

vi.mock('agents', () => ({ routeAgentRequest: async () => null }));
vi.mock('@cloudflare/ai-chat', () => ({
  AIChatAgent: class {
    protected env!: never;
    protected messages!: never[];
    constructor() {}
  },
}));

import server from '../src/server';
import { makeMockDb } from './mockdb';
import {
  bookAppointment,
  rescheduleAppointment,
  getAppointmentReceipt,
  generateClinicReport,
} from '../src/tools';
import { handleChatMessage } from '../src/chat';

function makeEnv(db = makeMockDb()) {
  return {
    DB: db,
    AI: null,
    ADMIN_PASSWORD: 'test',
  } as never;
}

test('rescheduleAppointment moves booking and updates date/time', async () => {
  const db = makeMockDb();
  const { id } = await bookAppointment(db as never, {
    patientName: 'Maria Santos',
    patientPhone: '09170000005',
    serviceType: 'cleaning',
    date: '2026-10-20',
    time: '09:00',
  });

  const res = await rescheduleAppointment(db as never, {
    patientPhone: '09170000005',
    oldDate: '2026-10-20',
    newDate: '2026-10-21',
    newTime: '11:00',
  });

  expect(res.success).toBe(true);
  expect(res.appointment.appointmentDate).toBe('2026-10-21');
  expect(res.appointment.appointmentTime).toBe('11:00');
  expect(res.appointment.referenceNumber).toBe(`SUYAT-${id.slice(0, 8).toUpperCase()}`);
});

test('getAppointmentReceipt returns complete official proof of appointment', async () => {
  const db = makeMockDb();
  const { id } = await bookAppointment(db as never, {
    patientName: 'Juan Dela Cruz',
    patientPhone: '09171112233',
    serviceType: 'whitening',
    date: '2026-10-21',
    time: '14:00',
  });

  const receipt = await getAppointmentReceipt(db as never, id);
  expect(receipt).not.toBeNull();
  expect(receipt?.patientName).toBe('Juan Dela Cruz');
  expect(receipt?.serviceType).toBe('whitening');
  expect(receipt?.referenceNumber).toBe(`SUYAT-${id.slice(0, 8).toUpperCase()}`);
  expect(receipt?.receiptUrl).toBe(`/receipt.html?id=${id}`);
  expect(receipt?.instructions.length).toBeGreaterThan(0);
});

test('generateClinicReport aggregates stats across appointments', async () => {
  const db = makeMockDb();
  await bookAppointment(db as never, {
    patientName: 'Patient 1',
    patientPhone: '09170000010',
    serviceType: 'cleaning',
    date: '2026-10-22',
    time: '11:00',
  });
  await bookAppointment(db as never, {
    patientName: 'Patient 2',
    patientPhone: '09170000020',
    serviceType: 'extraction',
    date: '2026-10-22',
    time: '10:00',
  });

  const report = await generateClinicReport(db as never, { date: '2026-10-22' });
  expect(report.totalBookings).toBe(2);
  expect(report.confirmed).toBe(2);
  expect(report.servicesBreakdown['cleaning']).toBe(1);
  expect(report.servicesBreakdown['extraction']).toBe(1);
});

test('chat handles reschedule and receipt requests naturally', async () => {
  const db = makeMockDb();
  await bookAppointment(db as never, {
    patientName: 'Ana Lopez',
    patientPhone: '09179998877',
    serviceType: 'consultation',
    date: '2026-10-20',
    time: '10:00',
  });

  // Query proof of appointment receipt
  const receiptChat = await handleChatMessage(
    db as never,
    'Can I get my appointment receipt for 09179998877?',
  );
  expect(receiptChat.reply).toContain('Official Proof of Appointment');
  expect(receiptChat.reply).toContain('/receipt.html?id=');

  // Reschedule
  const rescheduleChat = await handleChatMessage(
    db as never,
    'Reschedule 09179998877 from 2026-10-20 to 2026-10-21 at 15:00',
  );
  expect(rescheduleChat.reply).toContain('rescheduled to 2026-10-21 at 15:00');
});

test('voice call webhook /api/calls/incoming answers caller', async () => {
  const env = makeEnv();
  const req = new Request('http://localhost/api/calls/incoming', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ From: '+639170000001' }),
  });
  const res = await server.fetch(req, env);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.message).toContain('Suyat Dental Clinic');
});

test('public receipt endpoint /api/appointments/:id/receipt serves proof', async () => {
  const db = makeMockDb();
  const env = makeEnv(db);
  const { id } = await bookAppointment(db as never, {
    patientName: 'Carlos Rivera',
    patientPhone: '09175554433',
    serviceType: 'root canal',
    date: '2026-10-20',
    time: '11:00',
  });

  const req = new Request(`http://localhost/api/appointments/${id}/receipt`);
  const res = await server.fetch(req, env);
  expect(res.status).toBe(200);
  const receipt = await res.json();
  expect(receipt.patientName).toBe('Carlos Rivera');
  expect(receipt.serviceType).toBe('root canal');
});

test('admin reports endpoint /api/admin/reports returns metrics', async () => {
  const db = makeMockDb();
  const env = makeEnv(db);
  const req = new Request('http://localhost/api/admin/reports', {
    headers: { authorization: 'Bearer test' },
  });
  const res = await server.fetch(req, env);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toHaveProperty('report');
  expect(data.report).toHaveProperty('totalBookings');
});
