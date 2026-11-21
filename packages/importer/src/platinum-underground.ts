import type {
  GameState,
  UndergroundState,
} from '@opensinnoh/contracts';
import {
  type PlatinumSecretBase,
  type PlatinumUnderground,
  readPlatinumUnderground,
} from '@opensinnoh/nds';

function baseDirection(
  direction: number,
): 'up' | 'down' | 'left' | 'right' {
  switch (direction) {
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
        `Unknown Platinum Secret Base direction ${direction}`,
      );
  }
}

function convertSecretBase(
  native: PlatinumSecretBase,
): NonNullable<UndergroundState['base']> {
  return {
    entrance: {
      x: native.entrance.x,
      z: native.entrance.z,
      dir: baseDirection(
        native.entrance.direction,
      ),
    },
    goods: native.goods.map((good) =>
      good ? { ...good } : null,
    ),
    boulders: native.boulders.map(
      (boulder) =>
        boulder ? { ...boulder } : null,
    ),
  };
}

export function convertPlatinumUnderground(
  native: PlatinumUnderground,
): UndergroundState {
  return {
    seed: native.seed,
    respawn: native.respawn,
    mined: native.mined,
    spheres: native.spheres.map(
      (sphere) => ({ ...sphere }),
    ),
    treasures: [...native.treasures],
    traps: [...native.traps],
    goods: [...native.goods],
    goodsPc: [...native.goodsPc],
    buried: native.buried.map(
      (sphere) => ({ ...sphere }),
    ),
    spots: native.spots.map(
      (spot) => ({ ...spot }),
    ),
    spawnedTraps:
      native.spawnedTraps.map((trap) =>
        trap ? { ...trap } : null,
      ),
    plates: native.plates,
    records: { ...native.records },
    steps: native.steps,
    vendorTalks: [],
    placedTraps: native.placedTraps.map(
      (trap) => ({ ...trap }),
    ),
    base: native.base
      ? convertSecretBase(native.base)
      : null,
  };
}

export function applyPlatinumUnderground(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    underground:
      convertPlatinumUnderground(
        readPlatinumUnderground(save),
      ),
  };
}
