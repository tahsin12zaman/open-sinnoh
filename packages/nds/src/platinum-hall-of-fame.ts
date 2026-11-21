import {
  crc16Ccitt,
  PLATINUM_SAVE_SIGNATURE,
  validatePlatinumSaveSize,
} from './platinum-save.ts';

export const PLATINUM_HALL_OF_FAME_PRIMARY_OFFSET =
  0x20000;
export const PLATINUM_HALL_OF_FAME_BACKUP_OFFSET =
  0x60000;

export const PLATINUM_HALL_OF_FAME_ENTRY_COUNT = 30;
export const PLATINUM_HALL_OF_FAME_PARTY_SIZE = 6;
export const PLATINUM_HALL_OF_FAME_POKEMON_SIZE =
  0x3c;
export const PLATINUM_HALL_OF_FAME_ENTRY_SIZE =
  0x16c;
export const PLATINUM_HALL_OF_FAME_BODY_SIZE =
  0x2ab0;
export const PLATINUM_HALL_OF_FAME_FOOTER_SIZE =
  0x10;

export const PLATINUM_HALL_OF_FAME_NEXT_INDEX_OFFSET =
  0x2aa8;
export const PLATINUM_HALL_OF_FAME_TOTAL_OFFSET =
  0x2aac;

const HALL_OF_FAME_EXTRA_SAVE_ID = 0;
const MAX_TOTAL_ENTRIES = 9999;

export interface PlatinumHallOfFameFooter {
  signature: number;
  saveCounter: number;
  size: number;
  id: number;
  checksum: number;
}

export interface PlatinumHallOfFamePokemon {
  species: number;
  level: number;
  form: number;
  personality: number;
  otId: number;
  nicknameCodes: number[];
  otNameCodes: number[];
  moves: number[];
}

export interface PlatinumHallOfFameEntry {
  number: number;
  year: number;
  month: number;
  day: number;
  pokemon: PlatinumHallOfFamePokemon[];
}

export interface PlatinumHallOfFame {
  total: number;
  nextEntryIndex: number;
  entries: PlatinumHallOfFameEntry[];
  source: 'primary' | 'backup' | 'none';
  saveCounter: number | null;
}

interface ValidHallOfFameCopy {
  offset: number;
  source: 'primary' | 'backup';
  footer: PlatinumHallOfFameFooter;
}

function view(bytes: Uint8Array): DataView {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
}

function words(
  data: DataView,
  offset: number,
  count: number,
): number[] {
  return Array.from(
    { length: count },
    (_, index) =>
      data.getUint16(
        offset + index * 2,
        true,
      ),
  );
}

function isErasedCopy(
  bytes: Uint8Array,
  offset: number,
): boolean {
  const end =
    offset +
    PLATINUM_HALL_OF_FAME_BODY_SIZE +
    PLATINUM_HALL_OF_FAME_FOOTER_SIZE;

  for (let index = offset; index < end; index++) {
    if (bytes[index] !== 0xff) {
      return false;
    }
  }

  return true;
}

export function readPlatinumHallOfFameFooter(
  bytes: Uint8Array,
  copyOffset: number,
): PlatinumHallOfFameFooter {
  const footerOffset =
    copyOffset +
    PLATINUM_HALL_OF_FAME_BODY_SIZE;

  if (
    copyOffset < 0 ||
    footerOffset +
      PLATINUM_HALL_OF_FAME_FOOTER_SIZE >
      bytes.length
  ) {
    throw new Error(
      'Platinum Hall of Fame copy is truncated',
    );
  }

  const data = view(bytes);

  return {
    signature: data.getUint32(
      footerOffset,
      true,
    ),
    saveCounter: data.getUint32(
      footerOffset + 4,
      true,
    ),
    size: data.getUint32(
      footerOffset + 8,
      true,
    ),
    id: data.getUint16(
      footerOffset + 12,
      true,
    ),
    checksum: data.getUint16(
      footerOffset + 14,
      true,
    ),
  };
}

