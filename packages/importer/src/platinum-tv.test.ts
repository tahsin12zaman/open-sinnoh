import {
  describe,
  expect,
  it,
} from 'vitest';
import type {
  PlatinumTv,
  PlatinumTvSlot,
} from '@opensinnoh/nds';
import {
  convertPlatinumTv,
} from './platinum-tv.ts';

function slot(
  id: number,
  plays: number,
  write?: (view: DataView) => void,
): PlatinumTvSlot {
  const data = new Uint8Array(40);
  write?.(new DataView(data.buffer));

  return {
    id,
    plays,
    timestamp: 0,
    data,
  };
}

const empty = (): PlatinumTvSlot =>
  slot(0, 0);

describe('Platinum TV import', () => {
  it('converts saved segments and pending data', () => {
    const native: PlatinumTv = {
      played: [2, 7],
      slotMinutes: 9,
      finished: false,
      interviews: [
        slot(2, 1, (view) => {
          view.setUint8(1, 1);
          view.setUint16(2, 49, true);
          view.setUint16(4, 123, true);
        }),
        empty(),
        empty(),
        empty(),
      ],
      sightings: [
        slot(6, 2, (view) => {
          view.setUint16(0, 1, true);
          view.setUint16(2, 55, true);
        }),
        empty(),
        empty(),
        empty(),
      ],
      records: [
        slot(10, 3, (view) => {
          view.setUint32(4, 321, true);
        }),
        empty(),
        empty(),
        empty(),
      ],
      pending: {
        contest: {
          present: true,
          species: 25,
          rank: 2,
          type: 3,
          placement: 1,
        },
        amity: {
          present: false,
          species: 0,
          nicknamePresent: false,
          nicknameCodes: Array(11).fill(0),
          nature: 0,
          findType: 0,
          find: 0,
        },
        poffin: {
          present: true,
          type: 4,
        },
        tower: {
          present: true,
          win: true,
          streak: 49,
        },
        safari: {
          present: true,
          species: 54,
          caught: 6,
        },
        hall: {
          present: true,
          species: 244,
          nicknamePresent: false,
          nicknameCodes: Array(11).fill(0),
        },
        bp: 400,
      },
    };

    expect(convertPlatinumTv(native))
      .toMatchObject({
        played: [2, 7],
        slotMinutes: 9,
        finished: false,
        interviews: [
          {
            plays: 1,
            data: {
              kind: 'tower-corner',
              win: true,
              streak: 49,
              word: 123,
            },
          },
          null,
          null,
          null,
        ],
        sightings: [
          {
            plays: 2,
            data: {
              kind: 'hidden-item',
              item: 'platinum:ITEM_MASTER_BALL',
              location: 55,
            },
          },
          null,
          null,
          null,
        ],
        records: [
          {
            plays: 3,
            data: {
              kind: 'bp',
              total: 321,
            },
          },
          null,
          null,
          null,
        ],
        pending: {
          contest: {
            species: 'platinum:SPECIES_PIKACHU',
            rank: 2,
            type: 3,
            placement: 1,
          },
          poffin: 4,
          tower: {
            win: true,
            streak: 49,
          },
          safari: 'platinum:SPECIES_PSYDUCK',
          hall: {
            species: 'platinum:SPECIES_ENTEI',
            nickname: null,
          },
          bp: 400,
        },
      });
  });

  it('drops unsupported native and Wi-Fi-only segments', () => {
    const native: PlatinumTv = {
      played: [],
      slotMinutes: 0,
      finished: false,
      interviews: [
        slot(1, 0),
        empty(),
        empty(),
        empty(),
      ],
      sightings: [
        slot(4, 0),
        empty(),
        empty(),
        empty(),
      ],
      records: [
        slot(2, 0),
        empty(),
        empty(),
        empty(),
      ],
      pending: {
        contest: {
          present: false,
          species: 0,
          rank: 0,
          type: 0,
          placement: 0,
        },
        amity: {
          present: false,
          species: 0,
          nicknamePresent: false,
          nicknameCodes: Array(11).fill(0),
          nature: 0,
          findType: 0,
          find: 0,
        },
        poffin: {
          present: false,
          type: 0,
        },
        tower: {
          present: false,
          win: false,
          streak: 0,
        },
        safari: {
          present: false,
          species: 0,
          caught: 0,
        },
        hall: {
          present: false,
          species: 0,
          nicknamePresent: false,
          nicknameCodes: Array(11).fill(0),
        },
        bp: 0,
      },
    };

    const converted = convertPlatinumTv(native);

    expect(converted.interviews[0]).toBeNull();
    expect(converted.sightings[0]).toBeNull();
    expect(converted.records[0]).toBeNull();
  });
});
