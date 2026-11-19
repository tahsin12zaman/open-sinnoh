import type { GameState } from '@opensinnoh/contracts';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumLocation,
  applyPlatinumTrainer,
  convertPlatinumTrainerData,
  decodePlatinumName,
  type ImportedPlatinumTrainer,
} from './platinum-save.ts';

const TEST_NAME_CODES = [
  318, // T
  329, // e
  343, // s
  344, // t
  0xffff,
  0,
  0,
  0,
];

const TEST_TRAINER: ImportedPlatinumTrainer = {
  name: 'Test',
  trainerId: 12345,
  secretId: 54321,
  money: 123456,
  gender: 1,
  badges: 3,
  coins: 250,
  playTime: {
    hours: 10,
    minutes: 20,
    seconds: 30,
  },
};

function makeBaseState(): GameState {
  return {
    names: {
      player: 'Player',
      rival: 'Rival',
    },
    gender: 'male',
    trainerId: 1,
    money: 3000,
    coins: 0,
    playTime: {
      hours: 0,
      minutes: 0,
      seconds: 0,
    },
    player: {
      zone: 'platinum:MAP_HEADER_TWINLEAF_TOWN',
      x: 5,
      z: 6,
      y: 7,
      facing: 'up',
    },
  } as GameState;
}

describe('Platinum save import', () => {
  it('decodes a native trainer name', () => {
    expect(decodePlatinumName(TEST_NAME_CODES)).toBe('Test');
  });

  it('converts raw trainer data', () => {
    expect(
      convertPlatinumTrainerData({
        nameCodes: TEST_NAME_CODES,
        trainerId: 12345,
        secretId: 54321,
        money: 123456,
        gender: 1,
        badges: 3,
        coins: 250,
        playTime: {
          hours: 10,
          minutes: 20,
          seconds: 30,
        },
      }),
    ).toEqual(TEST_TRAINER);
  });

  it('applies trainer data to an OpenSinnoh state', () => {
    const base = makeBaseState();
    const converted = applyPlatinumTrainer(
      base,
      TEST_TRAINER,
    );

    expect(converted).toMatchObject({
      names: {
        player: 'Test',
        rival: 'Rival',
      },
      gender: 'female',
      trainerId: ((54321 << 16) | 12345) >>> 0,
      money: 123456,
      coins: 250,
      playTime: {
        hours: 10,
        minutes: 20,
        seconds: 30,
      },
    });

    expect(base.names.player).toBe('Player');
    expect(base.money).toBe(3000);
  });

  it('rejects an unknown native gender value', () => {
    expect(() =>
      applyPlatinumTrainer(makeBaseState(), {
        ...TEST_TRAINER,
        gender: 2,
      }),
    ).toThrow(/gender 2/i);
  });

  it.each([
    [0, 'up'],
    [1, 'down'],
    [2, 'left'],
    [3, 'right'],
  ] as const)(
    'maps native facing %i to %s',
    (faceDirection, facing) => {
      const converted = applyPlatinumLocation(
        makeBaseState(),
        {
          mapHeaderId: 0,
          warpId: -1,
          x: 17,
          z: 29,
          faceDirection,
        },
      );

      expect(converted.player).toEqual({
        zone: 'platinum:MAP_HEADER_EVERYWHERE',
        x: 17,
        z: 29,
        y: 7,
        facing,
      });
    },
  );

  it('rejects an unknown map header', () => {
    expect(() =>
      applyPlatinumLocation(makeBaseState(), {
        mapHeaderId: 999999,
        warpId: -1,
        x: 17,
        z: 29,
        faceDirection: 0,
      }),
    ).toThrow(/map header 999999/i);
  });
});