export function validatePlatinumHallOfFameCopy(
  bytes: Uint8Array,
  copyOffset: number,
): PlatinumHallOfFameFooter | null {
  if (isErasedCopy(bytes, copyOffset)) {
    return null;
  }

  const footer = readPlatinumHallOfFameFooter(
    bytes,
    copyOffset,
  );

  if (
    footer.signature !==
      PLATINUM_SAVE_SIGNATURE ||
    footer.size !==
      PLATINUM_HALL_OF_FAME_BODY_SIZE ||
    footer.id !== HALL_OF_FAME_EXTRA_SAVE_ID
  ) {
    return null;
  }

  const footerOffset =
    copyOffset +
    PLATINUM_HALL_OF_FAME_BODY_SIZE;

  const checksum = crc16Ccitt(
    bytes,
    copyOffset,
    footerOffset + 14,
  );

  if (checksum !== footer.checksum) {
    return null;
  }

  return footer;
}

function compareCounters(
  first: number,
  second: number,
): number {
  if (first === 0xffffffff && second === 0) {
    return -1;
  }

  if (first === 0 && second === 0xffffffff) {
    return 1;
  }

  if (first > second) {
    return 1;
  }

  if (first < second) {
    return -1;
  }

  return 0;
}

function selectHallOfFameCopy(
  bytes: Uint8Array,
): ValidHallOfFameCopy | null {
  const primaryFooter =
    validatePlatinumHallOfFameCopy(
      bytes,
      PLATINUM_HALL_OF_FAME_PRIMARY_OFFSET,
    );

  const backupFooter =
    validatePlatinumHallOfFameCopy(
      bytes,
      PLATINUM_HALL_OF_FAME_BACKUP_OFFSET,
    );

  if (primaryFooter && !backupFooter) {
    return {
      offset:
        PLATINUM_HALL_OF_FAME_PRIMARY_OFFSET,
      source: 'primary',
      footer: primaryFooter,
    };
  }

  if (!primaryFooter && backupFooter) {
    return {
      offset:
        PLATINUM_HALL_OF_FAME_BACKUP_OFFSET,
      source: 'backup',
      footer: backupFooter,
    };
  }

  if (primaryFooter && backupFooter) {
    if (
      compareCounters(
        primaryFooter.saveCounter,
        backupFooter.saveCounter,
      ) >= 0
    ) {
      return {
        offset:
          PLATINUM_HALL_OF_FAME_PRIMARY_OFFSET,
        source: 'primary',
        footer: primaryFooter,
      };
    }

    return {
      offset:
        PLATINUM_HALL_OF_FAME_BACKUP_OFFSET,
      source: 'backup',
      footer: backupFooter,
    };
  }

  const primaryErased = isErasedCopy(
    bytes,
    PLATINUM_HALL_OF_FAME_PRIMARY_OFFSET,
  );

  const backupErased = isErasedCopy(
    bytes,
    PLATINUM_HALL_OF_FAME_BACKUP_OFFSET,
  );

  if (primaryErased && backupErased) {
    return null;
  }

  throw new Error(
    'Both Platinum Hall of Fame copies are invalid',
  );
}

function parsePokemon(
  data: DataView,
  offset: number,
): PlatinumHallOfFamePokemon {
  const moves = words(data, offset + 0x32, 4);
  const firstEmptyMove = moves.indexOf(0);

  return {
    species: data.getUint16(offset, true),
    level: data.getUint8(offset + 2),
    form: data.getUint8(offset + 3),
    personality: data.getUint32(
      offset + 4,
      true,
    ),
    otId: data.getUint32(
      offset + 8,
      true,
    ),
    nicknameCodes: words(
      data,
      offset + 0x0c,
      11,
    ),
    otNameCodes: words(
      data,
      offset + 0x22,
      8,
    ),
    moves:
      firstEmptyMove < 0
        ? moves
        : moves.slice(0, firstEmptyMove),
  };
}

