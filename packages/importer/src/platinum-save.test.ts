import { describe, expect, it } from 'vitest';
import {
  convertPlatinumTrainerData,
  decodePlatinumName,
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
    ).toEqual({
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
    });
  });
});