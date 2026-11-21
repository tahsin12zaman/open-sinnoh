import { readFileSync } from 'node:fs';
import type {
  GameState,
  Registries,
} from '@opensinnoh/contracts';
import { describe, expect, it } from 'vitest';
import { applyPlatinumDaycare } from './platinum-daycare.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum daycare import', () => {
  it.skipIf(!savePath)(
    'imports an empty real Platinum daycare',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      /*
       * This particular save has no deposited Pokémon,
       * so species registries are not accessed.
       */
      const imported = applyPlatinumDaycare(
        {} as GameState,
        save,
        {} as Registries,
      );

      expect(imported.daycare).toEqual({
        mons: [null, null],
        offspring: 0,
        stepCounter: 251,
      });
    },
  );
});