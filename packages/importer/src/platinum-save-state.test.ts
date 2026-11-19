import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import { describe, expect, it } from 'vitest';
import { importPlatinumSaveState } from './platinum-save-state.ts';

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
  } as GameState;
}

describe('Platinum combined save import', () => {
  it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
    'applies a real save to an OpenSinnoh state',
    () => {
      const bytes = new Uint8Array(
        readFileSync(process.env.OPENSINNOH_NDS_SAV!),
      );

      const base = makeBaseState();
      const imported = importPlatinumSaveState(
        base,
        bytes,
      );

      console.log('combined import:', {
        player: imported.names.player,
        gender: imported.gender,
        trainerId: imported.trainerId,
        money: imported.money,
        coins: imported.coins,
        playTime: imported.playTime,
        location: imported.player,
        party: imported.party.map((pokemon) => ({
          species: pokemon.species,
          level: pokemon.level,
          hp: `${pokemon.hp}/${pokemon.stats.hp}`,
        })),
      });

      expect(imported.names.player).not.toBe(
        base.names.player,
      );

      expect(imported.trainerId).not.toBe(
        base.trainerId,
      );

      expect(imported.player.zone).toMatch(
        /^platinum:MAP_HEADER_/,
      );

      expect(imported.player.x).toBeGreaterThanOrEqual(0);
      expect(imported.player.z).toBeGreaterThanOrEqual(0);
      expect(imported.party.length).toBeGreaterThan(0);
      expect(imported.party.length).toBeLessThanOrEqual(6);

      expect(base.names.player).toBe('Player');
      expect(base.party).toEqual([]);
    },
  );
});