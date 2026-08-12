/**
 * CNPJ numérico e alfanumérico (IN RFB 2.229/2024).
 * Máscara: XX.XXX.XXX/XXXX-DV
 */

const CNPJ_BASE_REGEX = /^[A-Z0-9]{12}\d{2}$/;

export function onlyCnpjChars(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function valorDv(char: string): number {
  return char.charCodeAt(0) - 48;
}

function calcularDigito(base: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += valorDv(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function isCnpjValido(value: string): boolean {
  const limpo = onlyCnpjChars(value);
  if (limpo.length !== 14) return false;
  if (!CNPJ_BASE_REGEX.test(limpo)) return false;
  if (/^\d{14}$/.test(limpo) && /^(\d)\1{13}$/.test(limpo)) return false;

  const corpo = limpo.slice(0, 12);
  const dv1 = calcularDigito(corpo);
  const dv2 = calcularDigito(corpo + String(dv1));
  return limpo.slice(12) === `${dv1}${dv2}`;
}

export function formatCnpj(value: string): string {
  let limpo = onlyCnpjChars(value).slice(0, 14);
  if (limpo.length > 12) {
    const corpo = limpo.slice(0, 12);
    const dv = limpo.slice(12).replace(/\D/g, '');
    limpo = (corpo + dv).slice(0, 14);
  }
  if (limpo.length !== 14) return limpo;
  return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8, 12)}-${limpo.slice(12)}`;
}
