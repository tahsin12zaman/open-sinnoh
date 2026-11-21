import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePlatinumBoxPokemon } from './platinum-box-pokemon-data.ts';
import { readPlatinumDaycare } from './platinum-daycare.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum daycare', () => {
  it.skipIf(!savePath)(
    'reads a real Platinum daycare',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const daycare = readPlatinumDaycare(save);

      expect(daycare.mons).toHaveLength(2);
      expect(daycare.stepCounter).toBeGreaterThanOrEqual(
        0,
      );
      expect(daycare.stepCounter).toBeLessThanOrEqual(
        0xff,
      );

      console.log('daycare:', {
        offspring: daycare.offspring,
        stepCounter: daycare.stepCounter,
        mons: daycare.mons.map((entry) =>
          entry === null
            ? null
            : {
                species:
                  parsePlatinumBoxPokemon(
                    entry.pokemon,
                  ).species,
                steps: entry.steps,
              },
        ),
      });
    },
  );
});