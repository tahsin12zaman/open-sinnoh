import {
  crc16Ccitt,
  selectPlatinumSaveBlocks,
} from './platinum-save.ts';

export const PLATINUM_FRONTIER_OFFSET = 0x68e0;
export const PLATINUM_FRONTIER_SIZE = 0x1628;
export const PLATINUM_FRONTIER_ENTRY_SIZE = 0x1630;

const STATS_OFFSET = 0;
const SOLO_STATS_COUNT = 100;
const SOLO_AND_ACTIVE_STATS_COUNT = 112;

const CHALLENGE_SAVE_OFFSET = 0x8e0;
const WIFI_RECORD_OFFSET = 0x954;

const FACTORY_FLAGS_OFFSET = 0x1618;
const HALL_FLAGS_OFFSET = 0x161c;
const CASTLE_FLAGS_OFFSET = 0x1620;
const ARCADE_FLAGS_OFFSET = 0x1624;

const TOWER_TRAINER_COUNT = 14;
const FACTORY_TRAINER_COUNT = 14;
const FACTORY_PARTY_SIZE = 4;
const HALL_TRAINER_COUNT = 20;
const CASTLE_TRAINER_COUNT = 14;
const CASTLE_PARTY_SIZE = 4;
const ARCADE_TRAINER_COUNT = 14;
const ARCADE_PARTY_SIZE = 4;

export interface PlatinumTowerSave {
  inProgress: boolean;
  reserved: boolean;
  mode: number;
  nextOpponent: number;
  slots: number[];
  trainers: number[];
  seed: number;
  partner: number;
  partnerParty: {
    otId: number;
    sets: number[];
    pids: number[];
  };
}

export interface PlatinumFactoryPokemon {
  set: number;
  pid: number;
  ivs: number;
}

export interface PlatinumFactorySave {
  saved: boolean;
  challengeType: number;
  openLevel: boolean;
  battle: number;
  trainers: number[];
  player: PlatinumFactoryPokemon[];
  opponent: PlatinumFactoryPokemon[];
}

export interface PlatinumHallSave {
  saved: boolean;
  challengeType: number;
  battle: number;
  slots: number[];
  trainers: number[];
  opponents: number[];
}

export interface PlatinumCastleSave {
  saved: boolean;
  challengeType: number;
  battle: number;
  slots: number[];
  trainers: number[];
  hp: number[];
  pp: number[][];
  status: number[];
  items: number[];
  sets: number[];
}

export interface PlatinumArcadeSave {
  saved: boolean;
  challengeType: number;
  battle: number;
  speed: number;
  randomCursor: boolean;
  slots: number[];
  items: number[];
  trainers: number[];
  sets: number[];
}

export interface PlatinumFrontier {
  soloAndActiveStats: number[];
  tower: {
    bp: number;
    rng: number;
    flags: number;
    rooms: number[];
    save: PlatinumTowerSave;
  };
  factory: {
    activeFlags: number;
    save: PlatinumFactorySave;
  };
  hall: {
    activeFlags: number;
    save: PlatinumHallSave;
  };
  castle: {
    activeFlags: number;
    heardIntro: boolean;
    save: PlatinumCastleSave;
  };
  arcade: {
    activeFlags: number;
    save: PlatinumArcadeSave;
  };
}

function uint8Array(
  view: DataView,
  offset: number,
  count: number,
): number[] {
  return Array.from(
    { length: count },
    (_, index) => view.getUint8(offset + index),
  );
}

function uint16Array(
  view: DataView,
  offset: number,
  count: number,
): number[] {
  return Array.from(
    { length: count },
    (_, index) =>
      view.getUint16(offset + index * 2, true),
  );
}

function uint32Array(
  view: DataView,
  offset: number,
  count: number,
): number[] {
  return Array.from(
    { length: count },
    (_, index) =>
      view.getUint32(offset + index * 4, true),
  );
}

