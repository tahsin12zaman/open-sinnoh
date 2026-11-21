import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parsePlatinumSpecialEncounters,
  PLATINUM_HONEY_TREES_OFFSET,
  PLATINUM_RADAR_RECORDS_OFFSET,
  PLATINUM_SPECIAL_TRAILING_OFFSET,
  readPlatinumSpecialEncounters,
} from './platinum-special-encounters.ts';
import {
  PLATINUM_SPECIAL_ENCOUNTER_SIZE,
} from './platinum-roamers.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum special encounters', () => {
  it('parses synthetic encounter state', () => {
    const bytes = new Uint8Array(
      PLATINUM_SPECIAL_ENCOUNTER_SIZE,
    );

    const view = new DataView(bytes.buffer);

    view.setUint32(0, 0x12345678, true);
    view.setUint32(4, 0x87654321, true);
    view.setUint16(0x0c, 4, true);
    view.setUint16(0x0e, 0xffff, true);
    view.setUint8(0x10, 5);

    view.setInt32(
      PLATINUM_HONEY_TREES_OFFSET,
      1080,
      true,
    );
    view.setUint8(
      PLATINUM_HONEY_TREES_OFFSET + 4,
      3,
    );
    view.setUint8(
      PLATINUM_HONEY_TREES_OFFSET + 5,
      1,
    );
    view.setUint8(
      PLATINUM_HONEY_TREES_OFFSET + 6,
      2,
    );
    view.setUint8(
      PLATINUM_HONEY_TREES_OFFSET + 7,
      3,
    );

    view.setUint16(
      PLATINUM_RADAR_RECORDS_OFFSET,
      387,
      true,
    );
    view.setUint16(
      PLATINUM_RADAR_RECORDS_OFFSET + 2,
      42,
      true,
    );

    view.setUint8(
      PLATINUM_SPECIAL_TRAILING_OFFSET,
      1,
    );
    view.setUint8(
      PLATINUM_SPECIAL_TRAILING_OFFSET + 1,
      99,
    );
    view.setUint8(
      PLATINUM_SPECIAL_TRAILING_OFFSET + 2,
      50,
    );
    view.setUint8(
      PLATINUM_SPECIAL_TRAILING_OFFSET + 3,
      2,
    );

    const state =
      parsePlatinumSpecialEncounters(bytes);

    expect(state).toMatchObject({
      marshDaily: 0x12345678,
      swarmDaily: 0x87654321,
      trophyGarden: [4, null],
      lastHoneyTree: 5,
      swarms: true,
      repelSteps: 99,
      radarCharge: 50,
      fluteFactor: 2,
    });

    expect(state.honeyTrees[0]).toEqual({
      minutes: 1080,
      slot: 3,
      table: 1,
      group: 2,
      shakes: 3,
    });

    expect(state.honeyTrees).toHaveLength(21);

    expect(state.radarRecords).toEqual([
      {
        species: 387,
        count: 42,
      },
      {
        species: 0,
        count: 0,
      },
      {
        species: 0,
        count: 0,
      },
    ]);
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

  it('rejects invalid honey-tree data', () => {
    const bytes = new Uint8Array(
      PLATINUM_SPECIAL_ENCOUNTER_SIZE,
    );

    bytes[
      PLATINUM_HONEY_TREES_OFFSET + 4
    ] = 6;

    expect(() =>
      parsePlatinumSpecialEncounters(bytes),
    ).toThrow(/slot 6/i);
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
      expect(state.lastHoneyTree).toBe(21);
      expect(state.radarCharge).toBe(50);
      expect(state.swarms).toBe(false);
      expect(
        state.honeyTrees.every(
          (tree) => tree.minutes === 0,
        ),
      ).toBe(true);
    },
  );
});
