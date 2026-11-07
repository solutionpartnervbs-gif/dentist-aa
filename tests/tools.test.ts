import { test, expect } from 'vitest';
import { makeMockDb } from './mockdb';

test('lists open clinic hours for a date', async () => {
  const { checkAvailableSlots } = await import('../src/tools');
  const slots = await checkAvailableSlots(makeMockDb() as never, '2026-10-20');
  expect(slots).toContain('09:00');
  expect(slots).toContain('17:00');
});

test('rejects double-booking same slot', async () => {
  const { bookAppointment } = await import('../src/tools');
  const db = makeMockDb() as never;
  await bookAppointment(db, {
    patientName: 'Ana',
    patientPhone: '09170000001',
    serviceType: 'cleaning',
    date: '2026-10-20',
    time: '10:00',
  });
  await expect(
    bookAppointment(db, {
      patientName: 'Ben',
      patientPhone: '09170000002',
      serviceType: 'cleaning',
      date: '2026-10-20',
      time: '10:00',
    }),
  ).rejects.toThrow('SLOT_TAKEN');
});

test('rejects invalid date and time', async () => {
  const { bookAppointment } = await import('../src/tools');
  const db = makeMockDb() as never;
  await expect(
    bookAppointment(db, {
      patientName: 'Ana',
      patientPhone: '09170000001',
      serviceType: 'cleaning',
      date: '2026-13-40',
      time: '10:00',
    }),
  ).rejects.toThrow();
  await expect(
    bookAppointment(db, {
      patientName: 'Ana',
      patientPhone: '09170000001',
      serviceType: 'cleaning',
      date: '2026-10-20',
      time: '25:99',
    }),
  ).rejects.toThrow();
});

test('rejects booking outside clinic hours', async () => {
  const { bookAppointment } = await import('../src/tools');
  const db = makeMockDb() as never;
  await expect(
    bookAppointment(db, {
      patientName: 'Ana',
      patientPhone: '09170000001',
      serviceType: 'cleaning',
      date: '2026-10-20',
      time: '03:00',
    }),
  ).rejects.toThrow('INVALID_TIME');
});

test('rejects booking on Sunday (clinic closed)', async () => {
  const { bookAppointment } = await import('../src/tools');
  // 2026-10-25 is a Sunday
  await expect(
    bookAppointment(makeMockDb() as never, {
      patientName: 'Ana',
      patientPhone: '09170000001',
      serviceType: 'cleaning',
      date: '2026-10-25',
      time: '10:00',
    }),
  ).rejects.toThrow('INVALID_TIME');
});

test('Saturday (Project 6) is open 10:00-18:00, not before opening', async () => {
  const { bookAppointment } = await import('../src/tools');
  // 2026-10-24 is a Saturday
  const base = { patientName: 'Ana', patientPhone: '09170000001', serviceType: 'cleaning', date: '2026-10-24' };
  await expect(bookAppointment(makeMockDb() as never, { ...base, time: '09:00' })).rejects.toThrow('INVALID_TIME'); // before 10:00
  await expect(bookAppointment(makeMockDb() as never, { ...base, time: '18:00' })).rejects.toThrow('INVALID_TIME'); // closing time
  await expect(bookAppointment(makeMockDb() as never, { ...base, time: '10:00' })).resolves.toHaveProperty('id');
  await expect(bookAppointment(makeMockDb() as never, { ...base, time: '17:00' })).resolves.toHaveProperty('id'); // afternoon now allowed
});

test('slots follow the published branch schedule, one source of truth', async () => {
  const { checkAvailableSlots, getBranchForDate } = await import('../src/tools');
  const db = makeMockDb() as never;
  const nine2five = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  // Mon-Tue: San Nicolas 9-6
  expect(await checkAvailableSlots(db, '2026-10-19')).toEqual(nine2five); // Monday
  expect(await checkAvailableSlots(db, '2026-10-20')).toEqual(nine2five); // Tuesday
  // Wed-Sat: Project 6 10-6
  for (const d of ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']) {
    expect(await checkAvailableSlots(db, d)).toEqual(nine2five.slice(1));
  }
  // Sunday closed
  expect(await checkAvailableSlots(db, '2026-10-25')).toEqual([]);
  // Branch matches the hours it was open
  expect(getBranchForDate('2026-10-19').name).toBe('San Nicolas Branch');
  expect(getBranchForDate('2026-10-21').name).toBe('Project 6 Branch');
  expect(getBranchForDate('2026-10-21').address).toContain('Wed-Sat 10:00 AM - 6:00 PM');
});

test('cancel frees the slot for re-booking', async () => {
  const { bookAppointment, cancelAppointment } = await import('../src/tools');
  const db = makeMockDb() as never;
  await bookAppointment(db, {
    patientName: 'Ana',
    patientPhone: '09170000001',
    serviceType: 'cleaning',
    date: '2026-10-21',
    time: '11:00',
  });
  const { cancelled } = await cancelAppointment(db, {
    patientPhone: '09170000001',
    date: '2026-10-21',
  });
  expect(cancelled).toBe(1);
  await bookAppointment(db, {
    patientName: 'Ben',
    patientPhone: '09170000002',
    serviceType: 'cleaning',
    date: '2026-10-21',
    time: '11:00',
  });
});
