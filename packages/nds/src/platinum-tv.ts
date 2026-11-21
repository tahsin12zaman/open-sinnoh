import {
  selectPlatinumSaveBlocks,
} from './platinum-save.ts';

export const PLATINUM_TV_OFFSET = 0x8180;
export const PLATINUM_TV_SIZE = 0xbc8;
export const PLATINUM_TV_ENTRY_SIZE = 0xbd0;

const SLOT_SIZE = 0x30;
const SLOT_COUNT = 4;
const SLOT_DATA_OFFSET = 8;
const SLOT_DATA_SIZE = 40;

const INTERVIEWS_OFFSET = 0x0c;
const SIGHTINGS_OFFSET = 0xcc;
const RECORDS_OFFSET = 0x18c;

const CONTEST_OFFSET = 0xb4c;
const AMITY_OFFSET = 0xb56;
const POFFIN_OFFSET = 0xb7a;
const TOWER_OFFSET = 0xb7c;
const SAFARI_OFFSET = 0xb80;
const HALL_OFFSET = 0xb88;
const BP_OFFSET = 0xbbc;

export interface PlatinumTvSlot {
  id: number;
  plays: number;
  timestamp: number;
  data: Uint8Array;
}

export interface PlatinumTvPending {
  contest: {
    present: boolean;
    species: number;
    rank: number;
    type: number;
    placement: number;
  };
  amity: {
    present: boolean;
    species: number;
    nicknamePresent: boolean;
    nicknameCodes: number[];
    nature: number;
    findType: number;
    find: number;
  };
  poffin: {
    present: boolean;
    type: number;
  };
  tower: {
    present: boolean;
    win: boolean;
    streak: number;
  };
  safari: {
    present: boolean;
    species: number;
    caught: number;
  };
  hall: {
    present: boolean;
    species: number;
    nicknamePresent: boolean;
    nicknameCodes: number[];
  };
  bp: number;
}

export interface PlatinumTv {
  played: number[];
  slotMinutes: number;
  finished: boolean;
  interviews: PlatinumTvSlot[];
  sightings: PlatinumTvSlot[];
  records: PlatinumTvSlot[];
  pending: PlatinumTvPending;
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

function slots(
  bytes: Uint8Array,
  view: DataView,
  offset: number,
  maximumId: number,
): PlatinumTvSlot[] {
  return Array.from(
    { length: SLOT_COUNT },
    (_, index) => {
      const start = offset + index * SLOT_SIZE;
      const id = view.getUint8(start);
      const plays = view.getUint8(start + 1);

      if (id > maximumId) {
        throw new Error(
          `Invalid Platinum TV segment ${id} at 0x${start.toString(16)}`,
        );
      }

      if (plays > 3) {
        throw new Error(
          `Invalid Platinum TV play count ${plays} at 0x${(start + 1).toString(16)}`,
        );
      }

      return {
        id,
        plays,
        timestamp: view.getUint32(
          start + 4,
          true,
        ),
        data: bytes.slice(
          start + SLOT_DATA_OFFSET,
          start +
            SLOT_DATA_OFFSET +
            SLOT_DATA_SIZE,
        ),
      };
    },
  );
}

export function decodePlatinumTv(
  bytes: Uint8Array,
): PlatinumTv {
  if (bytes.length < PLATINUM_TV_SIZE) {
    throw new RangeError(
      `Platinum TV data is ${bytes.length} bytes; expected ${PLATINUM_TV_SIZE}`,
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    PLATINUM_TV_SIZE,
  );

  const slotMinutes = view.getInt32(4, true);

  if (slotMinutes < 0 || slotMinutes > 15) {
    throw new Error(
      `Invalid Platinum TV slot minutes: ${slotMinutes}`,
    );
  }

  const finished = view.getUint8(8);

  if (finished > 1) {
    throw new Error(
      `Invalid Platinum TV finished flag: ${finished}`,
    );
  }

  return {
    played: Array.from(
      bytes.subarray(0, 4),
    ).filter((id) => id !== 0),
    slotMinutes,
    finished: finished !== 0,
    interviews: slots(
      bytes,
      view,
      INTERVIEWS_OFFSET,
      18,
    ),
    sightings: slots(
      bytes,
      view,
      SIGHTINGS_OFFSET,
      26,
    ),
    records: slots(
      bytes,
      view,
      RECORDS_OFFSET,
      10,
    ),
    pending: {
      contest: {
        present:
          view.getUint8(CONTEST_OFFSET) !== 0,
        species: view.getUint16(
          CONTEST_OFFSET + 2,
          true,
        ),
        rank: view.getUint8(
          CONTEST_OFFSET + 7,
        ),
        type: view.getUint8(
          CONTEST_OFFSET + 8,
        ),
        placement: view.getUint8(
          CONTEST_OFFSET + 9,
        ),
      },
      amity: {
        present:
          view.getUint8(AMITY_OFFSET) !== 0,
        species: view.getUint16(
          AMITY_OFFSET + 2,
          true,
        ),
        nicknamePresent:
          view.getUint8(AMITY_OFFSET + 7) !== 0,
        nicknameCodes: uint16Array(
          view,
          AMITY_OFFSET + 8,
          11,
        ),
        nature: view.getUint8(
          AMITY_OFFSET + 0x1e,
        ),
        findType: view.getUint8(
          AMITY_OFFSET + 0x1f,
        ),
        find: view.getUint8(
          AMITY_OFFSET + 0x20,
        ),
      },
      poffin: {
        present:
          view.getUint8(POFFIN_OFFSET) !== 0,
        type: view.getUint8(
          POFFIN_OFFSET + 1,
        ),
      },
      tower: {
        present:
          view.getUint8(TOWER_OFFSET) !== 0,
        win:
          view.getUint8(TOWER_OFFSET + 1) !== 0,
        streak: view.getUint16(
          TOWER_OFFSET + 2,
          true,
        ),
      },
      safari: {
        present:
          view.getUint8(SAFARI_OFFSET) !== 0,
        species: view.getUint16(
          SAFARI_OFFSET + 2,
          true,
        ),
        caught: view.getUint8(
          SAFARI_OFFSET + 7,
        ),
      },
      hall: {
        present:
          view.getUint8(HALL_OFFSET) !== 0,
        species: view.getUint16(
          HALL_OFFSET + 2,
          true,
        ),
        nicknamePresent:
          view.getUint8(HALL_OFFSET + 7) !== 0,
        nicknameCodes: uint16Array(
          view,
          HALL_OFFSET + 8,
          11,
        ),
      },
      bp: view.getUint32(
        BP_OFFSET + 4,
        true,
      ),
    },
  };
}

export function readPlatinumTv(
  bytes: Uint8Array,
): PlatinumTv {
  const { general } =
    selectPlatinumSaveBlocks(bytes);
  const start =
    general.offset + PLATINUM_TV_OFFSET;

  return decodePlatinumTv(
    bytes.subarray(
      start,
      start + PLATINUM_TV_SIZE,
    ),
  );
}