export function parsePlatinumHallOfFameCopy(
  bytes: Uint8Array,
  copyOffset: number,
  source: 'primary' | 'backup' = 'primary',
  saveCounter: number | null = null,
): PlatinumHallOfFame {
  if (
    copyOffset < 0 ||
    copyOffset +
      PLATINUM_HALL_OF_FAME_BODY_SIZE >
      bytes.length
  ) {
    throw new Error(
      'Platinum Hall of Fame body is truncated',
    );
  }

  const data = view(bytes);

  const nextEntryIndex = data.getUint32(
    copyOffset +
      PLATINUM_HALL_OF_FAME_NEXT_INDEX_OFFSET,
    true,
  );

  const total = data.getUint32(
    copyOffset +
      PLATINUM_HALL_OF_FAME_TOTAL_OFFSET,
    true,
  );

  if (
    nextEntryIndex >=
    PLATINUM_HALL_OF_FAME_ENTRY_COUNT
  ) {
    throw new Error(
      `Invalid Platinum Hall of Fame next entry index ${nextEntryIndex}`,
    );
  }

  if (total > MAX_TOTAL_ENTRIES) {
    throw new Error(
      `Invalid Platinum Hall of Fame total ${total}`,
    );
  }

  const stored = Math.min(
    total,
    PLATINUM_HALL_OF_FAME_ENTRY_COUNT,
  );

  const oldestIndex =
    (nextEntryIndex -
      stored +
      PLATINUM_HALL_OF_FAME_ENTRY_COUNT) %
    PLATINUM_HALL_OF_FAME_ENTRY_COUNT;

  const entries = Array.from(
    { length: stored },
    (_, chronologicalIndex) => {
      const physicalIndex =
        (oldestIndex + chronologicalIndex) %
        PLATINUM_HALL_OF_FAME_ENTRY_COUNT;

      const entryOffset =
        copyOffset +
        physicalIndex *
          PLATINUM_HALL_OF_FAME_ENTRY_SIZE;

      const pokemon: PlatinumHallOfFamePokemon[] =
        [];

      for (
        let slot = 0;
        slot <
        PLATINUM_HALL_OF_FAME_PARTY_SIZE;
        slot++
      ) {
        const pokemonOffset =
          entryOffset +
          slot *
            PLATINUM_HALL_OF_FAME_POKEMON_SIZE;

        const species = data.getUint16(
          pokemonOffset,
          true,
        );

        if (species === 0) {
          break;
        }

        if (species > 493) {
          throw new Error(
            `Invalid Platinum Hall of Fame species ${species}`,
          );
        }

        pokemon.push(
          parsePokemon(data, pokemonOffset),
        );
      }

      const year = data.getUint16(
        entryOffset + 0x168,
        true,
      );

      const month = data.getUint8(
        entryOffset + 0x16a,
      );

      const day = data.getUint8(
        entryOffset + 0x16b,
      );

      if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
      ) {
        throw new Error(
          `Invalid Platinum Hall of Fame date ${year}-${month}-${day}`,
        );
      }

      return {
        number:
          total - stored + chronologicalIndex + 1,
        year,
        month,
        day,
        pokemon,
      };
    },
  );

  return {
    total,
    nextEntryIndex,
    entries,
    source,
    saveCounter,
  };
}

export function readPlatinumHallOfFame(
  bytes: Uint8Array,
): PlatinumHallOfFame {
  validatePlatinumSaveSize(bytes);

  const selected = selectHallOfFameCopy(bytes);

  if (!selected) {
    return {
      total: 0,
      nextEntryIndex: 0,
      entries: [],
      source: 'none',
      saveCounter: null,
    };
  }

  return parsePlatinumHallOfFameCopy(
    bytes,
    selected.offset,
    selected.source,
    selected.footer.saveCounter,
  );
}
