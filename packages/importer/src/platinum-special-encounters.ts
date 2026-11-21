import type { GameState } from '@opensinnoh/contracts';
import {
  readPlatinumSpecialEncounters,
  type PlatinumSpecialEncounters,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with { type: 'json' };
import {
  Names,
  type NamesFile,
} from './names.ts';

const NAMES = new Names(namesFile as NamesFile);

type EncounterState = NonNullable<
  GameState['encounters']
>;

export function convertPlatinumSpecialEncounters(
  native: PlatinumSpecialEncounters,
): EncounterState {
  return {
    honeyTrees: native.honeyTrees.map(
      (tree) => ({
        minutes: tree.minutes,
        slot: tree.slot,
        table: tree.table,
        group: tree.group,
        shakes: tree.shakes,
      }),
    ),
    lastHoneyTree: native.lastHoneyTree,
    radarCharge: native.radarCharge,
    radarRecords: native.radarRecords.map(
      (record) => ({
        species:
          record.species === 0
            ? null
            : NAMES.species(record.species),
        count: record.count,
      }),
    ),
    swarms: native.swarms,
    trophyGarden: [
      native.trophyGarden[0],
      native.trophyGarden[1],
    ],
  };
}

export function applyPlatinumSpecialEncounters(
  state: GameState,
  save: Uint8Array,
): GameState {
  const native =
    readPlatinumSpecialEncounters(save);

  return {
    ...state,
    gameTime: {
      ...state.gameTime,
      marshDaily: native.marshDaily,
      swarmDaily: native.swarmDaily,
    },
    encounters:
      convertPlatinumSpecialEncounters(native),
    repel: native.repelSteps,
  };
}
