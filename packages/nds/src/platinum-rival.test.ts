import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLATINUM_RIVAL_NAME_OFFSET,
  readPlatinumRivalData,
  selectPlatinumSaveBlocks,
} from './platinum-save.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum rival data', () => {
  it.skipIf(!savePath)(
    'reads the chosen rival name from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const { general } =
        selectPlatinumSaveBlocks(save);

      expect(general.offset).toBeGreaterThanOrEqual(0);

      const rival =
        readPlatinumRivalData(save);

      expect(rival.nameCodes).toHaveLength(8);
      expect(rival.nameCodes).toContain(0xffff);

      console.log(
        'rival-name offset:',
        `0x${PLATINUM_RIVAL_NAME_OFFSET.toString(16)}`,
      );
      console.log(
        'rival-name codes:',
        rival.nameCodes.map(
          (code) =>
            `0x${code.toString(16).padStart(4, '0')}`,
        ),
      );
    },
  );
});