import {
  dexOf,
  type GameState,
  type Registries,
} from '@opensinnoh/contracts';
import {
  parsePlatinumBoxPokemon,
  readPlatinumDaycare,
} from '@opensinnoh/nds';
import { convertPlatinumBoxPokemon } from './platinum-pc-boxes.ts';

export function applyPlatinumDaycare(
  state: GameState,
  save: Uint8Array,
  registries: Registries,
): GameState {
  const native = readPlatinumDaycare(save);
  const dex = dexOf(registries);

  return {
    ...state,
    daycare: {
      mons: native.mons.map((entry) =>
        entry === null
          ? null
          : {
              mon: convertPlatinumBoxPokemon(
                parsePlatinumBoxPokemon(
                  entry.pokemon,
                ),
                dex,
              ),
              steps: entry.steps,
            },
      ),
      offspring: native.offspring,
      stepCounter: native.stepCounter,
    },
  };
}