function decodeTowerSave(
  view: DataView,
): PlatinumTowerSave {
  const offset = CHALLENGE_SAVE_OFFSET;
  const flags = view.getUint8(offset);

  return {
    reserved: (flags & 0x01) !== 0,
    inProgress: (flags & 0x02) !== 0,
    mode: (flags >> 2) & 0x07,
    partner: (flags >> 5) & 0x07,
    nextOpponent: view.getUint8(offset + 2),
    slots: uint8Array(view, offset + 8, 4),
    trainers: uint16Array(
      view,
      offset + 12,
      TOWER_TRAINER_COUNT,
    ),
    seed: view.getUint32(offset + 40, true),
    partnerParty: {
      otId: view.getUint32(offset + 44, true),
      sets: uint16Array(view, offset + 48, 2),
      pids: uint32Array(view, offset + 52, 2),
    },
  };
}

function decodeFactorySave(
  view: DataView,
): PlatinumFactorySave {
  const offset = CHALLENGE_SAVE_OFFSET;
  const flags = view.getUint8(offset);

  const playerSets = uint16Array(
    view,
    offset + 32,
    FACTORY_PARTY_SIZE,
  );
  const playerIvs = uint8Array(
    view,
    offset + 40,
    FACTORY_PARTY_SIZE,
  );
  const playerPids = uint32Array(
    view,
    offset + 44,
    FACTORY_PARTY_SIZE,
  );

  const opponentSets = uint16Array(
    view,
    offset + 60,
    FACTORY_PARTY_SIZE,
  );
  const opponentIvs = uint8Array(
    view,
    offset + 68,
    FACTORY_PARTY_SIZE,
  );
  const opponentPids = uint32Array(
    view,
    offset + 72,
    FACTORY_PARTY_SIZE,
  );

  return {
    openLevel: (flags & 0x01) !== 0,
    challengeType: (flags >> 1) & 0x07,
    saved: (flags & 0x10) !== 0,
    battle: view.getUint8(offset + 1),
    trainers: uint16Array(
      view,
      offset + 4,
      FACTORY_TRAINER_COUNT,
    ),
    player: playerSets.map((set, index) => ({
      set,
      ivs: playerIvs[index]!,
      pid: playerPids[index]!,
    })),
    opponent: opponentSets.map((set, index) => ({
      set,
      ivs: opponentIvs[index]!,
      pid: opponentPids[index]!,
    })),
  };
}

function decodeHallSave(
  view: DataView,
): PlatinumHallSave {
  const offset = CHALLENGE_SAVE_OFFSET;
  const flags = view.getUint8(offset);

  return {
    challengeType: flags & 0x07,
    saved: (flags & 0x08) !== 0,
    battle: view.getUint8(offset + 1),
    slots: uint8Array(view, offset + 2, 2),
    trainers: uint16Array(
      view,
      offset + 4,
      HALL_TRAINER_COUNT,
    ),
    opponents: uint16Array(
      view,
      offset + 44,
      HALL_TRAINER_COUNT,
    ),
  };
}

function decodeCastleSave(
  view: DataView,
): PlatinumCastleSave {
  const offset = CHALLENGE_SAVE_OFFSET;
  const flags = view.getUint8(offset);

  const pp = Array.from(
    { length: CASTLE_PARTY_SIZE },
    (_, pokemon) =>
      uint8Array(
        view,
        offset + 42 + pokemon * 4,
        4,
      ),
  );

  return {
    challengeType: flags & 0x07,
    saved: (flags & 0x08) !== 0,
    battle: view.getUint8(offset + 1),
    slots: uint8Array(view, offset + 3, 3),
    trainers: uint16Array(
      view,
      offset + 6,
      CASTLE_TRAINER_COUNT,
    ),
    hp: uint16Array(
      view,
      offset + 34,
      CASTLE_PARTY_SIZE,
    ),
    pp,
    status: uint32Array(
      view,
      offset + 60,
      CASTLE_PARTY_SIZE,
    ),
    items: uint16Array(
      view,
      offset + 76,
      CASTLE_PARTY_SIZE,
    ),
    sets: uint16Array(
      view,
      offset + 84,
      CASTLE_TRAINER_COUNT,
    ),
  };
}

