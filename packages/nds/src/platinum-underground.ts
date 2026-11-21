import {
  selectPlatinumSaveBlocks,
} from './platinum-save.ts';

export const PLATINUM_UNDERGROUND_OFFSET =
  0x3c5c;
export const PLATINUM_UNDERGROUND_SIZE = 0x9b8;
export const PLATINUM_UNDERGROUND_ENTRY_SIZE =
  0x9c0;

const SPAWNED_TRAPS = 64;
const MINING_SPOTS = 255;
const PLACED_TRAPS = 16;
const BURIED_SPHERES = 100;
const GOODS_PC = 200;
const INVENTORY_SLOTS = 40;
const PLACED_GOODS = 15;
const BASE_BOULDERS = 16;

const SECRET_BASE_RECORD_OFFSET = 0x50;
const SECRET_BASE_ENTRANCE_X_OFFSET = 0x90;
const SECRET_BASE_ENTRANCE_Z_OFFSET = 0x92;
const SECRET_BASE_DIRECTION_OFFSET = 0x94;
const SECRET_BASE_ACTIVE_OFFSET = 0x95;

const RANDOM_SEED_OFFSET = 0x98;
const SPAWNED_TRAP_IDS_OFFSET = 0x113;
const SPAWNED_TRAP_COORDS_OFFSET = 0x153;
const MINING_SPOT_COORDS_OFFSET = 0x213;
const PLACED_TRAP_IDS_OFFSET = 0x510;
const PLACED_TRAP_COORDS_OFFSET = 0x520;
const BURIED_TYPES_OFFSET = 0x560;
const BURIED_GROWTH_OFFSET = 0x5c4;
const BURIED_INITIAL_SIZE_OFFSET = 0x628;
const BURIED_COORDS_OFFSET = 0x68c;
const MINED_PLATES_OFFSET = 0x810;
const GOODS_PC_OFFSET = 0x814;
const TRAPS_OFFSET = 0x8dc;
const GOODS_BAG_OFFSET = 0x904;
const TREASURE_OFFSET = 0x92c;
const SPHERE_TYPES_OFFSET = 0x954;
const SPHERE_SIZES_OFFSET = 0x97c;
const PLACED_GOOD_SLOTS_OFFSET = 0x9a4;
const STEP_COUNT_OFFSET = 0x9b3;
const FLAGS_OFFSET = 0x9b4;

export interface PlatinumUndergroundCoords {
  x: number;
  z: number;
}

export interface PlatinumUndergroundTrap
  extends PlatinumUndergroundCoords {
  trap: number;
}

export interface PlatinumBuriedSphere
  extends PlatinumUndergroundCoords {
  type: number;
  size: number;
  growth: number;
}

export interface PlatinumPlacedGood {
  good: number;
  x: number;
  z: number;
  slot: number;
}

export interface PlatinumSecretBase {
  entrance: {
    x: number;
    z: number;
    direction: number;
  };
  goods: (PlatinumPlacedGood | null)[];
  boulders: (
    | PlatinumUndergroundCoords
    | null
  )[];
}

export interface PlatinumUnderground {
  seed: number;
  respawn: boolean;
  mined: boolean;
  spheres: {
    type: number;
    size: number;
  }[];
  treasures: number[];
  traps: number[];
  goods: number[];
  goodsPc: number[];
  buried: PlatinumBuriedSphere[];
  spots: PlatinumUndergroundCoords[];
  spawnedTraps: (
    | PlatinumUndergroundTrap
    | null
  )[];
  plates: number;
  records: {
    spheresDug: number;
    fossilsDug: number;
    otherDug: number;
    trapsTriggered: number;
    baseMoves: number;
  };
  steps: number;
  placedTraps: PlatinumUndergroundTrap[];
  base: PlatinumSecretBase | null;
}

function coords(
  bytes: Uint8Array,
  offset: number,
): PlatinumUndergroundCoords {
  const high = bytes[offset + 1]!;

  return {
    x:
      bytes[offset]! +
      ((high << 8) & 0xf00),
    z:
      bytes[offset + 2]! +
      ((high << 4) & 0xf00),
  };
}

