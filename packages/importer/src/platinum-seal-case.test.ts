import { readFileSync } from 'node:fs';
import type {
  GameState,
} from '@opensinnoh/contracts';
import type {
  PlatinumSealCase,
} from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumSealCase,
  convertPlatinumSealCase,
} from './platinum-seal-case.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum Seal Case import', () => {
  it('copies loose counts and capsules', () => {
    const raw: PlatinumSealCase = {
      counts: Array.from(
        { length: 80 },
        (_, id) => (id === 4 ? 6 : 0),
      ),
      capsules: Array.from(
        { length: 12 },
        (_, capsule) =>
          capsule === 2
            ? [
                {
                  seal: 5,
                  x: 190,
                  y: 70,
                },
                {
                  seal: 80,
                  x: 145,
                  y: 90,
                },
              ]
            : [],
      ),
    };

    const converted =
      convertPlatinumSealCase(raw);

    expect(converted.counts[4]).toBe(6);
    expect(converted.capsules[2]).toEqual([
      {
        seal: 5,
        x: 190,
        y: 70,
      },
      {
        seal: 80,
        x: 145,
        y: 90,
      },
    ]);

    expect(converted.counts).not.toBe(
      raw.counts,
    );
    expect(converted.capsules).not.toBe(
      raw.capsules,
    );
    expect(converted.capsules[2]).not.toBe(
      raw.capsules[2],
    );
  });

  it.skipIf(!savePath)(
    'applies a real Platinum Seal Case',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = {
        sealCase: {
          counts: new Array(80).fill(9),
          capsules: Array.from(
            { length: 12 },
            () => [
              {
                seal: 1,
                x: 190,
                y: 70,
              },
            ],
          ),
        },
      } as unknown as GameState;

      const converted =
        applyPlatinumSealCase(base, save);

      console.log(
        'converted seal case:',
        converted.sealCase,
      );

      expect(converted.sealCase.counts).toEqual(
        new Array(80).fill(0),
      );

      expect(
        converted.sealCase.capsules,
      ).toEqual(
        Array.from({ length: 12 }, () => []),
      );
    },
  );
});
