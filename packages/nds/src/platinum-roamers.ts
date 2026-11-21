import {
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

export const PLATINUM_SPECIAL_ENCOUNTER_OFFSET = 0x7f24;
export const PLATINUM_SPECIAL_ENCOUNTER_SIZE = 0x154;

export const PLATINUM_RECENT_ROUTES_OFFSET = 0xc8;
export const PLATINUM_ROAMERS_OFFSET = 0xd0;
export const PLATINUM_ROAMER_SIZE = 0x14;
export const PLATINUM_ROAMER_COUNT = 6;
export const PLATINUM_ROAMER_ROUTE_COUNT = 29;

export const PLATINUM_ROAMER_ROUTE_INDEXES_OFFSET =
  PLATINUM_ROAMERS_OFFSET +
  PLATINUM_ROAMER_COUNT *
    PLATINUM_ROAMER_SIZE;

export interface PlatinumRoamer {
  currentMapId: number;
  ivs: number;
  personality: number;
  species: number;
  currentHp: number;
  level: number;
  status: number;
  active: boolean;
}

export interface PlatinumRoamerState {
  currentMapId: number;
  previousMapId: number;
  roamers: PlatinumRoamer[];
  routeIndexes: number[];
}

function dataView(
  bytes: Uint8Array,
): DataView {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
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
      `Invalid Platinum roamer ${name} ${value}`,
    );
  }
}

function validateState(
  state: PlatinumRoamerState,
): void {
  validateInteger(
    'current map id',
    state.currentMapId,
    -0x80000000,
    0x7fffffff,
  );
  validateInteger(
    'previous map id',
    state.previousMapId,
    -0x80000000,
    0x7fffffff,
  );

  if (
    state.roamers.length !==
    PLATINUM_ROAMER_COUNT
  ) {
    throw new Error(
      `Invalid Platinum roamer count ${state.roamers.length}`,
    );
  }

  if (
    state.routeIndexes.length !==
    PLATINUM_ROAMER_COUNT
  ) {
    throw new Error(
      `Invalid Platinum roamer route-index count ${state.routeIndexes.length}`,
    );
  }

  state.roamers.forEach(
    (roamer, slot) => {
      validateInteger(
        `map id in slot ${slot}`,
        roamer.currentMapId,
        -0x80000000,
        0x7fffffff,
      );
      validateInteger(
        `IV value in slot ${slot}`,
        roamer.ivs,
        0,
        0xffffffff,
      );
      validateInteger(
        `personality in slot ${slot}`,
        roamer.personality,
        0,
        0xffffffff,
      );
      validateInteger(
        `species in slot ${slot}`,
        roamer.species,
        roamer.active ? 1 : 0,
        493,
      );
      validateInteger(
        `HP in slot ${slot}`,
        roamer.currentHp,
        0,
        0xffff,
      );
      validateInteger(
        `level in slot ${slot}`,
        roamer.level,
        0,
        0xff,
      );
      validateInteger(
        `status in slot ${slot}`,
        roamer.status,
        0,
        0xff,
      );

      if (
        typeof roamer.active !==
        'boolean'
      ) {
        throw new Error(
          `Invalid Platinum roamer active flag in slot ${slot}`,
        );
      }
    },
  );

  state.routeIndexes.forEach(
    (routeIndex, slot) => {
      validateInteger(
        `route index in slot ${slot}`,
        routeIndex,
        0,
        PLATINUM_ROAMER_ROUTE_COUNT - 1,
      );
    },
  );
}

