import { readFileSync } from 'node:fs';
import type {
  GameState,
  Registries,
} from '@opensinnoh/contracts';
import type {
  Id,
  PackData,
} from '@opensinnoh/core';
import {
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { importPlatinum } from './platinum.ts';
import { importPlatinumSaveState } from './platinum-save-state.ts';

const romPath = process.env.OPENSINNOH_NDS_ROM;
const savePath = process.env.OPENSINNOH_NDS_SAV;

function registriesOf(
  pack: PackData,
): Registries {
  return Object.fromEntries(
    Object.entries(pack.registries).map(
      ([name, records]) => [
        name,
        new Map(
          (
            records as unknown as {
              id: Id;
            }[]
          ).map((record) => [
            record.id,
            record,
          ]),
        ),
      ],
    ),
  ) as unknown as Registries;
}

function makeBaseState(): GameState {
  return {
    names: {
      player: 'Player',
      rival: 'Rival',
    },
    gender: 'female',
    trainerId: 0,
    money: 0,
    coins: 0,
    playTime: {
      hours: 0,
      minutes: 0,
      seconds: 0,
    },
    player: {
      zone: 'platinum:MAP_HEADER_TWINLEAF_TOWN',
      x: 0,
      z: 0,
      y: 0,
      facing: 'up',
    },
    party: [],
    boxes: [],
    currentBox: 0,
    flags: {},
    vars: {},
  } as unknown as GameState;
}

describe.skipIf(!romPath || !savePath)(
  'Platinum save progress with ROM registries',
  () => {
    let registries: Registries;

    beforeAll(async () => {
      const rom = new Uint8Array(
        readFileSync(romPath!),
      );

      const { pack } = await importPlatinum(rom);
      registries = registriesOf(pack);
    });

    it('maps native progress to real OpenSinnoh IDs', () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const imported = importPlatinumSaveState(
        makeBaseState(),
        save,
        registries,
      );

      const flagEntries = Object.entries(
        imported.flags,
      );

      const varEntries = Object.entries(
        imported.vars,
      );

      console.log('mapped progress:', {
        flagOverrides: flagEntries.length,
        firstFlags: flagEntries.slice(0, 20),
        variableOverrides: varEntries.length,
        firstVariables: varEntries.slice(0, 20),
      });

      expect(
        flagEntries.length,
      ).toBeGreaterThan(0);

      expect(
        varEntries.length,
      ).toBeGreaterThan(0);

      for (const [id] of flagEntries) {
        expect(id).toMatch(/^platinum:/);
      }

      for (const [id, value] of varEntries) {
        expect(id).toMatch(/^platinum:/);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(0xffff);
      }

      expect(imported.boxes).toHaveLength(18);

      const boxedCount = imported.boxes.reduce(
        (total, box) =>
          total +
          box.slots.filter(
            (pokemon) => pokemon !== null,
          ).length,
        0,
      );

      expect(boxedCount).toBe(5);
    });
  },
);