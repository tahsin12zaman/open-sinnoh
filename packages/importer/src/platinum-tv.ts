import {
  POKETCH_APPS,
  poketchAppId,
  type GameState,
  type TvRecord,
  type TvSegmentData,
  type TvState,
} from '@opensinnoh/contracts';
import {
  readPlatinumTv,
  type PlatinumTv,
  type PlatinumTvSlot,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with {
  type: 'json',
};
import {
  Names,
  type NamesFile,
} from './names.ts';
import {
  decodePlatinumName,
} from './platinum-save.ts';

const NAMES = new Names(
  namesFile as NamesFile,
);

function view(slot: PlatinumTvSlot): DataView {
  return new DataView(
    slot.data.buffer,
    slot.data.byteOffset,
    slot.data.byteLength,
  );
}

function u16(
  data: DataView,
  offset: number,
): number {
  return data.getUint16(offset, true);
}

function u32(
  data: DataView,
  offset: number,
): number {
  return data.getUint32(offset, true);
}

function codes(
  data: DataView,
  offset: number,
  count = 11,
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

function optionalName(
  present: boolean,
  value: readonly number[],
): string | null {
  if (!present) return null;

  const decoded = decodePlatinumName(value);
  return decoded.length === 0
    ? null
    : decoded;
}

function appId(index: number) {
  const name = POKETCH_APPS[index];

  if (name === undefined) {
    throw new Error(
      `Unknown Platinum Pokétch app ${index}`,
    );
  }

  return poketchAppId('platinum', name);
}

function interview(
  slot: PlatinumTvSlot,
): TvSegmentData | null {
  const data = view(slot);

  switch (slot.id) {
    case 2:
      return {
        kind: 'tower-corner',
        win: data.getUint8(1) !== 0,
        streak: u16(data, 2),
        word: u16(data, 4),
      };

    case 4:
      return {
        kind: 'your-pokemon',
        species: NAMES.species(u16(data, 0)),
        nickname: optionalName(
          data.getUint8(5) !== 0,
          codes(data, 6),
        ),
        word: u16(data, 0x1c),
      };

    case 6: {
      const index = data.getInt32(0, true);

      return {
        kind: 'poketch',
        app: index < 0 ? null : appId(index),
        word: u16(data, 4),
      };
    }

    case 7:
      return {
        kind: 'contest',
        species: NAMES.species(u16(data, 2)),
        rank: data.getUint8(7),
        type: data.getUint8(8),
        placement: data.getUint8(9),
        word: u16(data, 10),
      };

    case 9:
      return {
        kind: 'photo',
        species: NAMES.species(u16(data, 0)),
        word: u16(data, 2),
      };

    case 10:
      return {
        kind: 'personality',
        type: data.getInt32(0, true),
      };

    case 11:
      return {
        kind: 'poffin',
        poffin: data.getUint8(1),
        word: u16(data, 2),
      };

    case 13: {
      const findType = data.getUint8(0x1f);
      const found =
        findType === 1
          ? {
              item: NAMES.item(
                u16(data, 0x22),
              ),
            }
          : findType === 2
            ? {
                accessory:
                  data.getUint8(0x20),
              }
            : null;

      return {
        kind: 'amity',
        species: NAMES.species(u16(data, 2)),
        nature: data.getUint8(0x1e),
        found,
        word: u16(data, 0x24),
      };
    }

    case 14:
      return {
        kind: 'frontier-single',
        species: NAMES.species(u16(data, 2)),
        nickname: optionalName(
          data.getUint8(7) !== 0,
          codes(data, 8),
        ),
        word: u16(data, 0x1e),
      };

    case 15:
    case 16:
    case 17:
    case 18:
      return {
        kind: 'in-your-face',
        question: (slot.id - 14) as
          | 1
          | 2
          | 3
          | 4,
        word: u16(data, 0),
      };

    default:
      return null;
  }
}

function sighting(
  slot: PlatinumTvSlot,
): TvSegmentData | null {
  const data = view(slot);

  switch (slot.id) {
    case 1:
      return {
        kind: 'catch-success',
        balls: u16(data, 4),
        species: NAMES.species(
          u16(data, 6),
        ),
        nickname: optionalName(
          data.getUint8(11) !== 0,
          codes(data, 12),
        ),
        ball: NAMES.item(
          u16(data, 0x22),
        ),
      };

    case 2:
      return {
        kind: 'catch-failure',
        balls: u16(data, 4),
        fainted:
          (u32(data, 0) & 1) !== 0,
      };

    case 3:
      return {
        kind: 'fishing',
        rod: NAMES.item(u16(data, 6)),
        species:
          data.getInt32(8, true) !== 0
            ? NAMES.species(u16(data, 0))
            : null,
      };

    case 6:
      return {
        kind: 'hidden-item',
        item: NAMES.item(u16(data, 0)),
        location: u16(data, 2),
      };

    case 7:
      return {
        kind: 'shopping',
        item: NAMES.item(u16(data, 0)),
        amount: data.getUint8(2),
      };

    case 8:
      return {
        kind: 'egg',
        species: NAMES.species(u16(data, 0)),
        location: u16(data, 6),
      };

    case 10:
      return {
        kind: 'name-change',
        species: NAMES.species(u16(data, 0)),
        nickname: decodePlatinumName(
          codes(data, 6),
        ),
      };

    case 13:
      return {
        kind: 'ug-treasure',
        item: u16(data, 0),
        amount: u16(data, 2),
      };

    case 15:
      return {
        kind: 'safari',
        species: NAMES.species(u16(data, 0)),
        caught: data.getUint8(5),
      };

    case 16:
      return {
        kind: 'storage',
        species: NAMES.species(u16(data, 0)),
        male: data.getUint8(2) === 0,
      };

    case 18:
      return {
        kind: 'berries',
        berry: NAMES.item(u16(data, 0)),
        amount: u16(data, 4),
      };

    case 19:
      return {
        kind: 'no-berries',
        berry: NAMES.item(u16(data, 0)),
      };

    case 21:
      return {
        kind: 'seal-club',
        species: NAMES.species(u16(data, 0)),
        seal: data.getUint8(6),
      };

    case 25:
      return {
        kind: 'villa-empty',
      };

    case 26:
      return {
        kind: 'villa',
        furniture: data.getUint8(0),
      };

    default:
      return null;
  }
}

function record(
  slot: PlatinumTvSlot,
): TvSegmentData | null {
  const data = view(slot);

  switch (slot.id) {
    case 1:
      return {
        kind: 'tower-streak',
        streak: u16(data, 0),
        species: NAMES.species(u16(data, 2)),
        single: data.getUint8(7) !== 0,
      };

    case 3:
      return {
        kind: 'size',
        species: NAMES.species(u16(data, 0)),
        size: u32(data, 8),
      };

    case 4:
      return {
        kind: 'slots',
        before: u32(data, 0),
        after: u32(data, 4),
        spent: u32(data, 8),
      };

    case 5:
      return {
        kind: 'ribbons',
        nickname: optionalName(
          data.getUint8(24) !== 0,
          codes(data, 0),
        ),
        ribbon: data.getUint8(22),
        count: data.getUint8(23),
        species: NAMES.species(
          u16(data, 28),
        ),
      };

    case 8:
      return {
        kind: 'traps',
        trap: u16(data, 0),
        count: u16(data, 2),
      };

    case 10:
      return {
        kind: 'bp',
        total: u32(data, 4),
      };

    default:
      return null;
  }
}

function convertSlots(
  slots: readonly PlatinumTvSlot[],
  convert: (
    slot: PlatinumTvSlot,
  ) => TvSegmentData | null,
): (TvRecord | null)[] {
  return slots.map((slot) => {
    if (slot.id === 0) return null;

    const data = convert(slot);

    return data === null
      ? null
      : {
          data,
          plays: slot.plays,
        };
  });
}

export function convertPlatinumTv(
  native: PlatinumTv,
): TvState {
  const pending = native.pending;

  return {
    played: [...native.played],
    slotMinutes: native.slotMinutes,
    finished: native.finished,
    interviews: convertSlots(
      native.interviews,
      interview,
    ),
    sightings: convertSlots(
      native.sightings,
      sighting,
    ),
    records: convertSlots(
      native.records,
      record,
    ),
    pending: {
      contest:
        pending.contest.present &&
        pending.contest.species !== 0
          ? {
              species: NAMES.species(
                pending.contest.species,
              ),
              type: pending.contest.type,
              rank: pending.contest.rank,
              placement:
                pending.contest.placement,
            }
          : null,
      amity:
        pending.amity.present &&
        pending.amity.species !== 0
          ? {
              species: NAMES.species(
                pending.amity.species,
              ),
              nature: pending.amity.nature,
              found:
                pending.amity.findType === 1
                  ? {
                      item: NAMES.item(
                        pending.amity.find,
                      ),
                    }
                  : pending.amity.findType === 2
                    ? {
                        accessory:
                          pending.amity.find,
                      }
                    : null,
            }
          : null,
      poffin: pending.poffin.present
        ? pending.poffin.type
        : null,
      tower: pending.tower.present
        ? {
            win: pending.tower.win,
            streak: pending.tower.streak,
          }
        : null,
      safari:
        pending.safari.present &&
        pending.safari.species !== 0
          ? NAMES.species(
              pending.safari.species,
            )
          : null,
      hall:
        pending.hall.present &&
        pending.hall.species !== 0
          ? {
              species: NAMES.species(
                pending.hall.species,
              ),
              nickname: optionalName(
                pending.hall.nicknamePresent,
                pending.hall.nicknameCodes,
              ),
            }
          : null,
      bp: Math.min(9999, pending.bp),
    },
  };
}

export function applyPlatinumTv(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    tv: convertPlatinumTv(
      readPlatinumTv(save),
    ),
  };
}
