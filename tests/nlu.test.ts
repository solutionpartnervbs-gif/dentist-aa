import { describe, expect, it } from 'vitest';
import { isNo, isYes, looksLikeBareName, parseDate, parseName, parsePhone, parseService, parseTime, spokenDate, spokenTime, toSpeech } from '../src/nlu';

const MON = '2026-11-09'; // a Monday

describe('parseDate', () => {
  it('relative', () => {
    expect(parseDate('book me tomorrow', MON)).toBe('2026-11-10');
    expect(parseDate('day after tomorrow', MON)).toBe('2026-11-11');
    expect(parseDate('today please', MON)).toBe(MON);
  });
  it('weekdays: plain = soonest upcoming, strictly after today', () => {
    expect(parseDate('on Friday', MON)).toBe('2026-11-13');
    expect(parseDate('monday', MON)).toBe('2026-11-16');
    expect(parseDate('this Wednesday', MON)).toBe('2026-11-11');
  });
  it('"next <weekday>" means next week when this week still has it', () => {
    expect(parseDate('next Monday', MON)).toBe('2026-11-16');
    expect(parseDate('next Friday', MON)).toBe('2026-11-20');
    expect(parseDate('next Monday', '2026-11-12')).toBe('2026-11-16'); // Thursday -> following Monday
  });
  it('month names, with and without year', () => {
    expect(parseDate('November 20th', MON)).toBe('2026-11-20');
    expect(parseDate('20 nov', MON)).toBe('2026-11-20');
    expect(parseDate('the 3rd of January', MON)).toBe('2027-01-03');
    expect(parseDate('Nov 3, 2027', MON)).toBe('2027-11-03');
  });
  it('iso and garbage', () => {
    expect(parseDate('2026-12-01', MON)).toBe('2026-12-01');
    expect(parseDate('2026-13-45', MON)).toBeNull();
    expect(parseDate('hello there', MON)).toBeNull();
  });
});

describe('parseTime', () => {
  it.each([
    ['2pm', '14:00'], ['2 PM', '14:00'], ['10:30 a.m.', '10:30'], ['12 pm', '12:00'], ['12am', '00:00'],
    ['14:00', '14:00'], ['noon', '12:00'], ['two pm', '14:00'], ['ten in the morning', '10:00'],
    ["three o'clock", '15:00'], ['at 10', '10:00'], ['at 3', '15:00'], ['at 12', '12:00'],
  ])('%s -> %s', (input, out) => expect(parseTime(input)).toBe(out));
  it('no time', () => expect(parseTime('book a cleaning')).toBeNull());
});

describe('parsePhone', () => {
  it('digits', () => expect(parsePhone('my number is 0917 123 4567')).toBe('09171234567'));
  it('spoken digits', () =>
    expect(parsePhone('zero nine one seven one two three four five six seven')).toBe('09171234567'));
  it('ignores dates/times', () => expect(parsePhone('on 2026-11-10 at 10:00')).toBeNull());
});

describe('names, services, yes/no', () => {
  it('parseName', () => {
    expect(parseName('my name is ana reyes')).toBe('Ana Reyes');
    expect(parseName("I'm Ben and my number is 0917")).toBe('Ben');
    expect(parseName('name Ana, 09170000001')).toBe('Ana');
    expect(parseName("I'm looking for a cleaning")).toBeNull();
  });
  it('bare name only when it really is one', () => {
    expect(looksLikeBareName('Ana Reyes')).toBe('Ana Reyes');
    expect(looksLikeBareName('yes please')).toBeNull();
    expect(looksLikeBareName('what are your hours')).toBeNull();
  });
  it('parseService', () => {
    expect(parseService('teeth cleaning')).toBe('cleaning');
    expect(parseService('I have a toothache')).toBe('urgent dental concern');
    expect(parseService('my wisdom tooth needs to go')).toBe('extraction');
    expect(parseService('whitening')).toBe('whitening');
    expect(parseService('hello')).toBeNull();
  });
  it('yes/no incl. Filipino', () => {
    expect(isYes('Yes please')).toBe(true);
    expect(isYes('sige')).toBe(true);
    expect(isNo('no, change it')).toBe(true);
    expect(isYes('nothing')).toBe(false);
  });
});

describe('speech formatting', () => {
  it('never double-converts times that are already 12-hour', () => {
    expect(toSpeech('We have 9:00 AM, 1:00 PM and 2:00 PM at our San Nicolas Branch.')).toBe('We have 9:00 AM, 1:00 PM and 2:00 PM at our San Nicolas Branch.');
    expect(toSpeech('Open slots: 09:00, 13:00')).toBe('Open slots: 9:00 AM, 1:00 PM');
  });
  it('spoken date/time', () => {
    expect(spokenDate('2026-11-10')).toBe('Nov 10th 2026');
    expect(spokenTime('13:00')).toBe('1:00 PM');
  });
  it('toSpeech removes ISO, 24h, urls, markdown, emoji', () => {
    const s = toSpeech("📄 **Official Proof**\n• Ref: SUYAT-ABCD\n• Date & Time: 2026-11-10 at 13:00\nView & print digital receipt: /receipt.html?id=abc-123");
    expect(s).not.toMatch(/\d{4}-\d{2}-\d{2}|\*\*|📄|receipt\.html|https?:/);
    expect(s).toContain('Nov 10th 2026');
    expect(s).toContain('1:00 PM');
  });
});
