export function parseBirthday(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function birthdayDateForYear(birthday, year) {
  const day = birthday.month === 2 && birthday.day === 29 && !isLeapYear(year) ? 28 : birthday.day;
  return new Date(year, birthday.month - 1, day);
}

export function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function getNextBirthday(value, today = new Date()) {
  const birthday = parseBirthday(value);
  if (!birthday) return null;
  const currentYearBirthday = birthdayDateForYear(birthday, today.getFullYear());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (currentYearBirthday < todayDate) return birthdayDateForYear(birthday, today.getFullYear() + 1);
  return currentYearBirthday;
}

export function getDaysUntilBirthday(value, today = new Date()) {
  const next = getNextBirthday(value, today);
  if (!next) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((next - start) / 86400000);
}

export function birthdayLabel(value, today = new Date()) {
  const days = getDaysUntilBirthday(value, today);
  if (days === null) return 'No birthday';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

export function formatBirthday(value, options = { month: 'short', day: 'numeric' }) {
  const birthday = parseBirthday(value);
  if (!birthday) return 'Not set';
  return new Intl.DateTimeFormat('en-US', options).format(new Date(2000, birthday.month - 1, birthday.day));
}

export function getMonthDays(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
