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
  'Platinum combined save import',
  () => {
    let registries: Registries;

    beforeAll(async () => {
      const rom = new Uint8Array(
        readFileSync(romPath!),
      );

      const { pack } = await importPlatinum(rom);
      registries = registriesOf(pack);
    });

    it('applies a real save to an OpenSinnoh state', () => {
      const bytes = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = makeBaseState();

      const imported = importPlatinumSaveState(
        base,
        bytes,
        registries,
      );

      const boxedCount = imported.boxes.reduce(
        (total, box) =>
          total +
          box.slots.filter(
            (pokemon) => pokemon !== null,
          ).length,
        0,
      );

      console.log('combined import:', {
        player: imported.names.player,
        rival: imported.names.rival,
        gender: imported.gender,
        trainerId: imported.trainerId,
        money: imported.money,
        coins: imported.coins,
        playTime: imported.playTime,
        location: imported.player,
        badges: imported.badges,
        party: imported.party.map((pokemon) => ({
          species: pokemon.species,
          level: pokemon.level,
          hp: `${pokemon.hp}/${pokemon.stats.hp}`,
        })),
        boxes: {
          count: imported.boxes.length,
          current: imported.currentBox,
          occupied: boxedCount,
        },
        pokedex: {
          obtained: imported.pokedex.obtained,
          national: imported.pokedex.national,
          seen: imported.pokedex.seen.length,
          caught: imported.pokedex.caught.length,
        },
        poketch: {
          enabled: imported.poketch.enabled,
          apps: imported.poketch.apps,
          current: imported.poketch.current,
          steps: imported.poketch.steps,
        },
      });

      expect(imported.names.player).toBe('Tahsin');
      expect(imported.names.rival).toBe('Barry');
      expect(imported.player.zone).toMatch(
        /^platinum:MAP_HEADER_/,
      );

      expect(imported.party.length).toBeGreaterThan(0);
      expect(imported.party.length).toBeLessThanOrEqual(6);

      expect(imported.boxes).toHaveLength(18);
      expect(boxedCount).toBe(5);
      expect(imported.currentBox).toBe(0);

      expect(imported.pokedex.obtained).toBe(true);
      expect(imported.poketch.enabled).toBe(true);

      expect(base.names.player).toBe('Player');
      expect(base.party).toEqual([]);
      expect(base.boxes).toEqual([]);
    });
  },
);