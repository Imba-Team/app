import {
  addDaysToDateString,
  isValidTimeZone,
  localDateString,
} from './timezone.util';

describe('timezone util', () => {
  it('formats the local calendar day in the given zone', () => {
    // 20:30 UTC is already the next day in Baku (UTC+4).
    const ref = new Date('2026-10-27T20:30:00Z');
    expect(localDateString('UTC', ref)).toBe('2026-10-27');
    expect(localDateString('Asia/Baku', ref)).toBe('2026-10-28');
    // And still the previous day in Los Angeles at 03:00 UTC.
    expect(
      localDateString('America/Los_Angeles', new Date('2026-10-28T03:00:00Z')),
    ).toBe('2026-10-27');
  });

  it('falls back to the UTC day for an unknown zone', () => {
    const ref = new Date('2026-10-27T23:30:00Z');
    expect(localDateString('Not/AZone', ref)).toBe('2026-10-27');
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
  });

  it('shifts calendar dates across month and year ends', () => {
    expect(addDaysToDateString('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToDateString('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDaysToDateString('2026-10-27', -29)).toBe('2026-09-28');
  });
});
