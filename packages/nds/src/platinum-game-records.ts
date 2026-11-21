import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_GAME_RECORDS_OFFSET = 0x61b0;
export const PLATINUM_GAME_RECORD_COUNT = 148;
export const PLATINUM_GAME_RECORD_U32_COUNT = 71;
export const PLATINUM_GAME_RECORD_U16_COUNT = 77;
export const PLATINUM_GAME_RECORDS_SIZE = 0x1bc;

const ENCODED_OFFSET = 0x04;
const ENCODED_SIZE = 0x1b4;
const SEED_OFFSET = 0x1b8;
const LCRNG_MULTIPLIER = 0x41c64e6d;
const LCRNG_INCREMENT = 0x6073;

export interface PlatinumGameRecords {
  records: number[];
  byteSum: number;
  modifier: number;
}

function sumBytes(bytes: Uint8Array): number {
  let sum = 0;

  for (const byte of bytes) {
    sum = (sum + byte) & 0xffff;
  }

  return sum;
}

function decodeRegion(
  source: Uint8Array,
  seed: number,
): Uint8Array {
  const decoded = source.slice();
  const view = new DataView(
    decoded.buffer,
    decoded.byteOffset,
    decoded.byteLength,
  );

  let state = seed >>> 0;

  for (
    let offset = 0;
    offset < decoded.byteLength;
    offset += 2
  ) {
    state =
      (Math.imul(state, LCRNG_MULTIPLIER) +
        LCRNG_INCREMENT) >>>
      0;

    view.setUint16(
      offset,
      view.getUint16(offset, true) ^
        (state >>> 16),
      true,
    );
  }

  return decoded;
}

/**
 * Decode one native GameRecords structure.
 *
 * Record 0 (steps) is stored plainly. Records 1–147 and the
 * alignment padding are XOR-encoded as one region. The seed's
 * byteSum is calculated from the decoded region.
 */
export function decodePlatinumGameRecords(
  bytes: Uint8Array,
): PlatinumGameRecords {
  if (
    bytes.byteLength <
    PLATINUM_GAME_RECORDS_SIZE
  ) {
    throw new Error(
      `Truncated Platinum GameRecords: ${bytes.byteLength} bytes, expected ${PLATINUM_GAME_RECORDS_SIZE}`,
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const byteSum = view.getUint16(
    SEED_OFFSET,
    true,
  );

  const modifier = view.getUint16(
    SEED_OFFSET + 2,
    true,
  );

  const seed =
    (byteSum | (modifier << 16)) >>> 0;

  const decoded = decodeRegion(
    bytes.subarray(
      ENCODED_OFFSET,
      ENCODED_OFFSET + ENCODED_SIZE,
    ),
    seed,
  );

  const calculatedSum = sumBytes(decoded);

  if (calculatedSum !== byteSum) {
    throw new Error(
      `Invalid Platinum GameRecords byte sum 0x${byteSum
        .toString(16)
        .padStart(4, '0')}; decoded data gives 0x${calculatedSum
        .toString(16)
        .padStart(4, '0')}`,
    );
  }

  const decodedView = new DataView(
    decoded.buffer,
    decoded.byteOffset,
    decoded.byteLength,
  );

  const records = new Array<number>(
    PLATINUM_GAME_RECORD_COUNT,
  );

  records[0] = view.getUint32(0, true);

  for (
    let id = 1;
    id < PLATINUM_GAME_RECORD_U32_COUNT;
    id++
  ) {
    records[id] = decodedView.getUint32(
      (id - 1) * 4,
      true,
    );
  }

  const u16Start =
    (PLATINUM_GAME_RECORD_U32_COUNT - 1) * 4;

  for (
    let index = 0;
    index < PLATINUM_GAME_RECORD_U16_COUNT;
    index++
  ) {
    records[
      PLATINUM_GAME_RECORD_U32_COUNT + index
    ] = decodedView.getUint16(
      u16Start + index * 2,
      true,
    );
  }

  return {
    records,
    byteSum,
    modifier,
  };
}

export function readPlatinumGameRecords(
  bytes: Uint8Array,
): PlatinumGameRecords {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const start =
    general.offset +
    PLATINUM_GAME_RECORDS_OFFSET;

  return decodePlatinumGameRecords(
    bytes.subarray(
      start,
      start + PLATINUM_GAME_RECORDS_SIZE,
    ),
  );
}
