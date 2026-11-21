import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { crc16Ccitt } from './platinum-save.ts';
import {
  decodePlatinumEasyChatWords,
  PLATINUM_EASY_CHAT_ENTRY_SIZE,
  readPlatinumEasyChatWords,
} from './platinum-easy-chat-words.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function fixture(
  greetingBits: number,
  toughWordBits: number,
): Uint8Array {
  const bytes = new Uint8Array(
    PLATINUM_EASY_CHAT_ENTRY_SIZE,
  );

  const view = new DataView(bytes.buffer);

  view.setUint32(0, greetingBits, true);
  view.setUint32(4, toughWordBits, true);
  view.setUint16(
    12,
    crc16Ccitt(bytes, 0, 12),
    true,
  );

  return bytes;
}

describe('Platinum unlocked Easy Chat words', () => {
  it('reads greeting and Tough Word bits', () => {
    expect(
      decodePlatinumEasyChatWords(
        fixture(0x12345678, 0x89abcdef),
      ),
    ).toEqual({
      unlockedGreetingBits: 0x12345678,
      unlockedToughWordBits: 0x89abcdef,
    });
  });

  it('rejects a truncated entry', () => {
    expect(() =>
      decodePlatinumEasyChatWords(
        new Uint8Array(
          PLATINUM_EASY_CHAT_ENTRY_SIZE - 1,
        ),
      ),
    ).toThrow(/truncated/i);
  });

  it('rejects a corrupt entry', () => {
    const bytes = fixture(2, 4);
    bytes[4] = bytes[4]! ^ 1;

    expect(() =>
      decodePlatinumEasyChatWords(bytes),
    ).toThrow(/checksum/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const words =
        readPlatinumEasyChatWords(save);

      console.log('unlocked Easy Chat words:', {
        greetingBits:
          '0x' +
          words.unlockedGreetingBits
            .toString(16)
            .padStart(8, '0'),
        toughWordBits:
          '0x' +
          words.unlockedToughWordBits
            .toString(16)
            .padStart(8, '0'),
      });

      expect(
        words.unlockedGreetingBits,
      ).toBe(2);

      expect(
        words.unlockedToughWordBits,
      ).toBe(0);
    },
  );
});
