import {
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

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

function validatePlatinumVarsFlags(
  data: PlatinumVarsFlags,
): void {
  if (data.vars.length !== PLATINUM_VARS_COUNT) {
    throw new Error(
      `Invalid Platinum variable count ${data.vars.length}`,
    );
  }

  data.vars.forEach((value, index) => {
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value > 0xffff
    ) {
      throw new Error(
        `Invalid Platinum variable 0x${(
          PLATINUM_VARS_START + index
        ).toString(16)} value ${value}`,
      );
    }
  });

  for (const flagId of data.flags) {
    if (
      !Number.isInteger(flagId) ||
      flagId <= 0 ||
      flagId >= PLATINUM_FLAGS_COUNT
    ) {
      throw new Error(
        `Invalid Platinum flag ID ${flagId}`,
      );
    }
  }
}

export function encodePlatinumVarsFlags(
  bytes: Uint8Array,
  data: PlatinumVarsFlags,
  offset = 0,
): void {
  validatePlatinumVarsFlags(data);

  const requiredSize =
    PLATINUM_VARS_COUNT * 2 +
    PLATINUM_FLAGS_SIZE;

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

  data.vars.forEach((value, index) => {
    view.setUint16(
      offset + index * 2,
      value,
      true,
    );
  });

  const flagsOffset =
    offset + PLATINUM_VARS_COUNT * 2;

  const reservedFlagZero =
    bytes[flagsOffset]! & 1;

  bytes.fill(
    0,
    flagsOffset,
    flagsOffset + PLATINUM_FLAGS_SIZE,
  );

  bytes[flagsOffset] = reservedFlagZero;

  for (const flagId of new Set(data.flags)) {
    const byteOffset =
      flagsOffset + Math.floor(flagId / 8);

    bytes[byteOffset] =
      bytes[byteOffset]! |
      (1 << (flagId % 8));
  }
}

export function writePlatinumVarsFlags(
  bytes: Uint8Array,
  data: PlatinumVarsFlags,
): Uint8Array {
  return writePlatinumSave(
    bytes,
    ({ general }) => {
      encodePlatinumVarsFlags(
        general,
        data,
        PLATINUM_VARS_FLAGS_OFFSET,
      );
    },
  );
}
