import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import type { PlatinumSpecialEncounters } from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumSpecialEncounters,
  convertPlatinumSpecialEncounters,
} from './platinum-special-encounters.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function nativeState(): PlatinumSpecialEncounters {
  return {
    marshDaily: 0x12345678,
    swarmDaily: 0x87654321,
    trophyGarden: [4, null],
    lastHoneyTree: 5,
    honeyTrees: Array.from(
      { length: 21 },
      (_, index) =>
        index === 0
          ? {
              minutes: 1080,
              slot: 3,
              table: 1,
              group: 2,
              shakes: 3,
            }
          : {
              minutes: 0,
              slot: 0,
              table: 0,
              group: 0,
              shakes: 0,
            },
    ),
    radarRecords: [
      {
        species: 387,
        count: 42,
      },
      {
        species: 0,
        count: 0,
      },
      {
        species: 390,
        count: 19,
      },
    ],
    swarms: true,
    repelSteps: 99,
    radarCharge: 50,
    fluteFactor: 2,
  };
}

describe('Platinum special-encounter import', () => {
  it('converts all modeled encounter fields', () => {
    const converted =
      convertPlatinumSpecialEncounters(
        nativeState(),
      );

    expect(converted).toMatchObject({
      lastHoneyTree: 5,
      radarCharge: 50,
      swarms: true,
      trophyGarden: [4, null],
      radarRecords: [
        {
          species:
            'platinum:SPECIES_TURTWIG',
          count: 42,
        },
        {
          species: null,
          count: 0,
        },
        {
          species:
            'platinum:SPECIES_CHIMCHAR',
          count: 19,
        },
      ],
    });

    expect(converted.honeyTrees).toHaveLength(
      21,
    );

    expect(converted.honeyTrees[0]).toEqual({
      minutes: 1080,
      slot: 3,
      table: 1,
      group: 2,
      shakes: 3,
    });
  });

  it.skipIf(!savePath)(
    'applies a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = {
        gameTime: {
          now: {
            date: '2009-03-22',
            hour: 12,
            minute: 0,
            second: 0,
          },
          penaltyMinutes: 0,
          dailyRandom: 123,
        },
        repel: 999,
      } as unknown as GameState;

      const converted =
        applyPlatinumSpecialEncounters(
          base,
          save,
        );

      console.log(
        'converted special encounters:',
        {
          gameTime: converted.gameTime,
          encounters: converted.encounters,
          repel: converted.repel,
        },
      );

      expect(converted.gameTime).toMatchObject({
        dailyRandom: 123,
        marshDaily: 2491341065,
        swarmDaily: 2491341065,
      });

      expect(converted.encounters).toMatchObject({
        lastHoneyTree: 21,
        radarCharge: 50,
        swarms: false,
        trophyGarden: [null, null],
      });

      expect(
        converted.encounters?.honeyTrees,
      ).toHaveLength(21);

      expect(
        converted.encounters?.radarRecords,
      ).toEqual([
        {
          species: null,
          count: 0,
        },
        {
          species: null,
          count: 0,
        },
        {
          species: null,
          count: 0,
        },
      ]);

      expect(converted.repel).toBe(0);
      expect(base.repel).toBe(999);
      expect(base.encounters).toBeUndefined();
    },
  );
});
