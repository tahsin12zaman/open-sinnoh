import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_VARS_FLAGS_OFFSET = 0x0dac;
export const PLATINUM_VARS_START = 0x4000;
export const PLATINUM_VARS_END = 0x4120;
export const PLATINUM_VARS_COUNT =
  PLATINUM_VARS_END - PLATINUM_VARS_START;

export const PLATINUM_FLAGS_COUNT = 2912;
export const PLATINUM_FLAGS_SIZE =
  PLATINUM_FLAGS_COUNT / 8;

export const PLATINUM_FLAGS_OFFSET =
  PLATINUM_VARS_FLAGS_OFFSET +
  PLATINUM_VARS_COUNT * 2;

export interface PlatinumVarsFlags {
  /**
   * Values in native variable order. Index 0 is variable 0x4000.
   */
  vars: number[];

  /**
   * Native IDs of every set saved flag.
   */
  flags: number[];
}

export function parsePlatinumVarsFlags(
  bytes: Uint8Array,
  offset = 0,
): PlatinumVarsFlags {
  const requiredSize =
    PLATINUM_VARS_COUNT * 2 + PLATINUM_FLAGS_SIZE;

  if (
    offset < 0 ||
    offset + requiredSize > bytes.length
  ) {
    throw new Error(
      'Platinum variables and flags are outside the file',
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const vars = Array.from(
    { length: PLATINUM_VARS_COUNT },
    (_, index) =>
      view.getUint16(offset + index * 2, true),
  );

  const flagsOffset =
    offset + PLATINUM_VARS_COUNT * 2;

  const flags: number[] = [];

  for (
    let flagId = 1;
    flagId < PLATINUM_FLAGS_COUNT;
    flagId++
  ) {
    const byte = bytes[
      flagsOffset + Math.floor(flagId / 8)
    ]!;

    if (byte & (1 << (flagId % 8))) {
      flags.push(flagId);
    }
  }

  return {
    vars,
    flags,
  };
}

export function readPlatinumVarsFlags(
  bytes: Uint8Array,
): PlatinumVarsFlags {
  const { general } = selectPlatinumSaveBlocks(bytes);

  return parsePlatinumVarsFlags(
    bytes,
    general.offset + PLATINUM_VARS_FLAGS_OFFSET,
  );
}