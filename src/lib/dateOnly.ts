/**
 * Formats a Prisma DATE / UTC-midnight Instant as YYYY-MM-DD
 * using UTC calendar parts so the key never shifts a day in
 * America/Sao_Paulo (or any negative-offset timezone).
 */
export function toDateOnlyKey(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
