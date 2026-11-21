import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import type {
  PlatinumHallOfFame,
  PlatinumHallOfFamePokemon,
} from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumHallOfFame,
  convertPlatinumHallOfFame,
  convertPlatinumHallOfFamePokemon,
} from './platinum-hall-of-fame.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

const TEST_NAME_CODES = [
  318,
  329,
  343,
  344,
  0xffff,
  0,
  0,
  0,
  0,
  0,
  0,
];

const TEST_OT_CODES = [
  318,
  329,
  343,
  344,
  0xffff,
  0,
  0,
  0,
];

function pokemon(): PlatinumHallOfFamePokemon {
  return {
    species: 387,
    level: 50,
    form: 1,
    personality: 0x12345678,
    otId: 0x87654321,
    nicknameCodes: TEST_NAME_CODES,
    otNameCodes: TEST_OT_CODES,
    moves: [33, 45],
  };
}

function hall(): PlatinumHallOfFame {
  return {
    total: 31,
    nextEntryIndex: 1,
    source: 'primary',
    saveCounter: 7,
    entries: [
      {
        number: 2,
        year: 25,
        month: 11,
        day: 19,
        pokemon: [pokemon()],
      },
      {
        number: 31,
        year: 26,
        month: 1,
        day: 2,
        pokemon: [
          {
            ...pokemon(),
            species: 390,
            form: 0,
            level: 60,
          },
        ],
      },
    ],
  };
}

describe('Platinum Hall of Fame import', () => {
  it('converts a recorded Pokémon', () => {
    expect(
      convertPlatinumHallOfFamePokemon(
        pokemon(),
      ),
    ).toEqual({
      species: 'platinum:SPECIES_TURTWIG',
      form: 1,
      level: 50,
      pid: 0x12345678,
      otId: 0x87654321,
      nickname: 'Test',
      otName: 'Test',
      moves: [
        'platinum:MOVE_TACKLE',
        'platinum:MOVE_GROWL',
      ],
    });
  });

  it('converts entries oldest first', () => {
    expect(
      convertPlatinumHallOfFame(hall()),
    ).toEqual({
      total: 31,
      entries: [
        {
          date: '2025-11-19',
          party: [
            {
              species:
                'platinum:SPECIES_TURTWIG',
              form: 1,
              level: 50,
              pid: 0x12345678,
              otId: 0x87654321,
              nickname: 'Test',
              otName: 'Test',
              moves: [
                'platinum:MOVE_TACKLE',
                'platinum:MOVE_GROWL',
              ],
            },
          ],
        },
        {
          date: '2026-01-02',
          party: [
            {
              species:
                'platinum:SPECIES_CHIMCHAR',
              form: 0,
              level: 60,
              pid: 0x12345678,
              otId: 0x87654321,
              nickname: 'Test',
              otName: 'Test',
              moves: [
                'platinum:MOVE_TACKLE',
                'platinum:MOVE_GROWL',
              ],
            },
          ],
        },
      ],
    });
  });

  it('maps an empty native Hall of Fame', () => {
    expect(
      convertPlatinumHallOfFame({
        total: 0,
        nextEntryIndex: 0,
        entries: [],
        source: 'none',
        saveCounter: null,
      }),
    ).toEqual({
      total: 0,
      entries: [],
    });
  });

  it.skipIf(!savePath)(
    'applies an early real save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = {
        hallOfFame: {
          total: 9,
          entries: [],
        },
      } as unknown as GameState;

      const converted =
        applyPlatinumHallOfFame(base, save);

      console.log(
        'converted Hall of Fame:',
        converted.hallOfFame,
      );

      expect(converted.hallOfFame).toEqual({
        total: 0,
        entries: [],
      });

      expect(base.hallOfFame.total).toBe(9);
    },
  );
});
