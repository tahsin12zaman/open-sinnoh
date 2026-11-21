import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import type { PlatinumPoffin } from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumPoffins,
  convertPlatinumPoffin,
} from './platinum-poffins.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum Poffin import', () => {
  it('converts every Poffin attribute', () => {
    const native: PlatinumPoffin = {
      type: 17,
      flavors: [10, 20, 30, 40, 50],
      smoothness: 60,
    };

    expect(
      convertPlatinumPoffin(native),
    ).toEqual({
      type: 17,
      flavors: [10, 20, 30, 40, 50],
      smoothness: 60,
    });
  });

  it('copies the flavor tuple', () => {
    const native: PlatinumPoffin = {
      type: 4,
      flavors: [1, 2, 3, 4, 5],
      smoothness: 6,
    };

    const converted =
      convertPlatinumPoffin(native);

    native.flavors[0] = 99;

    expect(converted.flavors).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it.skipIf(!savePath)(
    'applies a real Platinum Poffin Case',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = {
        poffins: [
          {
            type: 1,
            flavors: [1, 1, 1, 1, 1],
            smoothness: 1,
          },
        ],
      } as unknown as GameState;

      const converted =
        applyPlatinumPoffins(base, save);

      console.log(
        'converted poffins:',
        converted.poffins,
      );

      expect(converted.poffins).toEqual([]);
      expect(base.poffins).toHaveLength(1);
    },
  );
});
