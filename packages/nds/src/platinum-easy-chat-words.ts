import {
  crc16Ccitt,
  selectPlatinumSaveBlocks,
} from './platinum-save.ts';

export const PLATINUM_EASY_CHAT_WORDS_OFFSET =
  0xceb0;
export const PLATINUM_EASY_CHAT_WORDS_SIZE = 8;
export const PLATINUM_EASY_CHAT_ENTRY_SIZE = 16;

const CHECKSUM_BODY_SIZE = 12;
const CHECKSUM_OFFSET = 12;

export interface PlatinumEasyChatWords {
  unlockedGreetingBits: number;
  unlockedToughWordBits: number;
}

export function decodePlatinumEasyChatWords(
  bytes: Uint8Array,
): PlatinumEasyChatWords {
  if (
    bytes.byteLength <
    PLATINUM_EASY_CHAT_ENTRY_SIZE
  ) {
    throw new Error(
      `Truncated Platinum UnlockedEasyChatWords entry: ${bytes.byteLength} bytes, expected ${PLATINUM_EASY_CHAT_ENTRY_SIZE}`,
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const storedChecksum = view.getUint16(
    CHECKSUM_OFFSET,
    true,
  );

  const calculatedChecksum = crc16Ccitt(
    bytes,
    0,
    CHECKSUM_BODY_SIZE,
  );

  if (storedChecksum !== calculatedChecksum) {
    throw new Error(
      `Invalid Platinum UnlockedEasyChatWords checksum 0x${storedChecksum
        .toString(16)
        .padStart(4, '0')}; calculated 0x${calculatedChecksum
        .toString(16)
        .padStart(4, '0')}`,
    );
  }

  return {
    unlockedGreetingBits: view.getUint32(
      0,
      true,
    ),
    unlockedToughWordBits: view.getUint32(
      4,
      true,
    ),
  };
}

export function readPlatinumEasyChatWords(
  bytes: Uint8Array,
): PlatinumEasyChatWords {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const start =
    general.offset +
    PLATINUM_EASY_CHAT_WORDS_OFFSET;

  return decodePlatinumEasyChatWords(
    bytes.subarray(
      start,
      start + PLATINUM_EASY_CHAT_ENTRY_SIZE,
    ),
  );
}
