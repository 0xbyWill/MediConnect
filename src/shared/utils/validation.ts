import { digitsOnly } from './cpf';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeEmail(value = '') {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return EMAIL_RE.test(normalizeEmail(value));
}

export function normalizePhoneBR(value = '') {
  return digitsOnly(value).slice(0, 11);
}

export function isValidPhoneBR(value: string, required = true) {
  const digits = normalizePhoneBR(value);
  if (!digits) return !required;
  return digits.length === 10 || digits.length === 11;
}

export function formatPhoneBR(value: string) {
  const digits = normalizePhoneBR(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function normalizeCep(value = '') {
  return digitsOnly(value).slice(0, 8);
}

export function formatCep(value: string) {
  const digits = normalizeCep(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isValidCep(value: string, required = false) {
  const digits = normalizeCep(value);
  if (!digits) return !required;
  return digits.length === 8;
}

export function normalizeDecimalText(value = '') {
  return value.trim().replace(',', '.');
}

export function isValidISODate(value: string) {
  return ISO_DATE_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

export function isValidTime(value: string) {
  return TIME_RE.test(value);
}

export function validateImageFile(file: File, maxSizeMb = 2): string | null {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) return 'Use uma imagem JPG, PNG ou WebP.';
  if (file.size > maxSizeMb * 1024 * 1024) return `A imagem deve ter no maximo ${maxSizeMb} MB.`;
  return null;
}

export function validatePdfFile(file: File, maxSizeMb = 10): string | null {
  if (file.type !== 'application/pdf') return 'Use um arquivo PDF valido.';
  if (file.size > maxSizeMb * 1024 * 1024) return `O PDF deve ter no maximo ${maxSizeMb} MB.`;
  return null;
}
