import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_SPECIAL_ENCOUNTER_OFFSET = 0x7f24;
export const PLATINUM_SPECIAL_ENCOUNTER_SIZE = 0x154;

export const PLATINUM_RECENT_ROUTES_OFFSET = 0xc8;
export const PLATINUM_ROAMERS_OFFSET = 0xd0;
export const PLATINUM_ROAMER_SIZE = 0x14;
export const PLATINUM_ROAMER_COUNT = 6;
export const PLATINUM_ROAMER_ROUTE_COUNT = 29;

export const PLATINUM_ROAMER_ROUTE_INDEXES_OFFSET =
  PLATINUM_ROAMERS_OFFSET +
  PLATINUM_ROAMER_COUNT * PLATINUM_ROAMER_SIZE;

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

function dataView(bytes: Uint8Array): DataView {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
}

export function parsePlatinumRoamers(
  bytes: Uint8Array,
  offset = 0,
): PlatinumRoamerState {
  if (
    offset < 0 ||
    offset + PLATINUM_SPECIAL_ENCOUNTER_SIZE >
      bytes.length
  ) {
    throw new Error(
      'Platinum SpecialEncounter data is truncated',
    );
  }

  const view = dataView(bytes);

  const roamers = Array.from(
    { length: PLATINUM_ROAMER_COUNT },
    (_, slot): PlatinumRoamer => {
      const roamerOffset =
        offset +
        PLATINUM_ROAMERS_OFFSET +
        slot * PLATINUM_ROAMER_SIZE;

      const activeValue = view.getUint8(
        roamerOffset + 0x12,
      );

      if (activeValue > 1) {
        throw new Error(
          `Invalid Platinum roamer active value ${activeValue} in slot ${slot}`,
        );
      }

      const species = view.getUint16(
        roamerOffset + 0x0c,
        true,
      );

      if (
        activeValue !== 0 &&
        (species < 1 || species > 493)
      ) {
        throw new Error(
          `Invalid Platinum roamer species ${species} in slot ${slot}`,
        );
      }

      return {
        currentMapId: view.getInt32(
          roamerOffset,
          true,
        ),
        ivs: view.getUint32(
          roamerOffset + 4,
          true,
        ),
        personality: view.getUint32(
          roamerOffset + 8,
          true,
        ),
        species,
        currentHp: view.getUint16(
          roamerOffset + 0x0e,
          true,
        ),
        level: view.getUint8(
          roamerOffset + 0x10,
        ),
        status: view.getUint8(
          roamerOffset + 0x11,
        ),
        active: activeValue !== 0,
      };
    },
  );

  const routeIndexes = Array.from(
    { length: PLATINUM_ROAMER_COUNT },
    (_, slot) => {
      const routeIndex = view.getUint8(
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
    currentMapId: view.getInt32(
      offset + PLATINUM_RECENT_ROUTES_OFFSET,
      true,
    ),
    previousMapId: view.getInt32(
      offset +
        PLATINUM_RECENT_ROUTES_OFFSET +
        4,
      true,
    ),
    roamers,
    routeIndexes,
  };
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
