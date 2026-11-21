import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import type {
  PlatinumRoamer,
  PlatinumRoamerState,
} from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumRoamers,
  convertPlatinumRoamers,
} from './platinum-roamers.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function inactiveRoamer(): PlatinumRoamer {
  return {
    currentMapId: 0,
    ivs: 0,
    personality: 0,
    species: 0,
    currentHp: 0,
    level: 0,
    status: 0,
    active: false,
  };
}

function syntheticState(): PlatinumRoamerState {
  return {
    currentMapId: 200,
    previousMapId: 428,
    roamers: [
      {
        currentMapId: 200,
        ivs: 0x2d6b59f1,
        personality: 0x12345678,
        species: 481,
        currentHp: 73,
        level: 50,
        status: 0x40,
        active: true,
      },
      inactiveRoamer(),
      inactiveRoamer(),
      inactiveRoamer(),
      inactiveRoamer(),
      inactiveRoamer(),
    ],
    routeIndexes: [27, 0, 0, 0, 0, 0],
  };
}

describe('Platinum roamer import', () => {
  it('converts active and inactive roamers', () => {
    const converted = convertPlatinumRoamers(
      syntheticState(),
    );

    expect(converted).toEqual({
      slots: [
        {
          species: 'platinum:SPECIES_MESPRIT',
          level: 50,
          pid: 0x12345678,
          ivs: {
            hp: 17,
            attack: 15,
            defense: 22,
            speed: 22,
            spAttack: 22,
            spDefense: 22,
          },
          hp: 73,
          status: 'paralysis',
        },
        null,
        null,
        null,
        null,
        null,
      ],
      routes: [27, 0, 0, 0, 0, 0],
      current:
        'platinum:MAP_HEADER_VALLEY_WINDWORKS_OUTSIDE',
      previous:
        'platinum:MAP_HEADER_FLOAROMA_TOWN_POKECENTER_1F',
    });
  });

  it('maps zero recent routes to null', () => {
    const native = syntheticState();
    native.currentMapId = 0;
    native.previousMapId = 0;

    const converted = convertPlatinumRoamers(native);

    expect(converted.current).toBeNull();
    expect(converted.previous).toBeNull();
  });

  it.skipIf(!savePath)(
    'applies roamers from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = {
        roamers: {
          slots: [],
          routes: [],
          current:
            'platinum:MAP_HEADER_ROUTE_201',
          previous:
            'platinum:MAP_HEADER_ROUTE_202',
        },
      } as unknown as GameState;

      const converted = applyPlatinumRoamers(
        base,
        save,
      );

      console.log(
        'converted roamers:',
        converted.roamers,
      );

      expect(converted.roamers).toEqual({
        slots: [
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        routes: [0, 0, 0, 0, 0, 0],
        current: null,
        previous: null,
      });

      expect(base.roamers.slots).toEqual([]);
    },
  );
});
