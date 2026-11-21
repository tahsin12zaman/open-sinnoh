import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import { describe, expect, it } from 'vitest';
import { applyPlatinumBerryPatches } from './platinum-berry-patches.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum berry-patch import', () => {
  it.skipIf(!savePath)(
    'converts a real save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const imported =
        applyPlatinumBerryPatches(
          {
            berryPatches: [],
          } as unknown as GameState,
          save,
        );

      expect(imported.berryPatches).toHaveLength(
        118,
      );

      for (const patch of imported.berryPatches) {
        if (patch.berry !== null) {
          expect(patch.berry).toMatch(
            /^platinum:ITEM_/,
          );
        }

        if (patch.mulch !== null) {
          expect(patch.mulch).toMatch(
            /^platinum:ITEM_/,
          );
        }
      }

      console.log('converted berry patches:', {
        total: imported.berryPatches.length,
        occupied:
          imported.berryPatches.filter(
            (patch) => patch.berry !== null,
          ).length,
      });
    },
  );
});