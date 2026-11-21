import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodePlatinumPoffinCase,
  PLATINUM_POFFIN_CASE_SIZE,
  readPlatinumPoffinCase,
} from './platinum-poffins.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function emptyCase(): Uint8Array {
  const bytes = new Uint8Array(
    PLATINUM_POFFIN_CASE_SIZE,
  );

  for (let slot = 0; slot < 100; slot++) {
    bytes[slot * 8] = 30;
  }

  return bytes;
}

describe('Platinum Poffin Case', () => {
  it('reads occupied slots and skips empty ones', () => {
    const bytes = emptyCase();

    bytes.set(
      [
        4,
        10,
        20,
        30,
        40,
        50,
        60,
        0,
      ],
      0,
    );

    bytes.set(
      [
        28,
        1,
        2,
        3,
        4,
        5,
        6,
        0,
      ],
      2 * 8,
    );

    expect(
      decodePlatinumPoffinCase(bytes),
    ).toEqual([
      {
        type: 4,
        flavors: [10, 20, 30, 40, 50],
        smoothness: 60,
      },
      {
        type: 28,
        flavors: [1, 2, 3, 4, 5],
        smoothness: 6,
      },
    ]);
  });

  it('rejects a truncated case', () => {
    expect(() =>
      decodePlatinumPoffinCase(
        new Uint8Array(
          PLATINUM_POFFIN_CASE_SIZE - 1,
        ),
      ),
    ).toThrow(/truncated/i);
  });

  it('rejects reserved Poffin type 29', () => {
    const bytes = emptyCase();
    bytes[0] = 29;

    expect(() =>
      decodePlatinumPoffinCase(bytes),
    ).toThrow(/type 29 in slot 0/i);
  });

  it('rejects an invalid Poffin type', () => {
    const bytes = emptyCase();
    bytes[0] = 255;

    expect(() =>
      decodePlatinumPoffinCase(bytes),
    ).toThrow(/type 255 in slot 0/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum Poffin Case',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const poffins =
        readPlatinumPoffinCase(save);

      console.log('poffins:', {
        count: poffins.length,
        poffins,
      });

      expect(poffins.length).toBeLessThanOrEqual(
        100,
      );

      for (const poffin of poffins) {
        expect(poffin.type).toBeGreaterThanOrEqual(
          0,
        );
        expect(poffin.type).toBeLessThan(29);
        expect(poffin.flavors).toHaveLength(5);
      }
    },
  );
});
