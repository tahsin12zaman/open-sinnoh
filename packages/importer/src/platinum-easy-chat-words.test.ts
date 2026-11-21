import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import { describe, expect, it } from 'vitest';
import { applyPlatinumEasyChatWords } from './platinum-easy-chat-words.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum Easy Chat word import', () => {
  it.skipIf(!savePath)(
    'applies Tough Word bits from a real save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = {
        unlockedToughWords: 0xffffffff,
      } as unknown as GameState;

      const converted =
        applyPlatinumEasyChatWords(
          base,
          save,
        );

      console.log(
        'converted Tough Word bits:',
        '0x' +
          converted.unlockedToughWords
            .toString(16)
            .padStart(8, '0'),
      );

      expect(
        converted.unlockedToughWords,
      ).toBe(0);

      expect(
        base.unlockedToughWords,
      ).toBe(0xffffffff);
    },
  );
});
