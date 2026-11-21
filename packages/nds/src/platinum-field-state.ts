import {
  PLATINUM_FIELD_STATE_OFFSET,
  selectPlatinumSaveBlocks,
  type PlatinumLocation,
} from './platinum-save.ts';


const PLAYER_OFFSET = 0x00;
const ENTRANCE_OFFSET = 0x14;
const PREVIOUS_OFFSET = 0x28;
const SPECIAL_OFFSET = 0x3c;
const EXIT_OFFSET = 0x50;

const BGM_OFFSET = 0x64;
const WEATHER_OFFSET = 0x66;
const BLACKOUT_WARP_OFFSET = 0x68;
const CAMERA_TYPE_OFFSET = 0x6a;
const POISON_STEPS_OFFSET = 0x94;
const SAFARI_STEPS_OFFSET = 0x96;
const SAFARI_BALLS_OFFSET = 0x98;

export interface PlatinumFieldState {
  player: PlatinumLocation;
  entrance: PlatinumLocation | null;
  previous: PlatinumLocation | null;
  special: PlatinumLocation | null;
  exit: PlatinumLocation | null;
  bgm: number;
  weather: number;
  blackOutWarpId: number;
  cameraType: number;
  poisonSteps: number;
  safariSteps: number;
  safariBalls: number;
}

function readLocation(
  view: DataView,
  offset: number,
): PlatinumLocation {
  return {
    mapHeaderId: view.getInt32(offset, true),
    warpId: view.getInt32(offset + 4, true),
    x: view.getInt32(offset + 8, true),
    z: view.getInt32(offset + 12, true),
    faceDirection: view.getInt32(offset + 16, true),
  };
}

function optionalLocation(
  location: PlatinumLocation,
): PlatinumLocation | null {
  if (
    location.mapHeaderId === 0 &&
    location.warpId === 0 &&
    location.x === 0 &&
    location.z === 0 &&
    location.faceDirection === 0
  ) {
    return null;
  }

  return location;
}

function validateLocation(
  location: PlatinumLocation | null,
  name: string,
): void {
  if (location === null) return;

  if (location.mapHeaderId < 0) {
    throw new Error(
      `Invalid Platinum ${name} map header ${location.mapHeaderId}`,
    );
  }

  if (
    location.faceDirection < 0 ||
    location.faceDirection > 3
  ) {
    throw new Error(
      `Invalid Platinum ${name} facing direction ${location.faceDirection}`,
    );
  }
}

export function readPlatinumFieldState(
  save: Uint8Array,
): PlatinumFieldState {
  const { general } = selectPlatinumSaveBlocks(save);
  const base =
    general.offset + PLATINUM_FIELD_STATE_OFFSET;

  if (base + 0xa0 > save.length) {
    throw new Error(
      'Platinum field state is truncated',
    );
  }

  const view = new DataView(
    save.buffer,
    save.byteOffset,
    save.byteLength,
  );

  const player = readLocation(
    view,
    base + PLAYER_OFFSET,
  );

  const entrance = optionalLocation(
    readLocation(
      view,
      base + ENTRANCE_OFFSET,
    ),
  );

  const previous = optionalLocation(
    readLocation(
      view,
      base + PREVIOUS_OFFSET,
    ),
  );

  const special = optionalLocation(
    readLocation(
      view,
      base + SPECIAL_OFFSET,
    ),
  );

  const exit = optionalLocation(
    readLocation(
      view,
      base + EXIT_OFFSET,
    ),
  );

  validateLocation(player, 'player');
  validateLocation(entrance, 'entrance');
  validateLocation(previous, 'previous');
  validateLocation(special, 'special');
  validateLocation(exit, 'exit');

  return {
    player,
    entrance,
    previous,
    special,
    exit,
    bgm: view.getUint16(
      base + BGM_OFFSET,
      true,
    ),
    weather: view.getUint16(
      base + WEATHER_OFFSET,
      true,
    ),
    blackOutWarpId: view.getUint16(
      base + BLACKOUT_WARP_OFFSET,
      true,
    ),
    cameraType: view.getUint8(
      base + CAMERA_TYPE_OFFSET,
    ),
    poisonSteps: view.getUint16(
      base + POISON_STEPS_OFFSET,
      true,
    ),
    safariSteps: view.getUint16(
      base + SAFARI_STEPS_OFFSET,
      true,
    ),
    safariBalls: view.getUint16(
      base + SAFARI_BALLS_OFFSET,
      true,
    ),
  };
}