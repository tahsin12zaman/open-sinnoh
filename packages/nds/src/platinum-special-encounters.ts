import {
  PLATINUM_SPECIAL_ENCOUNTER_OFFSET,
  PLATINUM_SPECIAL_ENCOUNTER_SIZE,
} from './platinum-roamers.ts';
import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_HONEY_TREE_COUNT = 21;
export const PLATINUM_HONEY_TREES_OFFSET = 0x14;
export const PLATINUM_HONEY_TREE_SIZE = 8;
export const PLATINUM_RADAR_RECORDS_OFFSET = 0xbc;
export const PLATINUM_RADAR_RECORD_COUNT = 3;
export const PLATINUM_SPECIAL_TRAILING_OFFSET = 0x14e;

export interface PlatinumHoneyTree {
  minutes: number;
  slot: number;
  table: number;
  group: number;
  shakes: number;
}

export interface PlatinumRadarRecord {
  species: number;
  count: number;
}

export interface PlatinumSpecialEncounters {
  marshDaily: number;
  swarmDaily: number;
  trophyGarden: [
    number | null,
    number | null,
  ];
  lastHoneyTree: number;
  honeyTrees: PlatinumHoneyTree[];
  radarRecords: PlatinumRadarRecord[];
  swarms: boolean;
  repelSteps: number;
  radarCharge: number;
  fluteFactor: number;
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
}

function trophySlot(value: number): number | null {
  return value === 0xffff ? null : value;
}

export function parsePlatinumSpecialEncounters(
  bytes: Uint8Array,
  offset = 0,
): PlatinumSpecialEncounters {
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

  const lastHoneyTree = view.getUint8(
    offset + 0x10,
  );

  if (
    lastHoneyTree >
    PLATINUM_HONEY_TREE_COUNT
  ) {
    throw new Error(
      `Invalid Platinum last honey tree ${lastHoneyTree}`,
    );
  }

  const honeyTrees = Array.from(
    { length: PLATINUM_HONEY_TREE_COUNT },
    (_, index): PlatinumHoneyTree => {
      const treeOffset =
        offset +
        PLATINUM_HONEY_TREES_OFFSET +
        index * PLATINUM_HONEY_TREE_SIZE;

      const minutes = view.getInt32(
        treeOffset,
        true,
      );
      const slot = view.getUint8(treeOffset + 4);
      const table = view.getUint8(treeOffset + 5);
      const group = view.getUint8(treeOffset + 6);
      const shakes = view.getUint8(treeOffset + 7);

      if (minutes < 0 || minutes > 1440) {
        throw new Error(
          `Invalid Platinum honey-tree minutes ${minutes} in tree ${index}`,
        );
      }

      if (slot > 5) {
        throw new Error(
          `Invalid Platinum honey-tree slot ${slot} in tree ${index}`,
        );
      }

      if (table > 2) {
        throw new Error(
          `Invalid Platinum honey-tree table ${table} in tree ${index}`,
        );
      }

      if (group > 3) {
        throw new Error(
          `Invalid Platinum honey-tree group ${group} in tree ${index}`,
        );
      }

      if (shakes > 3) {
        throw new Error(
          `Invalid Platinum honey-tree shakes ${shakes} in tree ${index}`,
        );
      }

      return {
        minutes,
        slot,
        table,
        group,
        shakes,
      };
    },
  );

  const radarRecords = Array.from(
    { length: PLATINUM_RADAR_RECORD_COUNT },
    (_, index): PlatinumRadarRecord => {
      const recordOffset =
        offset +
        PLATINUM_RADAR_RECORDS_OFFSET +
        index * 4;

      const species = view.getUint16(
        recordOffset,
        true,
      );

      const count = view.getUint16(
        recordOffset + 2,
        true,
      );

      if (species > 493) {
        throw new Error(
          `Invalid Platinum radar-record species ${species} in slot ${index}`,
        );
      }

      if (count > 999) {
        throw new Error(
          `Invalid Platinum radar-record count ${count} in slot ${index}`,
        );
      }

      return {
        species,
        count,
      };
    },
  );

  const swarmValue = view.getUint8(
    offset + PLATINUM_SPECIAL_TRAILING_OFFSET,
  );

  if (swarmValue > 1) {
    throw new Error(
      `Invalid Platinum swarm-enabled value ${swarmValue}`,
    );
  }

  const radarCharge = view.getUint8(
    offset +
      PLATINUM_SPECIAL_TRAILING_OFFSET +
      2,
  );

  if (radarCharge > 50) {
    throw new Error(
      `Invalid Platinum radar charge ${radarCharge}`,
    );
  }

  return {
    marshDaily: view.getUint32(offset, true),
    swarmDaily: view.getUint32(
      offset + 4,
      true,
    ),
    trophyGarden: [
      trophySlot(
        view.getUint16(offset + 0x0c, true),
      ),
      trophySlot(
        view.getUint16(offset + 0x0e, true),
      ),
    ],
    lastHoneyTree,
    honeyTrees,
    radarRecords,
    swarms: swarmValue !== 0,
    repelSteps: view.getUint8(
      offset +
        PLATINUM_SPECIAL_TRAILING_OFFSET +
        1,
    ),
    radarCharge,
    fluteFactor: view.getUint8(
      offset +
        PLATINUM_SPECIAL_TRAILING_OFFSET +
        3,
    ),
  };
}

export function readPlatinumSpecialEncounters(
  bytes: Uint8Array,
): PlatinumSpecialEncounters {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  return parsePlatinumSpecialEncounters(
    bytes,
    general.offset +
      PLATINUM_SPECIAL_ENCOUNTER_OFFSET,
  );
}
