import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_POFFIN_CASE_OFFSET = 0x52e8;
export const PLATINUM_POFFIN_SLOTS = 100;
export const PLATINUM_POFFIN_SIZE = 8;
export const PLATINUM_POFFIN_CASE_SIZE = 0x320;

const POFFIN_TYPE_NONE = 30;
const POFFIN_TYPE_COUNT = 29;

export interface PlatinumPoffin {
  type: number;
  flavors: [
    number,
    number,
    number,
    number,
    number,
  ];
  smoothness: number;
}

export function decodePlatinumPoffinCase(
  bytes: Uint8Array,
): PlatinumPoffin[] {
  if (
    bytes.byteLength <
    PLATINUM_POFFIN_CASE_SIZE
  ) {
    throw new Error(
      `Truncated Platinum PoffinCase: ${bytes.byteLength} bytes, expected ${PLATINUM_POFFIN_CASE_SIZE}`,
    );
  }

  const poffins: PlatinumPoffin[] = [];

  for (
    let slot = 0;
    slot < PLATINUM_POFFIN_SLOTS;
    slot++
  ) {
    const offset = slot * PLATINUM_POFFIN_SIZE;
    const type = bytes[offset]!;

    if (type === POFFIN_TYPE_NONE) {
      continue;
    }

    if (type >= POFFIN_TYPE_COUNT) {
      throw new Error(
        `Invalid Platinum Poffin type ${type} in slot ${slot}`,
      );
    }

    poffins.push({
      type,
      flavors: [
        bytes[offset + 1]!,
        bytes[offset + 2]!,
        bytes[offset + 3]!,
        bytes[offset + 4]!,
        bytes[offset + 5]!,
      ],
      smoothness: bytes[offset + 6]!,
    });
  }

  return poffins;
}

export function readPlatinumPoffinCase(
  bytes: Uint8Array,
): PlatinumPoffin[] {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const start =
    general.offset +
    PLATINUM_POFFIN_CASE_OFFSET;

  return decodePlatinumPoffinCase(
    bytes.subarray(
      start,
      start + PLATINUM_POFFIN_CASE_SIZE,
    ),
  );
}
