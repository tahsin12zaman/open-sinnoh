import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_FASHION_CASE_OFFSET = 0x4e38;
export const PLATINUM_FASHION_CASE_SIZE = 0x40;
export const PLATINUM_ACCESSORY_COUNT = 100;
export const PLATINUM_NON_UNIQUE_ACCESSORIES = 61;
export const PLATINUM_BACKDROP_COUNT = 18;

const UNIQUE_ACCESSORY_COUNT =
  PLATINUM_ACCESSORY_COUNT -
  PLATINUM_NON_UNIQUE_ACCESSORIES;

const UNIQUE_FLAGS_OFFSET = 0x20;
const BACKDROP_FLAGS_OFFSET = 0x28;

export interface PlatinumFashionCase {
  accessories: number[];
  backdrops: number[];
}

export function decodePlatinumFashionCase(
  bytes: Uint8Array,
): PlatinumFashionCase {
  if (
    bytes.byteLength <
    PLATINUM_FASHION_CASE_SIZE
  ) {
    throw new Error(
      `Truncated Platinum FashionCase: ${bytes.byteLength} bytes, expected ${PLATINUM_FASHION_CASE_SIZE}`,
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const accessories = new Array<number>(
    PLATINUM_ACCESSORY_COUNT,
  ).fill(0);

  for (
    let id = 0;
    id < PLATINUM_NON_UNIQUE_ACCESSORIES;
    id++
  ) {
    const word = view.getUint32(
      Math.floor(id / 8) * 4,
      true,
    );

    const stored =
      (word >>> ((id % 8) * 4)) & 0xf;

    accessories[id] = Math.min(stored, 9);
  }

  for (
    let localId = 0;
    localId < UNIQUE_ACCESSORY_COUNT;
    localId++
  ) {
    const word = view.getUint32(
      UNIQUE_FLAGS_OFFSET +
        Math.floor(localId / 32) * 4,
      true,
    );

    accessories[
      PLATINUM_NON_UNIQUE_ACCESSORIES +
        localId
    ] = (word >>> (localId % 32)) & 1;
  }

  const positions = Array.from(
    { length: PLATINUM_BACKDROP_COUNT },
    (_, id) =>
      bytes[BACKDROP_FLAGS_OFFSET + id]!,
  );

  for (
    let id = 0;
    id < positions.length;
    id++
  ) {
    const position = positions[id]!;

    if (position > PLATINUM_BACKDROP_COUNT) {
      throw new Error(
        `Invalid Platinum backdrop position ${position} for backdrop ${id}`,
      );
    }
  }

  const owned = positions
    .map((position, id) => ({
      id,
      position,
    }))
    .filter(
      ({ position }) =>
        position !== PLATINUM_BACKDROP_COUNT,
    );

  const usedPositions = new Set<number>();

  for (const { id, position } of owned) {
    if (usedPositions.has(position)) {
      throw new Error(
        `Duplicate Platinum backdrop position ${position}, including backdrop ${id}`,
      );
    }

    usedPositions.add(position);
  }

  const backdrops = owned
    .sort((a, b) => a.position - b.position)
    .map(({ id }) => id);

  return {
    accessories,
    backdrops,
  };
}

export function readPlatinumFashionCase(
  bytes: Uint8Array,
): PlatinumFashionCase {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const start =
    general.offset +
    PLATINUM_FASHION_CASE_OFFSET;

  return decodePlatinumFashionCase(
    bytes.subarray(
      start,
      start + PLATINUM_FASHION_CASE_SIZE,
    ),
  );
}
