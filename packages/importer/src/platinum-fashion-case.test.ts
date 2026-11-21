import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import type { PlatinumFashionCase } from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumFashionCase,
  convertPlatinumFashionCase,
} from './platinum-fashion-case.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum Fashion Case import', () => {
  it('copies accessories and backdrops', () => {
    const native: PlatinumFashionCase = {
      accessories: Array.from(
        { length: 100 },
        (_, id) => id % 3,
      ),
      backdrops: [3, 1, 7],
    };

    const converted =
      convertPlatinumFashionCase(native);

    expect(converted).toEqual(native);

    native.accessories[0] = 99;
    native.backdrops[0] = 99;

    expect(converted.accessories[0]).toBe(0);
    expect(converted.backdrops[0]).toBe(3);
  });

  it.skipIf(!savePath)(
    'applies a real Platinum Fashion Case',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const converted =
        applyPlatinumFashionCase(
          {
            fashionCase: {
              accessories: [],
              backdrops: [],
            },
          } as unknown as GameState,
          save,
        );

      const occupied =
        converted.fashionCase.accessories
          .map((count, id) => ({
            id,
            count,
          }))
          .filter(
            ({ count }) => count !== 0,
          );

      console.log(
        'converted fashion case:',
        {
          occupied,
          backdrops:
            converted.fashionCase.backdrops,
        },
      );

      expect(occupied).toHaveLength(8);
      expect(
        converted.fashionCase.backdrops,
      ).toEqual([0, 3, 1]);
    },
  );
});
