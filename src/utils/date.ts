/**
 * Date formatting helpers for the SBEK automation system.
 */

/** Format a Date as YYYY-MM-DD */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Format a Date as a human-readable string: "27 Feb 2026" */
export function formatDateHuman(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Add days to a date and return a new Date */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Subtract days from a date and return a new Date */
export function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

/** Check if a date is more than N days ago */
export function isOlderThanDays(date: Date, days: number): boolean {
  const cutoff = subtractDays(new Date(), days);
  return date < cutoff;
}

/** Calculate business days between two dates (Mon-Sat for India) */
export function businessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current < end) {
    const day = current.getDay();
    if (day !== 0) count++; // Skip Sundays only (Indian business week is Mon-Sat)
    current.setDate(current.getDate() + 1);
  }
  return count;
}
