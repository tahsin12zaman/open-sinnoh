import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPlatinumMiscData } from './platinum-misc.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum miscellaneous save data', () => {
  it.skipIf(!savePath)(
    'reads a real Platinum MiscSaveBlock',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const misc = readPlatinumMiscData(save);

      expect(misc.mapFeatures.id).toBeGreaterThanOrEqual(0);
      expect(misc.mapFeatures.id).toBeLessThanOrEqual(10);
      expect(misc.mapFeatures.buffer).toHaveLength(32);
      expect(misc.tabletNameCodes).toHaveLength(11);

      console.log('misc data:', {
        mapFeaturesId: misc.mapFeatures.id,
        mapFeaturesBuffer:
          Buffer.from(
            misc.mapFeatures.buffer,
          ).toString('hex'),
        tabletNameCodes:
          misc.tabletNameCodes.map(
            (code) =>
              `0x${code
                .toString(16)
                .padStart(4, '0')}`,
          ),
      });
    },
  );
});