export function parsePlatinumRoamers(
  bytes: Uint8Array,
  offset = 0,
): PlatinumRoamerState {
  if (
    offset < 0 ||
    offset +
      PLATINUM_SPECIAL_ENCOUNTER_SIZE >
      bytes.length
  ) {
    throw new Error(
      'Platinum SpecialEncounter data is truncated',
    );
  }

  const view = dataView(bytes);

  const roamers = Array.from(
    {
      length:
        PLATINUM_ROAMER_COUNT,
    },
    (_, slot): PlatinumRoamer => {
      const roamerOffset =
        offset +
        PLATINUM_ROAMERS_OFFSET +
        slot *
          PLATINUM_ROAMER_SIZE;

      const activeValue =
        view.getUint8(
          roamerOffset + 0x12,
        );

      if (activeValue > 1) {
        throw new Error(
          `Invalid Platinum roamer active value ${activeValue} in slot ${slot}`,
        );
      }

      const species =
        view.getUint16(
          roamerOffset + 0x0c,
          true,
        );

      if (
        activeValue !== 0 &&
        (
          species < 1 ||
          species > 493
        )
      ) {
        throw new Error(
          `Invalid Platinum roamer species ${species} in slot ${slot}`,
        );
      }

      return {
        currentMapId:
          view.getInt32(
            roamerOffset,
            true,
          ),
        ivs: view.getUint32(
          roamerOffset + 4,
          true,
        ),
        personality:
          view.getUint32(
            roamerOffset + 8,
            true,
          ),
        species,
        currentHp:
          view.getUint16(
            roamerOffset + 0x0e,
            true,
          ),
        level:
          view.getUint8(
            roamerOffset + 0x10,
          ),
        status:
          view.getUint8(
            roamerOffset + 0x11,
          ),
        active:
          activeValue !== 0,
      };
    },
  );

  const routeIndexes =
    Array.from(
      {
        length:
          PLATINUM_ROAMER_COUNT,
      },
      (_, slot) => {
        const routeIndex =
          view.getUint8(
            offset +
              PLATINUM_ROAMER_ROUTE_INDEXES_OFFSET +
              slot,
          );

        if (
          routeIndex >=
          PLATINUM_ROAMER_ROUTE_COUNT
        ) {
          throw new Error(
            `Invalid Platinum roamer route index ${routeIndex} in slot ${slot}`,
          );
        }

        return routeIndex;
      },
    );

  return {
    currentMapId:
      view.getInt32(
        offset +
          PLATINUM_RECENT_ROUTES_OFFSET,
        true,
      ),
    previousMapId:
      view.getInt32(
        offset +
          PLATINUM_RECENT_ROUTES_OFFSET +
          4,
        true,
      ),
    roamers,
    routeIndexes,
  };
}

export function encodePlatinumRoamers(
  bytes: Uint8Array,
  state: PlatinumRoamerState,
  offset = 0,
): void {
  if (
    offset < 0 ||
    offset +
      PLATINUM_SPECIAL_ENCOUNTER_SIZE >
      bytes.length
  ) {
    throw new Error(
      'Platinum SpecialEncounter data is truncated',
    );
  }

  validateState(state);

  const view = dataView(bytes);

  view.setInt32(
    offset +
      PLATINUM_RECENT_ROUTES_OFFSET,
    state.currentMapId,
    true,
  );
  view.setInt32(
    offset +
      PLATINUM_RECENT_ROUTES_OFFSET +
      4,
    state.previousMapId,
    true,
  );

  state.roamers.forEach(
    (roamer, slot) => {
      const roamerOffset =
        offset +
        PLATINUM_ROAMERS_OFFSET +
        slot *
          PLATINUM_ROAMER_SIZE;

      view.setInt32(
        roamerOffset,
        roamer.currentMapId,
        true,
      );
      view.setUint32(
        roamerOffset + 4,
        roamer.ivs,
        true,
      );
      view.setUint32(
        roamerOffset + 8,
        roamer.personality,
        true,
      );
      view.setUint16(
        roamerOffset + 0x0c,
        roamer.species,
        true,
      );
      view.setUint16(
        roamerOffset + 0x0e,
        roamer.currentHp,
        true,
      );
      view.setUint8(
        roamerOffset + 0x10,
        roamer.level,
      );
      view.setUint8(
        roamerOffset + 0x11,
        roamer.status,
      );
      view.setUint8(
        roamerOffset + 0x12,
        roamer.active ? 1 : 0,
      );

      // Byte 0x13 is native padding and is preserved.
    },
  );

  state.routeIndexes.forEach(
    (routeIndex, slot) => {
      view.setUint8(
        offset +
          PLATINUM_ROAMER_ROUTE_INDEXES_OFFSET +
          slot,
        routeIndex,
      );
    },
  );
}

export function readPlatinumRoamers(
  bytes: Uint8Array,
): PlatinumRoamerState {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  return parsePlatinumRoamers(
    bytes,
    general.offset +
      PLATINUM_SPECIAL_ENCOUNTER_OFFSET,
  );
}

export function writePlatinumRoamers(
  bytes: Uint8Array,
  state: PlatinumRoamerState,
): Uint8Array {
  return writePlatinumSave(
    bytes,
    ({ general }) => {
      encodePlatinumRoamers(
        general,
        state,
        PLATINUM_SPECIAL_ENCOUNTER_OFFSET,
      );
    },
  );
}
