const HOSPITAL_TIMEZONE = process.env.HOSPITAL_TIMEZONE || 'Asia/Kolkata';

/**
 * Returns current UTC ISO string.
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Adds minutes to a Date (or ISO string) and returns UTC ISO string.
 */
function addMinutesIso(dateOrIso, minutes) {
  const d = dateOrIso ? new Date(dateOrIso) : new Date();
  return new Date(d.getTime() + minutes * 60000).toISOString();
}

/**
 * Converts a 12h slot string ("10:30 AM") or 24h string ("10:30") to minutes since midnight.
 */
function timeStringToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }

  const h24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const h = parseInt(h24Match[1], 10);
    const m = parseInt(h24Match[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  return null;
}

/**
 * Converts minutes since midnight to "10:30 AM" format.
 */
function minutesToTime12(totalMinutes) {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const h12 = h24 > 12 ? h24 - 12 : h24 === 0 ? 12 : h24;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Converts minutes since midnight to "HH:MM" 24-hour format.
 */
function minutesToTime24(totalMinutes) {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Parses hospital-local YYYY-MM-DD + time slot ("10:30 AM" or "10:30") into a UTC Date.
 * Uses fixed IST (+05:30) offset when timezone is Asia/Kolkata, or Intl fallback.
 */
function hospitalLocalToUtcDate(dateStr, timeStr) {
  const mins = timeStringToMinutes(timeStr);
  if (!dateStr || mins === null) return null;
  const hhmm = minutesToTime24(mins);
  // Asia/Kolkata is UTC+05:30 with no DST
  if (HOSPITAL_TIMEZONE === 'Asia/Kolkata') {
    return new Date(`${dateStr}T${hhmm}:00+05:30`);
  }
  return new Date(`${dateStr}T${hhmm}:00Z`);
}

/**
 * Formats a UTC Date / ISO timestamp in the configured hospital timezone.
 */
function formatInHospitalTimezone(dateOrIso, tz = HOSPITAL_TIMEZONE) {
  if (!dateOrIso) return null;
  const d = new Date(dateOrIso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(d);
}

/**
 * Returns today's YYYY-MM-DD in the hospital's configured timezone.
 */
function getHospitalTodayDateStr(tz = HOSPITAL_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  return parts;
}

/**
 * Returns day abbreviation ('Sun','Mon',...) for YYYY-MM-DD.
 */
function getDayAbbrev(dateStr) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const d = new Date(`${dateStr}T00:00:00+05:30`);
  return dayNames[d.getDay()];
}

/**
 * Checks whether two [startA, endA) and [startB, endB) minute intervals overlap.
 */
function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

module.exports = {
  HOSPITAL_TIMEZONE,
  nowIso,
  addMinutesIso,
  timeStringToMinutes,
  minutesToTime12,
  minutesToTime24,
  hospitalLocalToUtcDate,
  formatInHospitalTimezone,
  getHospitalTodayDateStr,
  getDayAbbrev,
  intervalsOverlap
};
