import {
  PLATINUM_FIELD_STATE_OFFSET,
  selectPlatinumSaveBlocks,
  writePlatinumSave,
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

function validateInteger(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
): void {
  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `Invalid Platinum ${name} value ${value}`,
    );
  }
}

function validateWritableLocation(
  location: PlatinumLocation | null,
  name: string,
): void {
  if (location === null) return;

  validateInteger(
    `${name} map header`,
    location.mapHeaderId,
    0,
    0x7fffffff,
  );
  validateInteger(
    `${name} warp ID`,
    location.warpId,
    -0x80000000,
    0x7fffffff,
  );
  validateInteger(
    `${name} x coordinate`,
    location.x,
    -0x80000000,
    0x7fffffff,
  );
  validateInteger(
    `${name} z coordinate`,
    location.z,
    -0x80000000,
    0x7fffffff,
  );
  validateInteger(
    `${name} facing direction`,
    location.faceDirection,
    0,
    3,
  );
}

function writeLocation(
  view: DataView,
  offset: number,
  location: PlatinumLocation | null,
): void {
  const value = location ?? {
    mapHeaderId: 0,
    warpId: 0,
    x: 0,
    z: 0,
    faceDirection: 0,
  };

  view.setInt32(offset, value.mapHeaderId, true);
  view.setInt32(offset + 4, value.warpId, true);
  view.setInt32(offset + 8, value.x, true);
  view.setInt32(offset + 12, value.z, true);
  view.setInt32(offset + 16, value.faceDirection, true);
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

export function writePlatinumFieldState(
  save: Uint8Array,
  field: PlatinumFieldState,
): Uint8Array {
  validateWritableLocation(field.player, 'player');
  validateWritableLocation(field.entrance, 'entrance');
  validateWritableLocation(field.previous, 'previous');
  validateWritableLocation(field.special, 'special');
  validateWritableLocation(field.exit, 'exit');

  validateInteger('BGM', field.bgm, 0, 0xffff);
  validateInteger('weather', field.weather, 0, 0xffff);
  validateInteger(
    'blackout warp ID',
    field.blackOutWarpId,
    0,
    0xffff,
  );
  validateInteger(
    'camera type',
    field.cameraType,
    0,
    0xff,
  );
  validateInteger(
    'poison steps',
    field.poisonSteps,
    0,
    0xffff,
  );
  validateInteger(
    'Safari steps',
    field.safariSteps,
    0,
    0xffff,
  );
  validateInteger(
    'Safari Balls',
    field.safariBalls,
    0,
    0xffff,
  );

  return writePlatinumSave(
    save,
    ({ general }) => {
      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );

      const base = PLATINUM_FIELD_STATE_OFFSET;

      writeLocation(
        view,
        base + PLAYER_OFFSET,
        field.player,
      );
      writeLocation(
        view,
        base + ENTRANCE_OFFSET,
        field.entrance,
      );
      writeLocation(
        view,
        base + PREVIOUS_OFFSET,
        field.previous,
      );
      writeLocation(
        view,
        base + SPECIAL_OFFSET,
        field.special,
      );
      writeLocation(
        view,
        base + EXIT_OFFSET,
        field.exit,
      );

      view.setUint16(
        base + BGM_OFFSET,
        field.bgm,
        true,
      );
      view.setUint16(
        base + WEATHER_OFFSET,
        field.weather,
        true,
      );
      view.setUint16(
        base + BLACKOUT_WARP_OFFSET,
        field.blackOutWarpId,
        true,
      );
      view.setUint8(
        base + CAMERA_TYPE_OFFSET,
        field.cameraType,
      );
      view.setUint16(
        base + POISON_STEPS_OFFSET,
        field.poisonSteps,
        true,
      );
      view.setUint16(
        base + SAFARI_STEPS_OFFSET,
        field.safariSteps,
        true,
      );
      view.setUint16(
        base + SAFARI_BALLS_OFFSET,
        field.safariBalls,
        true,
      );
    },
  );
}