function coordsEmpty(
  bytes: Uint8Array,
  offset: number,
): boolean {
  return (
    bytes[offset] === 0 &&
    bytes[offset + 1] === 0 &&
    bytes[offset + 2] === 0
  );
}

function compactInventory(
  bytes: Uint8Array,
  offset: number,
  length: number,
): number[] {
  return Array.from(
    { length },
    (_, index) => bytes[offset + index]!,
  ).filter((value) => value !== 0);
}

function record(
  view: DataView,
  index: number,
): number {
  return (
    view.getUint32(
      SECRET_BASE_RECORD_OFFSET +
        index * 4,
      true,
    ) & 0xfffff
  );
}

function direction(
  native: number,
): 'up' | 'down' | 'left' | 'right' {
  switch (native) {
    case 0:
      return 'up';
    case 1:
      return 'down';
    case 2:
      return 'left';
    case 3:
      return 'right';
    default:
      throw new Error(
        `Invalid Platinum Secret Base direction ${native}`,
      );
  }
}

export function decodePlatinumUnderground(
  bytes: Uint8Array,
): PlatinumUnderground {
  if (
    bytes.byteLength <
    PLATINUM_UNDERGROUND_ENTRY_SIZE
  ) {
    throw new Error(
      `Truncated Platinum Underground entry: ${bytes.byteLength} bytes, expected ${PLATINUM_UNDERGROUND_ENTRY_SIZE}`,
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const spheres = Array.from(
    { length: INVENTORY_SLOTS },
    (_, slot) => {
      const type =
        bytes[SPHERE_TYPES_OFFSET + slot]!;
      const size =
        bytes[SPHERE_SIZES_OFFSET + slot]!;

      if (type === 0) {
        return null;
      }

      if (type > 5) {
        throw new Error(
          `Invalid Platinum sphere type ${type} in slot ${slot}`,
        );
      }

      if (size < 1 || size > 99) {
        throw new Error(
          `Invalid Platinum sphere size ${size} in slot ${slot}`,
        );
      }

      return { type, size };
    },
  ).filter(
    (
      sphere,
    ): sphere is {
      type: number;
      size: number;
    } => sphere !== null,
  );

  const spawnedTraps = Array.from(
    { length: SPAWNED_TRAPS },
    (_, index): PlatinumUndergroundTrap | null => {
      const trap =
        bytes[SPAWNED_TRAP_IDS_OFFSET + index]!;

      if (trap === 0) {
        return null;
      }

      return {
        trap,
        ...coords(
          bytes,
          SPAWNED_TRAP_COORDS_OFFSET +
            index * 3,
        ),
      };
    },
  );

  const spots = Array.from(
    { length: MINING_SPOTS },
    (_, index) => {
      const offset =
        MINING_SPOT_COORDS_OFFSET +
        index * 3;

      return coordsEmpty(bytes, offset)
        ? null
        : coords(bytes, offset);
    },
  ).filter(
    (
      spot,
    ): spot is PlatinumUndergroundCoords =>
      spot !== null,
  );

  if (spots.length > 250) {
    throw new Error(
      `Invalid Platinum mining spot count ${spots.length}`,
    );
  }

  const placedTraps = Array.from(
    { length: PLACED_TRAPS },
    (_, index) => {
      const trap =
        bytes[PLACED_TRAP_IDS_OFFSET + index]!;

      return trap === 0
        ? null
        : {
            trap,
            ...coords(
              bytes,
              PLACED_TRAP_COORDS_OFFSET +
                index * 3,
            ),
          };
    },
  ).filter(
    (
      trap,
    ): trap is PlatinumUndergroundTrap =>
      trap !== null,
  );

  const buried = Array.from(
    { length: BURIED_SPHERES },
    (_, index) => {
      const type =
        bytes[BURIED_TYPES_OFFSET + index]!;

      if (type === 0) {
        return null;
      }

      if (type > 5) {
        throw new Error(
          `Invalid Platinum buried sphere type ${type} at index ${index}`,
        );
      }

      const size =
        bytes[
          BURIED_INITIAL_SIZE_OFFSET + index
        ]!;

      const growth =
        bytes[BURIED_GROWTH_OFFSET + index]!;

      if (size > 99 || growth > 99) {
        throw new Error(
          `Invalid Platinum buried sphere size ${size} or growth ${growth} at index ${index}`,
        );
      }

      return {
        type,
        size,
        growth,
        ...coords(
          bytes,
          BURIED_COORDS_OFFSET + index * 3,
        ),
      };
    },
  ).filter(
    (
      sphere,
    ): sphere is PlatinumBuriedSphere =>
      sphere !== null,
  );

  let base: PlatinumSecretBase | null = null;

  if (
    bytes[SECRET_BASE_ACTIVE_OFFSET] !== 0
  ) {
    const goods = Array.from(
      { length: PLACED_GOODS },
      (_, index): PlatinumPlacedGood | null => {
        const offset = index * 3;
        const good = bytes[offset + 2]!;

        if (good === 0) {
          return null;
        }

        const savedSlot =
          bytes[
            PLACED_GOOD_SLOTS_OFFSET + index
          ]!;

        if (savedSlot === 0) {
          throw new Error(
            `Platinum Secret Base good ${index} has no Goods PC slot`,
          );
        }

        return {
          good,
          x: bytes[offset]!,
          z: bytes[offset + 1]!,
          slot: savedSlot - 1,
        };
      },
    );

    const boulders = Array.from(
      { length: BASE_BOULDERS },
      (_, index) => {
        const offset =
          PLACED_GOODS * 3 + index * 2;

        const x = bytes[offset]!;
        const z = bytes[offset + 1]!;

        return x === 0 && z === 0
          ? null
          : { x, z };
      },
    );

    base = {
      entrance: {
        x: view.getUint16(
          SECRET_BASE_ENTRANCE_X_OFFSET,
          true,
        ),
        z: view.getUint16(
          SECRET_BASE_ENTRANCE_Z_OFFSET,
          true,
        ),
        direction: bytes[
          SECRET_BASE_DIRECTION_OFFSET
        ]!,
      },
      goods,
      boulders,
    };

    direction(base.entrance.direction);
  }

  const flags = bytes[FLAGS_OFFSET]!;

  return {
    seed: view.getUint32(
      RANDOM_SEED_OFFSET,
      true,
    ),
    respawn: (flags & 0xf) !== 0,
    mined: (flags >>> 4) !== 0,
    spheres,
    treasures: compactInventory(
      bytes,
      TREASURE_OFFSET,
      INVENTORY_SLOTS,
    ),
    traps: compactInventory(
      bytes,
      TRAPS_OFFSET,
      INVENTORY_SLOTS,
    ),
    goods: compactInventory(
      bytes,
      GOODS_BAG_OFFSET,
      INVENTORY_SLOTS,
    ),
    goodsPc: compactInventory(
      bytes,
      GOODS_PC_OFFSET,
      GOODS_PC,
    ),
    buried,
    spots,
    spawnedTraps,
    plates: view.getUint32(
      MINED_PLATES_OFFSET,
      true,
    ),
    records: {
      spheresDug: record(view, 4),
      fossilsDug: record(view, 5),
      otherDug: record(view, 6),
      trapsTriggered: record(view, 8),
      baseMoves: record(view, 13),
    },
    steps: bytes[STEP_COUNT_OFFSET]!,
    placedTraps,
    base,
  };
}

export function readPlatinumUnderground(
  bytes: Uint8Array,
): PlatinumUnderground {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const start =
    general.offset +
    PLATINUM_UNDERGROUND_OFFSET;

  return decodePlatinumUnderground(
    bytes.subarray(
      start,
      start +
        PLATINUM_UNDERGROUND_ENTRY_SIZE,
    ),
  );
}
