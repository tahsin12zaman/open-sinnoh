import {
  PLATINUM_SPECIAL_ENCOUNTER_OFFSET,
  PLATINUM_SPECIAL_ENCOUNTER_SIZE,
} from './platinum-roamers.ts';
import {
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

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
      `Invalid Platinum special-encounter ${name} ${value}`,
    );
  }
}

function trophySlot(
  value: number,
): number | null {
  return value === 0xffff
    ? null
    : value;
}

function validateState(
  state: PlatinumSpecialEncounters,
): void {
  validateInteger(
    'marsh daily value',
    state.marshDaily,
    0,
    0xffffffff,
  );
  validateInteger(
    'swarm daily value',
    state.swarmDaily,
    0,
    0xffffffff,
  );

  if (
    state.trophyGarden.length !== 2
  ) {
    throw new Error(
      `Invalid Platinum trophy-garden slot count ${state.trophyGarden.length}`,
    );
  }

  state.trophyGarden.forEach(
    (value, index) => {
      if (value !== null) {
        validateInteger(
          `trophy-garden value in slot ${index}`,
          value,
          0,
          0xfffe,
        );
      }
    },
  );

  validateInteger(
    'last honey tree',
    state.lastHoneyTree,
    0,
    PLATINUM_HONEY_TREE_COUNT,
  );

  if (
    state.honeyTrees.length !==
    PLATINUM_HONEY_TREE_COUNT
  ) {
    throw new Error(
      `Invalid Platinum honey-tree count ${state.honeyTrees.length}`,
    );
  }

  state.honeyTrees.forEach(
    (tree, index) => {
      validateInteger(
        `honey-tree minutes in tree ${index}`,
        tree.minutes,
        0,
        1440,
      );
      validateInteger(
        `honey-tree slot in tree ${index}`,
        tree.slot,
        0,
        5,
      );
      validateInteger(
        `honey-tree table in tree ${index}`,
        tree.table,
        0,
        2,
      );
      validateInteger(
        `honey-tree group in tree ${index}`,
        tree.group,
        0,
        3,
      );
      validateInteger(
        `honey-tree shakes in tree ${index}`,
        tree.shakes,
        0,
        3,
      );
    },
  );

  if (
    state.radarRecords.length !==
    PLATINUM_RADAR_RECORD_COUNT
  ) {
    throw new Error(
      `Invalid Platinum radar-record count ${state.radarRecords.length}`,
    );
  }

  state.radarRecords.forEach(
    (record, index) => {
      validateInteger(
        `radar-record species in slot ${index}`,
        record.species,
        0,
        493,
      );
      validateInteger(
        `radar-record count in slot ${index}`,
        record.count,
        0,
        999,
      );
    },
  );

  if (typeof state.swarms !== 'boolean') {
    throw new Error(
      'Invalid Platinum swarm-enabled value',
    );
  }

  validateInteger(
    'repel steps',
    state.repelSteps,
    0,
    0xff,
  );
  validateInteger(
    'radar charge',
    state.radarCharge,
    0,
    50,
  );
  validateInteger(
    'flute factor',
    state.fluteFactor,
    0,
    0xff,
  );
}

