import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  encodePlatinumSpecialEncounters,
  parsePlatinumSpecialEncounters,
  PLATINUM_HONEY_TREE_COUNT,
  PLATINUM_RADAR_RECORD_COUNT,
  PLATINUM_SPECIAL_TRAILING_OFFSET,
  readPlatinumSpecialEncounters,
  writePlatinumSpecialEncounters,
  type PlatinumSpecialEncounters,
} from './platinum-special-encounters.ts';
import {
  PLATINUM_SPECIAL_ENCOUNTER_OFFSET,
  PLATINUM_SPECIAL_ENCOUNTER_SIZE,
} from './platinum-roamers.ts';
import {
  crc16Ccitt,
  PLATINUM_GENERAL_BLOCK,
  PLATINUM_SAVE_COPY_OFFSETS,
  PLATINUM_SAVE_FOOTER_SIZE,
  PLATINUM_SAVE_SIGNATURE,
  PLATINUM_SAVE_SIZE,
  PLATINUM_STORAGE_BLOCK,
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function makeState(): PlatinumSpecialEncounters {
  return {
    marshDaily: 0x12345678,
    swarmDaily: 0x87654321,
    trophyGarden: [4, null],
    lastHoneyTree: 21,
    honeyTrees: Array.from(
      { length: PLATINUM_HONEY_TREE_COUNT },
      (_, index) => ({
        minutes: (index * 60) % 1441,
        slot: index % 6,
        table: index % 3,
        group: index % 4,
        shakes: index % 4,
      }),
    ),
    radarRecords: [
      {
        species: 387,
        count: 42,
      },
      {
        species: 25,
        count: 999,
      },
      {
        species: 0,
        count: 0,
      },
    ],
    swarms: true,
    repelSteps: 255,
    radarCharge: 50,
    fluteFactor: 2,
  };
}

function makeBlock(
  size: number,
  blockId: number,
  saveCounter: number,
  blockCounter: number,
): Uint8Array {
  const bytes = new Uint8Array(size);
  const footerOffset =
    size - PLATINUM_SAVE_FOOTER_SIZE;
  const view = new DataView(bytes.buffer);

  view.setUint32(footerOffset, saveCounter, true);
  view.setUint32(footerOffset + 4, blockCounter, true);
  view.setUint32(footerOffset + 8, size, true);
  view.setUint32(
    footerOffset + 12,
    PLATINUM_SAVE_SIGNATURE,
    true,
  );
  view.setUint8(footerOffset + 16, blockId);
  view.setUint16(
    footerOffset + 18,
    crc16Ccitt(bytes, 0, footerOffset),
    true,
  );

  return bytes;
}

function writeBlock(
  save: Uint8Array,
  copyOffset: number,
  specification: {
    offset: number;
    size: number;
    blockId: number;
  },
  saveCounter: number,
  blockCounter: number,
): void {
  save.set(
    makeBlock(
      specification.size,
      specification.blockId,
      saveCounter,
      blockCounter,
    ),
    copyOffset + specification.offset,
  );
}

function makeSave(): Uint8Array {
  const save = new Uint8Array(PLATINUM_SAVE_SIZE);
  const [primary, backup] =
    PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 150, 1);
  writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 150, 2);
  writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 150, 1);
  writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 150, 2);

  return save;
}

describe('Platinum special encounters', () => {
  it('encodes and parses the complete encounter state', () => {
    const bytes = new Uint8Array(
      PLATINUM_SPECIAL_ENCOUNTER_SIZE,
    );
    const state = makeState();

    encodePlatinumSpecialEncounters(bytes, state);

    expect(
      parsePlatinumSpecialEncounters(bytes),
    ).toEqual(state);
  });

  it('round-trips encounters through a complete save', () => {
    const state = makeState();

    const written =
      writePlatinumSpecialEncounters(
        makeSave(),
        state,
      );

    expect(
      readPlatinumSpecialEncounters(written),
    ).toEqual(state);
  });

  it('preserves unmodeled and roamer bytes', () => {
    const marked = writePlatinumSave(
      makeSave(),
      ({ general }) => {
        general[
          PLATINUM_SPECIAL_ENCOUNTER_OFFSET + 0x08
        ] = 0xa5;

        general[
          PLATINUM_SPECIAL_ENCOUNTER_OFFSET + 0xd0
        ] = 0x5a;
      },
    );

    const written =
      writePlatinumSpecialEncounters(
        marked,
        makeState(),
      );

    const { general } =
      selectPlatinumSaveBlocks(written);

    expect(
      written[
        general.offset +
          PLATINUM_SPECIAL_ENCOUNTER_OFFSET +
          0x08
      ],
    ).toBe(0xa5);

    expect(
      written[
        general.offset +
          PLATINUM_SPECIAL_ENCOUNTER_OFFSET +
          0xd0
      ],
    ).toBe(0x5a);
  });

  it('supports null trophy-garden entries', () => {
    const state = {
      ...makeState(),
      trophyGarden: [
        null,
        null,
      ] as [null, null],
    };

    const bytes = new Uint8Array(
      PLATINUM_SPECIAL_ENCOUNTER_SIZE,
    );

    encodePlatinumSpecialEncounters(bytes, state);

    expect(
      parsePlatinumSpecialEncounters(bytes)
        .trophyGarden,
    ).toEqual([null, null]);
  });

  it('rejects invalid encounter state', () => {
    const state = makeState();

    expect(() =>
      writePlatinumSpecialEncounters(
        makeSave(),
        {
          ...state,
          honeyTrees:
            state.honeyTrees.slice(0, -1),
        },
      ),
    ).toThrow(/honey-tree count/i);

    expect(() =>
      writePlatinumSpecialEncounters(
        makeSave(),
        {
          ...state,
          honeyTrees:
            state.honeyTrees.map(
              (tree, index) =>
                index === 0
                  ? {
                      ...tree,
                      minutes: 1441,
                    }
                  : tree,
            ),
        },
      ),
    ).toThrow(/minutes/i);

    expect(() =>
      writePlatinumSpecialEncounters(
        makeSave(),
        {
          ...state,
          radarRecords: Array.from(
            {
              length:
                PLATINUM_RADAR_RECORD_COUNT,
            },
            () => ({
              species: 494,
              count: 0,
            }),
          ),
        },
      ),
    ).toThrow(/species/i);

    expect(() =>
      writePlatinumSpecialEncounters(
        makeSave(),
        {
          ...state,
          radarCharge: 51,
        },
      ),
    ).toThrow(/radar charge/i);
  });

  it('rejects a truncated block', () => {
    expect(() =>
      parsePlatinumSpecialEncounters(
        new Uint8Array(
          PLATINUM_SPECIAL_ENCOUNTER_SIZE - 1,
        ),
      ),
    ).toThrow(/truncated/i);
  });

  it('rejects invalid trailing data', () => {
    const bytes = new Uint8Array(
      PLATINUM_SPECIAL_ENCOUNTER_SIZE,
    );

    bytes[
      PLATINUM_SPECIAL_TRAILING_OFFSET
    ] = 2;

    expect(() =>
      parsePlatinumSpecialEncounters(bytes),
    ).toThrow(/swarm-enabled/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const state =
        readPlatinumSpecialEncounters(save);

      console.log(
        'special encounters:',
        state,
      );

      expect(state.honeyTrees).toHaveLength(21);
      expect(state.radarRecords).toHaveLength(3);
    },
  );
});
