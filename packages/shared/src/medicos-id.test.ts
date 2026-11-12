import { describe, expect, it } from 'vitest';
import { randomInt } from 'node:crypto';
import {
  CROCKFORD_ALPHABET,
  generateMedicosId,
  isValidMedicosId,
  medicosIdFromBody,
  normalizeMedicosId,
} from './medicos-id';

describe('Medicos ID', () => {
  it('generates IDs in MED-XXXX-XXXX format that validate', () => {
    for (let i = 0; i < 500; i++) {
      const id = generateMedicosId(randomInt);
      expect(id).toMatch(/^MED-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      expect(isValidMedicosId(id)).toBe(true);
    }
  });

  it('never contains ambiguous letters I, L, O, U', () => {
    for (let i = 0; i < 500; i++) expect(generateMedicosId(randomInt)).not.toMatch(/[ILOU]/);
  });

  it('detects every single-character substitution', () => {
    const id = medicosIdFromBody('7K4P29X');
    const chars = id.replace(/MED|-/g, '');
    for (let pos = 0; pos < chars.length; pos++) {
      for (const c of CROCKFORD_ALPHABET) {
        if (c === chars[pos]) continue;
        const mutated = chars.slice(0, pos) + c + chars.slice(pos + 1);
        expect(normalizeMedicosId(mutated)).toBeNull();
      }
    }
  });

  it('detects adjacent transpositions of different characters', () => {
    const chars = medicosIdFromBody('7K4P29X').replace(/MED|-/g, '');
    for (let pos = 0; pos < chars.length - 1; pos++) {
      if (chars[pos] === chars[pos + 1]) continue;
      const swapped = chars.slice(0, pos) + chars[pos + 1] + chars[pos] + chars.slice(pos + 2);
      expect(normalizeMedicosId(swapped)).toBeNull();
    }
  });

  it('normalises lowercase, spaces and Crockford look-alikes', () => {
    const id = medicosIdFromBody('10ABCDE');
    const messy = id.toLowerCase().replace(/-/g, ' ').replace('1', 'l').replace('0', 'o');
    expect(normalizeMedicosId(messy)).toBe(id);
  });

  it('rejects garbage', () => {
    expect(normalizeMedicosId('')).toBeNull();
    expect(normalizeMedicosId('MED-1234')).toBeNull();
    expect(normalizeMedicosId('MED-UUUU-UUUU')).toBeNull();
    expect(isValidMedicosId('med-7k4p-29xq')).toBe(false);
  });
});