export function parsePlatinumSpecialEncounters(
  bytes: Uint8Array,
  offset = 0,
): PlatinumSpecialEncounters {
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

  const lastHoneyTree =
    view.getUint8(offset + 0x10);

  if (
    lastHoneyTree >
    PLATINUM_HONEY_TREE_COUNT
  ) {
    throw new Error(
      `Invalid Platinum last honey tree ${lastHoneyTree}`,
    );
  }

  const honeyTrees = Array.from(
    {
      length:
        PLATINUM_HONEY_TREE_COUNT,
    },
    (
      _,
      index,
    ): PlatinumHoneyTree => {
      const treeOffset =
        offset +
        PLATINUM_HONEY_TREES_OFFSET +
        index *
          PLATINUM_HONEY_TREE_SIZE;

      const minutes =
        view.getInt32(
          treeOffset,
          true,
        );
      const slot =
        view.getUint8(
          treeOffset + 4,
        );
      const table =
        view.getUint8(
          treeOffset + 5,
        );
      const group =
        view.getUint8(
          treeOffset + 6,
        );
      const shakes =
        view.getUint8(
          treeOffset + 7,
        );

      if (
        minutes < 0 ||
        minutes > 1440
      ) {
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

  const radarRecords =
    Array.from(
      {
        length:
          PLATINUM_RADAR_RECORD_COUNT,
      },
      (
        _,
        index,
      ): PlatinumRadarRecord => {
        const recordOffset =
          offset +
          PLATINUM_RADAR_RECORDS_OFFSET +
          index * 4;

        const species =
          view.getUint16(
            recordOffset,
            true,
          );

        const count =
          view.getUint16(
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

  const swarmValue =
    view.getUint8(
      offset +
        PLATINUM_SPECIAL_TRAILING_OFFSET,
    );

  if (swarmValue > 1) {
    throw new Error(
      `Invalid Platinum swarm-enabled value ${swarmValue}`,
    );
  }

  const radarCharge =
    view.getUint8(
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
    marshDaily:
      view.getUint32(
        offset,
        true,
      ),
    swarmDaily:
      view.getUint32(
        offset + 4,
        true,
      ),
    trophyGarden: [
      trophySlot(
        view.getUint16(
          offset + 0x0c,
          true,
        ),
      ),
      trophySlot(
        view.getUint16(
          offset + 0x0e,
          true,
        ),
      ),
    ],
    lastHoneyTree,
    honeyTrees,
    radarRecords,
    swarms:
      swarmValue !== 0,
    repelSteps:
      view.getUint8(
        offset +
          PLATINUM_SPECIAL_TRAILING_OFFSET +
          1,
      ),
    radarCharge,
    fluteFactor:
      view.getUint8(
        offset +
          PLATINUM_SPECIAL_TRAILING_OFFSET +
          3,
      ),
  };
}

export function encodePlatinumSpecialEncounters(
  bytes: Uint8Array,
  state: PlatinumSpecialEncounters,
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

  view.setUint32(
    offset,
    state.marshDaily,
    true,
  );
  view.setUint32(
    offset + 4,
    state.swarmDaily,
    true,
  );

  state.trophyGarden.forEach(
    (value, index) => {
      view.setUint16(
        offset + 0x0c + index * 2,
        value ?? 0xffff,
        true,
      );
    },
  );

  view.setUint8(
    offset + 0x10,
    state.lastHoneyTree,
  );

  state.honeyTrees.forEach(
    (tree, index) => {
      const treeOffset =
        offset +
        PLATINUM_HONEY_TREES_OFFSET +
        index *
          PLATINUM_HONEY_TREE_SIZE;

      view.setInt32(
        treeOffset,
        tree.minutes,
        true,
      );
      view.setUint8(
        treeOffset + 4,
        tree.slot,
      );
      view.setUint8(
        treeOffset + 5,
        tree.table,
      );
      view.setUint8(
        treeOffset + 6,
        tree.group,
      );
      view.setUint8(
        treeOffset + 7,
        tree.shakes,
      );
    },
  );

  state.radarRecords.forEach(
    (record, index) => {
      const recordOffset =
        offset +
        PLATINUM_RADAR_RECORDS_OFFSET +
        index * 4;

      view.setUint16(
        recordOffset,
        record.species,
        true,
      );
      view.setUint16(
        recordOffset + 2,
        record.count,
        true,
      );
    },
  );

  view.setUint8(
    offset +
      PLATINUM_SPECIAL_TRAILING_OFFSET,
    state.swarms ? 1 : 0,
  );
  view.setUint8(
    offset +
      PLATINUM_SPECIAL_TRAILING_OFFSET +
      1,
    state.repelSteps,
  );
  view.setUint8(
    offset +
      PLATINUM_SPECIAL_TRAILING_OFFSET +
      2,
    state.radarCharge,
  );
  view.setUint8(
    offset +
      PLATINUM_SPECIAL_TRAILING_OFFSET +
      3,
    state.fluteFactor,
  );
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

export function writePlatinumSpecialEncounters(
  bytes: Uint8Array,
  state: PlatinumSpecialEncounters,
): Uint8Array {
  return writePlatinumSave(
    bytes,
    ({ general }) => {
      encodePlatinumSpecialEncounters(
        general,
        state,
        PLATINUM_SPECIAL_ENCOUNTER_OFFSET,
      );
    },
  );
}
