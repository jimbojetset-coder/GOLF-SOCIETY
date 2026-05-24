/** Returns today as YYYY-MM-DD in local time */
export function todayISO(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

/** Add N days to a YYYY-MM-DD string */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

/** All dates between start and end inclusive */
export function dateRange(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    days.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** "Fri 22 May" */
export function fmtDay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

/** "22 May 2026" */
export function fmtFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Number of days in range inclusive */
export function dayCount(start: string, end: string): number {
  return dateRange(start, end).length;
}
