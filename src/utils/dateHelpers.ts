/** Returns today as YYYY-MM-DD in local time */
export function todayISO(): string {
  const d = new Date();
  return localDateStr(d);
}

/** Add N days to a YYYY-MM-DD string */
export function addDays(dateStr: string, n: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

/** All dates between start and end inclusive */
export function dateRange(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = parseLocalDate(start);
  const last = parseLocalDate(end);
  while (cur <= last) {
    days.push(localDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** "Fri 22 May" */
export function fmtDay(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

/** "22 May 2026" */
export function fmtFull(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Number of days in range inclusive */
export function dayCount(start: string, end: string): number {
  return dateRange(start, end).length;
}

// ── Helpers ───────────────────────────────────────────────────

/** Parse YYYY-MM-DD as a local-midnight Date (avoids UTC shift) */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as YYYY-MM-DD using local time components */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
