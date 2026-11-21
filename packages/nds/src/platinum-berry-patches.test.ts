import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLATINUM_BERRY_PATCH_COUNT,
  readPlatinumBerryPatches,
} from './platinum-berry-patches.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum berry patches', () => {
  it.skipIf(!savePath)(
    'reads every patch from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const patches =
        readPlatinumBerryPatches(save);

      expect(patches).toHaveLength(
        PLATINUM_BERRY_PATCH_COUNT,
      );

      const occupied = patches.flatMap(
        (patch, index) =>
          patch.berryId === 0
            ? []
            : [{ index, ...patch }],
      );

      console.log('berry patches:', {
        total: patches.length,
        occupiedCount: occupied.length,
        occupied,
      });
    },
  );
});