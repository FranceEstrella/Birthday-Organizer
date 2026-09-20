import { describe, expect, it } from 'vitest';
import { birthdayLabel, getDaysUntilBirthday, getNextBirthday } from './birthday';

describe('birthday calculations', () => {
  const today = new Date(2026, 8, 20);

  it('returns today, tomorrow, and upcoming labels', () => {
    expect(getDaysUntilBirthday('1990-09-20', today)).toBe(0);
    expect(birthdayLabel('1990-09-21', today)).toBe('Tomorrow');
    expect(birthdayLabel('1990-09-28', today)).toBe('8 days');
  });

  it('rolls a passed birthday into the following year', () => {
    const next = getNextBirthday('1990-09-19', today);
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(8);
    expect(next.getDate()).toBe(19);
  });

  it('handles the new year boundary', () => {
    const december = new Date(2026, 11, 31);
    expect(getDaysUntilBirthday('1990-01-01', december)).toBe(1);
  });

  it('treats February 29 as February 28 in non-leap years', () => {
    const next = getNextBirthday('2000-02-29', new Date(2025, 0, 1));
    expect(next.getFullYear()).toBe(2025);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(28);
  });
});
