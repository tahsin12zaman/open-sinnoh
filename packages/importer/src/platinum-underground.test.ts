import { readFileSync } from 'node:fs';
import type {
  GameState,
} from '@opensinnoh/contracts';
import type {
  PlatinumUnderground,
} from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumUnderground,
  convertPlatinumUnderground,
} from './platinum-underground.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function nativeUnderground(): PlatinumUnderground {
  return {
    seed: 0x12345678,
    respawn: true,
    mined: true,
    spheres: [
      {
        type: 4,
        size: 20,
      },
    ],
    treasures: [23],
    traps: [2],
    goods: [7],
    goodsPc: [6],
    buried: [
      {
        type: 3,
        size: 10,
        growth: 6,
        x: 302,
        z: 402,
      },
    ],
    spots: [
      {
        x: 120,
        z: 220,
      },
    ],
    spawnedTraps: [
      {
        trap: 7,
        x: 300,
        z: 400,
      },
      ...new Array(63).fill(null),
    ],
    plates: 0x1234,
    records: {
      spheresDug: 12,
      fossilsDug: 3,
      otherDug: 9,
      trapsTriggered: 4,
      baseMoves: 2,
    },
    steps: 49,
    placedTraps: [
      {
        trap: 8,
        x: 301,
        z: 401,
      },
    ],
    base: {
      entrance: {
        x: 200,
        z: 300,
        direction: 2,
      },
      goods: [
        {
          good: 10,
          x: 5,
          z: 6,
          slot: 3,
        },
        ...new Array(14).fill(null),
      ],
      boulders: [
        {
          x: 7,
          z: 8,
        },
        ...new Array(15).fill(null),
      ],
    },
  };
}

describe('Platinum Underground import', () => {
  it('converts the complete solo state', () => {
    const converted =
      convertPlatinumUnderground(
        nativeUnderground(),
      );

    expect(converted).toMatchObject({
      seed: 0x12345678,
      respawn: true,
      mined: true,
      spheres: [
        {
          type: 4,
          size: 20,
        },
      ],
      treasures: [23],
      traps: [2],
      goods: [7],
      goodsPc: [6],
      buried: [
        {
          type: 3,
          size: 10,
          growth: 6,
          x: 302,
          z: 402,
        },
      ],
      spots: [
        {
          x: 120,
          z: 220,
        },
      ],
      plates: 0x1234,
      records: {
        spheresDug: 12,
        fossilsDug: 3,
        otherDug: 9,
        trapsTriggered: 4,
        baseMoves: 2,
      },
      steps: 49,
      vendorTalks: [],
      placedTraps: [
        {
          trap: 8,
          x: 301,
          z: 401,
        },
      ],
      base: {
        entrance: {
          x: 200,
          z: 300,
          dir: 'left',
        },
      },
    });

    expect(
      converted.spawnedTraps[0],
    ).toEqual({
      trap: 7,
      x: 300,
      z: 400,
    });
  });

  it('maps every Secret Base direction', () => {
    const expected = [
      'up',
      'down',
      'left',
      'right',
    ] as const;

    expected.forEach((dir, direction) => {
      const native = nativeUnderground();

      native.base!.entrance.direction =
        direction;

      expect(
        convertPlatinumUnderground(native)
          .base?.entrance.dir,
      ).toBe(dir);
    });
  });

  it('rejects an unknown Secret Base direction', () => {
    const native = nativeUnderground();

    native.base!.entrance.direction = 4;

    expect(() =>
      convertPlatinumUnderground(native),
    ).toThrow(/direction 4/i);
  });

  it.skipIf(!savePath)(
    'applies a real Platinum Underground block',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = {
        underground: undefined,
      } as unknown as GameState;

      const converted =
        applyPlatinumUnderground(base, save);

      console.dir(
        {
          convertedUnderground:
            converted.underground,
        },
        { depth: null },
      );

      expect(
        converted.underground,
      ).toMatchObject({
        seed: 310381860,
        respawn: true,
        mined: false,
        spheres: [],
        treasures: [],
        traps: [],
        goods: [],
        goodsPc: [],
        buried: [],
        spots: [],
        plates: 0,
        records: {
          spheresDug: 0,
          fossilsDug: 0,
          otherDug: 0,
          trapsTriggered: 0,
          baseMoves: 0,
        },
        steps: 0,
        vendorTalks: [],
        placedTraps: [],
        base: null,
      });
    },
  );
});
