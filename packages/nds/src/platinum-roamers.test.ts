import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  encodePlatinumRoamers,
  parsePlatinumRoamers,
  PLATINUM_RECENT_ROUTES_OFFSET,
  PLATINUM_ROAMERS_OFFSET,
  PLATINUM_ROAMER_COUNT,
  PLATINUM_ROAMER_ROUTE_COUNT,
  PLATINUM_ROAMER_ROUTE_INDEXES_OFFSET,
  PLATINUM_ROAMER_SIZE,
  PLATINUM_SPECIAL_ENCOUNTER_OFFSET,
  PLATINUM_SPECIAL_ENCOUNTER_SIZE,
  readPlatinumRoamers,
  writePlatinumRoamers,
  type PlatinumRoamerState,
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

function makeState(): PlatinumRoamerState {
  return {
    currentMapId: 200,
    previousMapId: 428,
    roamers: Array.from(
      { length: PLATINUM_ROAMER_COUNT },
      (_, slot) => ({
        currentMapId: 200 + slot,
        ivs: (0x2d6b59f1 + slot) >>> 0,
        personality:
          (0x12345678 + slot) >>> 0,
        species:
          slot < 3
            ? 481 + slot
            : 0,
        currentHp:
          slot < 3
            ? 73 + slot
            : 0,
        level:
          slot < 3
            ? 50 + slot
            : 0,
        status:
          slot === 0
            ? 0x40
            : 0,
        active: slot < 3,
      })),
    routeIndexes: [27, 4, 18, 0, 1, 28],
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

  writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 140, 1);
  writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 140, 2);
  writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 140, 1);
  writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 140, 2);

  return save;
}

describe('Platinum roamers', () => {
  it('parses an active synthetic roamer', () => {
    const bytes = new Uint8Array(
      PLATINUM_SPECIAL_ENCOUNTER_SIZE,
    );

    const view = new DataView(bytes.buffer);

    view.setInt32(
      PLATINUM_RECENT_ROUTES_OFFSET,
      200,
      true,
    );
    view.setInt32(
      PLATINUM_RECENT_ROUTES_OFFSET + 4,
      428,
      true,
    );

    const roamerOffset = PLATINUM_ROAMERS_OFFSET;

    view.setInt32(roamerOffset, 200, true);
    view.setUint32(roamerOffset + 4, 0x2d6b59f1, true);
    view.setUint32(roamerOffset + 8, 0x12345678, true);
    view.setUint16(roamerOffset + 0x0c, 481, true);
    view.setUint16(roamerOffset + 0x0e, 73, true);
    view.setUint8(roamerOffset + 0x10, 50);
    view.setUint8(roamerOffset + 0x11, 0x40);
    view.setUint8(roamerOffset + 0x12, 1);

    view.setUint8(
      PLATINUM_ROAMER_ROUTE_INDEXES_OFFSET,
      27,
    );

    const state = parsePlatinumRoamers(bytes);

    expect(state.currentMapId).toBe(200);
    expect(state.previousMapId).toBe(428);
    expect(state.routeIndexes).toEqual([
      27, 0, 0, 0, 0, 0,
    ]);
    expect(state.roamers[0]!.species).toBe(481);
    expect(state.roamers[0]!.active).toBe(true);
  });

  it('encodes and parses the complete roamer state', () => {
    const bytes = new Uint8Array(
      PLATINUM_SPECIAL_ENCOUNTER_SIZE,
    );
    const state = makeState();

    encodePlatinumRoamers(bytes, state);

    expect(parsePlatinumRoamers(bytes)).toEqual(
      state,
    );
  });

  it('round-trips roamers through a complete save', () => {
    const state = makeState();

    const written = writePlatinumRoamers(
      makeSave(),
      state,
    );

    expect(readPlatinumRoamers(written)).toEqual(
      state,
    );
  });

  it('preserves padding and unrelated encounter data', () => {
    const marked = writePlatinumSave(
      makeSave(),
      ({ general }) => {
        general[
          PLATINUM_SPECIAL_ENCOUNTER_OFFSET + 0x20
        ] = 0xa5;

        for (
          let slot = 0;
          slot < PLATINUM_ROAMER_COUNT;
          slot++
        ) {
          general[
            PLATINUM_SPECIAL_ENCOUNTER_OFFSET +
              PLATINUM_ROAMERS_OFFSET +
              slot * PLATINUM_ROAMER_SIZE +
              0x13
          ] = 0x50 + slot;
        }
      },
    );

    const written = writePlatinumRoamers(
      marked,
      makeState(),
    );

    const { general } =
      selectPlatinumSaveBlocks(written);

    expect(
      written[
        general.offset +
          PLATINUM_SPECIAL_ENCOUNTER_OFFSET +
          0x20
      ],
    ).toBe(0xa5);

    for (
      let slot = 0;
      slot < PLATINUM_ROAMER_COUNT;
      slot++
    ) {
      expect(
        written[
          general.offset +
            PLATINUM_SPECIAL_ENCOUNTER_OFFSET +
            PLATINUM_ROAMERS_OFFSET +
            slot * PLATINUM_ROAMER_SIZE +
            0x13
        ],
      ).toBe(0x50 + slot);
    }
  });

  it('rejects invalid roamer data', () => {
    const state = makeState();

    expect(() =>
      writePlatinumRoamers(makeSave(), {
        ...state,
        routeIndexes: [
          PLATINUM_ROAMER_ROUTE_COUNT,
          0,
          0,
          0,
          0,
          0,
        ],
      }),
    ).toThrow(/route index/i);

    expect(() =>
      writePlatinumRoamers(makeSave(), {
        ...state,
        roamers: state.roamers.slice(0, -1),
      }),
    ).toThrow(/roamer count/i);

    expect(() =>
      writePlatinumRoamers(makeSave(), {
        ...state,
        roamers: state.roamers.map(
          (roamer, index) =>
            index === 0
              ? {
                  ...roamer,
                  species: 0,
                  active: true,
                }
              : roamer,
        ),
      }),
    ).toThrow(/species/i);
  });

  it('rejects a truncated encounter block', () => {
    expect(() =>
      parsePlatinumRoamers(
        new Uint8Array(
          PLATINUM_SPECIAL_ENCOUNTER_SIZE - 1,
        ),
      ),
    ).toThrow(/truncated/i);
  });

  it('rejects an invalid route index', () => {
    const bytes = new Uint8Array(
      PLATINUM_SPECIAL_ENCOUNTER_SIZE,
    );

    bytes[
      PLATINUM_ROAMER_ROUTE_INDEXES_OFFSET
    ] = 29;

    expect(() =>
      parsePlatinumRoamers(bytes),
    ).toThrow(/route index 29/i);
  });

  it.skipIf(!savePath)(
    'reads the roamers from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const state = readPlatinumRoamers(save);

      console.log('roamers:', state);

      expect(state.roamers).toHaveLength(6);
      expect(state.routeIndexes).toHaveLength(6);

      for (const route of state.routeIndexes) {
        expect(route).toBeGreaterThanOrEqual(0);
        expect(route).toBeLessThan(29);
      }
    },
  );
});
