import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  readPlatinumPokedex,
  readPlatinumSpeciesBitmap,
} from './platinum-pokedex.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum Pokédex', () => {
  it('maps species IDs to bitmap bits', () => {
    const bitmap = new Uint8Array(0x40);

    bitmap[0] = 0b00000001;
    bitmap[3] = 0b10000000;
    bitmap[4] = 0b00000001;
    bitmap[61] = 0b00010000;

    expect(
      readPlatinumSpeciesBitmap(bitmap),
    ).toEqual([1, 32, 33, 493]);
  });

  it('rejects a truncated bitmap', () => {
    expect(() =>
      readPlatinumSpeciesBitmap(
        new Uint8Array(0x3f),
      ),
    ).toThrow(/truncated/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum Pokédex',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const pokedex = readPlatinumPokedex(save);

      expect(pokedex.obtained).toBe(true);
      expect(pokedex.seen.length).toBeGreaterThan(0);
      expect(pokedex.caught.length).toBeGreaterThan(0);

      for (const species of pokedex.caught) {
        expect(pokedex.seen).toContain(species);
      }

      console.log('pokedex:', {
        obtained: pokedex.obtained,
        national: pokedex.national,
        seenCount: pokedex.seen.length,
        caughtCount: pokedex.caught.length,
        seen: pokedex.seen,
        caught: pokedex.caught,
      });
    },
  );
});