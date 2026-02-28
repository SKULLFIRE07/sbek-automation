/**
 * Input sanitization for data written to Google Sheets and other destinations.
 */

/** Strip characters that could cause formula injection in spreadsheets */
export function sanitizeForSheets(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = String(value);

  // Prevent spreadsheet formula injection: prefix dangerous first chars with apostrophe
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }

  return str;
}

/** Sanitize a row of values for Google Sheets */
export function sanitizeRow(row: Record<string, unknown>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    sanitized[key] = sanitizeForSheets(value);
  }
  return sanitized;
}

/** Truncate a string to a max length, adding ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/** Strip HTML tags from a string */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/** Normalize a phone number to E.164 format (assuming Indian +91) */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  return `+${digits}`;
}
