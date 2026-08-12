/** Express 5 tipa params como string | string[]; Prisma exige string. */
export function param(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] : value);
}
