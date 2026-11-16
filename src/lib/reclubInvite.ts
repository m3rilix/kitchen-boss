/**
 * Parses a pasted Reclub invite into session setup fields. Expected shape:
 *
 *   FREE❗️NEW COURT❗️3C•4H•28P          ← session name (first line, kept as-is)
 *   ⏰ Mon, Nov 16 7:00 PM               ← date & time (no year)
 *   📍 Mactan Indoor Sports Arena        ← location
 *
 *   RSVP: https://reclub.co/m/7PP5TR     ← ignored, as are hours/player counts
 */

export interface ParsedInvite {
  name?: string;
  location?: string;
  date?: string;        // YYYY-MM-DD
  time?: string;        // HH:MM (24h)
  courtCount?: number;
  /** More than one invite was pasted; only the first was used. */
  extraInvitesIgnored: boolean;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// "Mon, Nov 16 7:00 PM" — weekday optional, comma optional
const DATE_TIME_RE = /(?:\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s+)?\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?/i;
// "3C", "2C |", "3H-2C-20P", "3 courts" — digit not glued to a preceding letter/digit
const COURTS_RE = /(?:^|[^\w])(\d{1,2})\s*(?:c|courts?)(?![a-z])/i;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The invite has no year. Pick the year (this, next, or last) whose calendar date
 * falls on the stated weekday; without a weekday, take the nearest upcoming one.
 */
function resolveYear(month: number, day: number, weekday: number | null, today: Date): number {
  const base = today.getFullYear();
  const candidates = [base, base + 1, base - 1];
  if (weekday !== null) {
    const match = candidates.find(y => new Date(y, month, day).getDay() === weekday);
    if (match !== undefined) return match;
  }
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return new Date(base, month, day) >= startOfToday ? base : base + 1;
}

export function parseReclubInvite(text: string, today: Date = new Date()): ParsedInvite {
  const lines = text.split(/\r?\n/).map(l => l.trim());
  const firstContent = lines.findIndex(l => l.length > 0);
  const result: ParsedInvite = { extraInvitesIgnored: false };
  if (firstContent === -1) return result;

  // An invite ends at its RSVP link; anything after that is another invite.
  const rsvpIdx = lines.findIndex((l, i) => i >= firstContent && /^rsvp\b|reclub\.co\//i.test(l));
  const inviteLines = rsvpIdx === -1 ? lines.slice(firstContent) : lines.slice(firstContent, rsvpIdx + 1);
  if (rsvpIdx !== -1) {
    result.extraInvitesIgnored = lines.slice(rsvpIdx + 1).some(l => l.length > 0);
  }
  const content = inviteLines.filter(l => l.length > 0);

  const dateLine = content.find(l => l.includes('⏰')) ?? content.find(l => DATE_TIME_RE.test(l));
  const locationLine = content.find(l => l.includes('📍'));
  const nameLine = content[0] !== dateLine && content[0] !== locationLine ? content[0] : undefined;

  if (nameLine) result.name = nameLine;

  if (locationLine) {
    const loc = locationLine.replace(/📍/gu, '').trim();
    if (loc) result.location = loc;
  }

  const dt = dateLine?.match(DATE_TIME_RE);
  if (dt) {
    const [, wd, mon, dayStr, hourStr, minStr, ampm] = dt;
    const month = MONTHS.indexOf(mon.toLowerCase().slice(0, 3));
    const day = Number(dayStr);
    const weekday = wd ? WEEKDAYS.indexOf(wd.toLowerCase().slice(0, 3)) : null;
    let hour = Number(hourStr) % 12;
    if (ampm.toLowerCase() === 'p') hour += 12;
    const minute = minStr ? Number(minStr) : 0;
    if (day >= 1 && day <= 31 && hour < 24 && minute < 60) {
      const year = resolveYear(month, day, weekday, today);
      result.date = `${year}-${pad(month + 1)}-${pad(day)}`;
      result.time = `${pad(hour)}:${pad(minute)}`;
    }
  }

  // Court count usually lives in the title ("3C•4H•28P"); check it first.
  const courtSource = [nameLine, ...content.filter(l => l !== nameLine && l !== dateLine && !/reclub\.co\//i.test(l))];
  for (const line of courtSource) {
    const m = line?.match(COURTS_RE);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 10) result.courtCount = n;
      break;
    }
  }

  return result;
}
