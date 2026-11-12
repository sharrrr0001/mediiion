/**
 * Medicos ID: `MED-XXXX-XXXX`.
 * 7 random Crockford base32 characters + 1 Luhn mod-32 check character.
 * Crockford base32 excludes I, L, O, U so IDs are easy to read aloud and type.
 */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const N = CROCKFORD_ALPHABET.length; // 32
const BODY_LENGTH = 7;

export const MEDICOS_ID_PATTERN = /^MED-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

function codeOf(ch: string): number {
  const i = CROCKFORD_ALPHABET.indexOf(ch);
  if (i < 0) throw new Error(`Invalid Medicos ID character: ${ch}`);
  return i;
}

function luhnSum(chars: string, startFactor: 1 | 2): number {
  let factor = startFactor;
  let sum = 0;
  for (let i = chars.length - 1; i >= 0; i--) {
    let addend = factor * codeOf(chars[i] as string);
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / N) + (addend % N);
    sum += addend;
  }
  return sum;
}

/** Luhn mod N check character for `body` (Crockford base32 string). */
export function checkChar(body: string): string {
  const sum = luhnSum(body, 2);
  return CROCKFORD_ALPHABET[(N - (sum % N)) % N] as string;
}

function format(chars8: string): string {
  return `MED-${chars8.slice(0, 4)}-${chars8.slice(4, 8)}`;
}

/** Build a Medicos ID from 7 body characters (used by seeds/tests). */
export function medicosIdFromBody(body: string): string {
  if (body.length !== BODY_LENGTH) throw new Error('Medicos ID body must be 7 characters');
  return format(body + checkChar(body));
}

/** Generate a new random Medicos ID. `randomInt(max)` must be cryptographically secure. */
export function generateMedicosId(randomInt: (max: number) => number): string {
  let body = '';
  for (let i = 0; i < BODY_LENGTH; i++) body += CROCKFORD_ALPHABET[randomInt(N)];
  return medicosIdFromBody(body);
}

/**
 * Normalise user input ("med 7k4p 29xq", "MED-7K4P-29XQ") to canonical form,
 * applying Crockford decoding (O→0, I/L→1). Returns null if it is not a valid ID.
 */
export function normalizeMedicosId(input: string): string | null {
  let s = input.toUpperCase().replace(/[\s-]/g, '');
  if (s.startsWith('MED')) s = s.slice(3);
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1');
  if (s.length !== BODY_LENGTH + 1) return null;
  if (![...s].every((c) => CROCKFORD_ALPHABET.includes(c))) return null;
  if (luhnSum(s, 1) % N !== 0) return null;
  return format(s);
}

export function isValidMedicosId(input: string): boolean {
  return MEDICOS_ID_PATTERN.test(input) && normalizeMedicosId(input) === input;
}
