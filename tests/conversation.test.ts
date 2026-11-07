import { describe, expect, it } from 'vitest';
import { handleChatMessage, type Draft } from '../src/chat';
import { cleanDraft } from '../src/converse';
import { makeMockDb } from './mockdb';

const TODAY = '2026-11-09'; // Monday

/** Drive a multi-turn chat, feeding the returned draft back in, like the browser does. */
function session(db = makeMockDb()) {
  let draft: Draft | null = null;
  return {
    db,
    async say(msg: string) {
      const r = await handleChatMessage(db as never, msg, draft, TODAY);
      draft = r.draft ?? null;
      return r;
    },
    get draft() { return draft; },
  };
}

describe('conversational booking (spoken style)', () => {
  it('books across turns, one question at a time, with a confirmation', async () => {
    const s = session();
    let r = await s.say('Hi, I want a cleaning');
    expect(r.reply).toMatch(/Which day/i);
    r = await s.say('next Monday');
    expect(r.reply).toContain('Nov 16th 2026');
    expect(r.reply).toMatch(/9:00 AM/);
    r = await s.say('two pm');
    expect(r.reply).toMatch(/full name/i);
    r = await s.say('Ana Reyes');
    expect(r.reply).toMatch(/mobile number/i);
    r = await s.say('zero nine one seven one two three four five six seven');
    expect(r.reply).toMatch(/confirm/i);
    expect(r.reply).toContain('2:00 PM');
    expect(r.booked).toBeUndefined();
    r = await s.say('yes please');
    expect(r.booked).toMatchObject({ patient_name: 'Ana Reyes', patient_phone: '09171234567', appointment_date: '2026-11-16', appointment_time: '14:00', service_type: 'cleaning' });
    expect(s.draft).toBeNull();
    expect(r.speech).not.toMatch(/\d{4}-\d{2}-\d{2}|receipt\.html/);
  });

  it('accepts many details in one breath and only asks for what is missing', async () => {
    const s = session();
    const r = await s.say("I'd like a filling tomorrow at 10am, my name is Ben Cruz");
    expect(r.reply).toMatch(/mobile number/i);
    expect(r.draft).toMatchObject({ service: 'filling', date: '2026-11-10', time: '10:00', name: 'Ben Cruz' });
  });

  it('saying no to the confirmation lets the caller change something', async () => {
    const s = session();
    await s.say('book a cleaning tomorrow at 10am name Ana Reyes 09171234567'); // one-shot books directly
    const t = session();
    await t.say('I want whitening');
    await t.say('tomorrow');
    await t.say('11 am');
    await t.say('Cara Lim');
    let r = await t.say('09175550000');
    expect(r.reply).toMatch(/confirm/i);
    r = await t.say('no');
    expect(r.reply).toMatch(/change/i);
    r = await t.say('make it 1 pm');
    expect(r.reply).toContain('1:00 PM');
    r = await t.say('yes');
    expect(r.booked?.appointment_time).toBe('13:00');
  });

  it('a taken time offers other open times instead of failing', async () => {
    const db = makeMockDb();
    await session(db).say('book a cleaning tomorrow at 10am name Ana Reyes 09171234567');
    const s = session(db);
    await s.say('I want a cleaning');
    const r = await s.say('tomorrow at 10am');
    expect(r.reply).toMatch(/isn't open/);
    expect(r.reply).toContain('9:00 AM');
    expect(s.draft?.time).toBeUndefined();
  });

  it('closed days (Sunday) and past dates are refused politely', async () => {
    const s = session();
    await s.say('I want a cleaning');
    let r = await s.say('next Sunday');
    expect(r.reply).toMatch(/closed or fully booked/i);
    r = await s.say('2026-11-01');
    expect(r.reply).toMatch(/already passed/i);
  });

  it('toothache gets empathy, no medical advice, and a booking path', async () => {
    const s = session();
    const r = await s.say('I have a terrible toothache');
    expect(r.reply).toMatch(/sorry/i);
    expect(r.reply).toMatch(/can't give medical advice/i);
    expect(r.draft?.service).toBe('urgent dental concern');
  });

  it('"never mind" clears the conversation', async () => {
    const s = session();
    await s.say('I want a cleaning');
    const r = await s.say('never mind');
    expect(r.draft ?? null).toBeNull();
  });
});

describe('cancel and reschedule by conversation', () => {
  it('cancel asks for phone then finds the single upcoming appointment', async () => {
    const db = makeMockDb();
    await session(db).say('book a cleaning on 2026-11-10 at 10:00 name Ana Reyes 09171234567');
    const s = session(db);
    let r = await s.say('I need to cancel my appointment');
    expect(r.reply).toMatch(/mobile number/i);
    r = await s.say('09171234567');
    expect(r.reply).toMatch(/cancelled/i);
  });

  it('reschedule walks through new day then time', async () => {
    const db = makeMockDb();
    await session(db).say('book a cleaning on 2026-11-10 at 10:00 name Ana Reyes 09171234567');
    const s = session(db);
    let r = await s.say('I want to reschedule');
    expect(r.reply).toMatch(/mobile number/i);
    r = await s.say('09171234567');
    expect(r.reply).toMatch(/new day/i);
    r = await s.say('Wednesday');
    expect(r.reply).toContain('Nov 11th 2026');
    r = await s.say('3 pm');
    expect(r.reply).toMatch(/rescheduled/i);
  });
});

describe('clinic questions and safety', () => {
  it('answers hours, location, services without starting a booking', async () => {
    const s = session();
    expect((await s.say('What are your clinic hours?')).reply).toContain('San Nicolas');
    expect((await s.say('where are you located')).reply).toContain('Project 6');
    const sv = await s.say('what services do you offer');
    expect(sv.reply).toMatch(/cleaning/i);
    expect(sv.reply).toMatch(/don't have prices/i);
    expect(s.draft).toBeNull();
  });

  it('cleanDraft drops junk and invalid values from an untrusted client', () => {
    expect(cleanDraft({ intent: 'book', date: 'DROP TABLE', time: '25:99', name: 'x'.repeat(500), evil: 1, awaiting: 'hack' })).toEqual({ intent: 'book' });
    expect(cleanDraft('nope')).toBeNull();
    expect(cleanDraft({ date: '2026-11-10' })).toBeNull(); // no intent -> not a conversation
  });

  it('speech field is always speakable', async () => {
    const r = await handleChatMessage(makeMockDb() as never, 'what slots are open on 2026-11-10', null, TODAY);
    expect(r.speech).toContain('Nov 10th 2026');
    expect(r.speech).not.toMatch(/\d{2}:\d{2}(?! ?[AP]M)/);
  });
});

describe('Milky: greetings, who are you, and where is Milky', () => {
  it('greets back and offers to help, without starting a booking', async () => {
    const s = session();
    for (const hi of ['hello', 'Hi!', 'good morning', 'Mabuhay']) {
      const r = await s.say(hi);
      expect(r.reply).toMatch(/Milky/);
      expect(r.reply).toMatch(/help/i);
    }
    expect((await s.say('Good morning')).reply).toMatch(/^Good morning!/);
    expect(s.draft).toBeNull();
  });
  it('a greeting that already asks for something still goes to booking', async () => {
    const r = await session().say('hello I want a cleaning');
    expect(r.reply).toMatch(/Which day/i);
  });
  it('introduces itself', async () => {
    const r = await session().say('who are you?');
    expect(r.reply).toMatch(/Milky/);
    expect(r.reply).toMatch(/computer program/i);
  });
  it('"where is Milky?" answers and tells the page to show Milky', async () => {
    for (const q of ['where is milky', "Where's Milky?", 'I cannot find milky']) {
      const r = await session().say(q);
      expect(r.reply).toMatch(/right here/i);
      expect(r.client?.findMilky).toBe(true);
    }
  });
  it('"where are you located" is still the branches answer', async () => {
    expect((await session().say('where are you located')).reply).toContain('Project 6');
  });
});