function decodeArcadeSave(
  view: DataView,
): PlatinumArcadeSave {
  const offset = CHALLENGE_SAVE_OFFSET;
  const flags = view.getUint8(offset);

  return {
    challengeType: flags & 0x07,
    saved: (flags & 0x08) !== 0,
    randomCursor: (flags & 0x10) !== 0,
    battle: view.getUint8(offset + 1),
    speed: view.getUint8(offset + 2),
    slots: uint8Array(view, offset + 3, 3),
    items: uint16Array(
      view,
      offset + 6,
      ARCADE_PARTY_SIZE,
    ),
    trainers: uint16Array(
      view,
      offset + 14,
      ARCADE_TRAINER_COUNT,
    ),
    sets: uint16Array(
      view,
      offset + 42,
      ARCADE_TRAINER_COUNT,
    ),
  };
}

export function decodePlatinumFrontier(
  bytes: Uint8Array,
): PlatinumFrontier {
  if (bytes.byteLength < PLATINUM_FRONTIER_SIZE) {
    throw new Error(
      `Truncated Platinum Battle Frontier entry: ${bytes.byteLength} bytes, expected ${PLATINUM_FRONTIER_SIZE}`,
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const soloAndActiveStats = uint16Array(
    view,
    STATS_OFFSET,
    SOLO_AND_ACTIVE_STATS_COUNT,
  );

  for (
    let index = 0;
    index < SOLO_STATS_COUNT;
    index++
  ) {
    const value = soloAndActiveStats[index]!;

    if (value > 9999) {
      throw new Error(
        `Invalid Platinum Battle Frontier stat ${index}: ${value}`,
      );
    }
  }

  const wifi = WIFI_RECORD_OFFSET;
  const bp = view.getUint16(wifi, true);

  if (bp > 9999) {
    throw new Error(
      `Invalid Platinum Battle Frontier BP: ${bp}`,
    );
  }

  const towerRank = view.getUint8(wifi + 3);

  if (towerRank > 10) {
    throw new Error(
      `Invalid Platinum Battle Tower rank: ${towerRank}`,
    );
  }

  return {
    soloAndActiveStats,
    tower: {
      bp,
      rng: view.getUint32(wifi + 4, true),
      flags: view.getUint16(wifi + 8, true),
      rooms: uint16Array(view, wifi + 10, 6),
      save: decodeTowerSave(view),
    },
    factory: {
      activeFlags: view.getUint8(
        FACTORY_FLAGS_OFFSET,
      ),
      save: decodeFactorySave(view),
    },
    hall: {
      activeFlags: view.getUint8(
        HALL_FLAGS_OFFSET,
      ),
      save: decodeHallSave(view),
    },
    castle: {
      activeFlags: view.getUint8(
        CASTLE_FLAGS_OFFSET,
      ),
      heardIntro:
        view.getUint8(CASTLE_FLAGS_OFFSET + 1) !==
        0,
      save: decodeCastleSave(view),
    },
    arcade: {
      activeFlags: view.getUint8(
        ARCADE_FLAGS_OFFSET,
      ),
      save: decodeArcadeSave(view),
    },
  };
}

export function readPlatinumFrontier(
  bytes: Uint8Array,
): PlatinumFrontier {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const start =
    general.offset + PLATINUM_FRONTIER_OFFSET;

  return decodePlatinumFrontier(
    bytes.subarray(
      start,
      start + PLATINUM_FRONTIER_SIZE,
    ),
  );
}


export const PLATINUM_HALL_RECORDS_PRIMARY_OFFSET =
  0x23000;
export const PLATINUM_HALL_RECORDS_BACKUP_OFFSET =
  0x63000;
export const PLATINUM_HALL_RECORDS_SIZE = 0xba0;
export const PLATINUM_HALL_RECORDS_ENTRY_SIZE =
  0xbb0;

const HALL_RECORD_SPECIES_COUNT = 495;
const HALL_RECORD_SIGNATURE = 0x20060623;
const HALL_RECORD_EXTRA_ID = 1;

export interface PlatinumHallWinRecords {
  saveCounter: number;
  records: number[][];
}

function decodeHallRecordsCopy(
  bytes: Uint8Array,
): PlatinumHallWinRecords | null {
  if (
    bytes.byteLength <
    PLATINUM_HALL_RECORDS_ENTRY_SIZE
  ) {
    return null;
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const footer = PLATINUM_HALL_RECORDS_SIZE;

  if (
    view.getUint32(footer, true) !==
      HALL_RECORD_SIGNATURE ||
    view.getUint32(footer + 8, true) !==
      PLATINUM_HALL_RECORDS_SIZE ||
    view.getUint16(footer + 12, true) !==
      HALL_RECORD_EXTRA_ID
  ) {
    return null;
  }

  const storedChecksum = view.getUint16(
    footer + 14,
    true,
  );
  const calculatedChecksum = crc16Ccitt(
    bytes,
    0,
    PLATINUM_HALL_RECORDS_ENTRY_SIZE - 2,
  );

  if (storedChecksum !== calculatedChecksum) {
    return null;
  }

  if (view.getUint32(0, true) !== 0xffffffff) {
    return null;
  }

  const records = Array.from(
    { length: 3 },
    (_, challengeType) => {
      const start =
        4 +
        challengeType *
          HALL_RECORD_SPECIES_COUNT *
          2;

      return Array.from(
        { length: HALL_RECORD_SPECIES_COUNT },
        (_, species) =>
          view.getUint16(
            start + species * 2,
            true,
          ),
      );
    },
  );

  for (
    let challengeType = 0;
    challengeType < records.length;
    challengeType++
  ) {
    const challengeRecords =
      records[challengeType]!;

    for (
      let species = 0;
      species < challengeRecords.length;
      species++
    ) {
      const streak = challengeRecords[species]!;

      if (streak > 9999) {
        throw new Error(
          `Invalid Platinum Battle Hall record for challenge ${challengeType}, species ${species}: ${streak}`,
        );
      }
    }
  }

  return {
    saveCounter: view.getUint32(
      footer + 4,
      true,
    ),
    records,
  };
}

function newerCounter(
  first: number,
  second: number,
): boolean {
  const difference = (first - second) >>> 0;

  return (
    difference !== 0 &&
    difference < 0x80000000
  );
}

export function readPlatinumHallWinRecords(
  bytes: Uint8Array,
): PlatinumHallWinRecords {
  const primary = decodeHallRecordsCopy(
    bytes.subarray(
      PLATINUM_HALL_RECORDS_PRIMARY_OFFSET,
      PLATINUM_HALL_RECORDS_PRIMARY_OFFSET +
        PLATINUM_HALL_RECORDS_ENTRY_SIZE,
    ),
  );

  const backup = decodeHallRecordsCopy(
    bytes.subarray(
      PLATINUM_HALL_RECORDS_BACKUP_OFFSET,
      PLATINUM_HALL_RECORDS_BACKUP_OFFSET +
        PLATINUM_HALL_RECORDS_ENTRY_SIZE,
    ),
  );

  if (!primary && !backup) {
    return {
      saveCounter: 0,
      records: Array.from(
        { length: 3 },
        () =>
          Array<number>(
            HALL_RECORD_SPECIES_COUNT,
          ).fill(0),
      ),
    };
  }

  if (!primary) return backup!;
  if (!backup) return primary;

  return newerCounter(
    backup.saveCounter,
    primary.saveCounter,
  )
    ? backup
    : primary;
}
