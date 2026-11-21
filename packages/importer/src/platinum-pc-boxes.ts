import {
  dexOf,
  type GameState,
  type Registries,
} from '@opensinnoh/contracts';
import {
  levelFromExp,
  recalc,
  type Dex,
  type Pokemon,
} from '@opensinnoh/core';
import {
  parsePlatinumBoxPokemon,
  readPlatinumPcBoxes,
  type PlatinumBoxPokemonData,
} from '@opensinnoh/nds';
import { convertPlatinumPartyPokemon } from './platinum-party.ts';
import { decodePlatinumName } from './platinum-save.ts';

const ZERO_STATS = {
  hp: 0,
  attack: 0,
  defense: 0,
  speed: 0,
  spAttack: 0,
  spDefense: 0,
};

export function convertPlatinumBoxPokemon(
  data: PlatinumBoxPokemonData,
  dex: Dex,
): Pokemon {
  const pokemon = convertPlatinumPartyPokemon({
    ...data,
    status: 0,
    level: 1,
    capsuleId: 0,
    hp: 0,
    stats: {
      ...ZERO_STATS,
    },
  });

  const speciesData = dex.form(
    pokemon.species,
    pokemon.form,
  );

  pokemon.level = levelFromExp(
    dex.expTable(speciesData.growthRate),
    pokemon.exp,
  );

  pokemon.status = 'none';
  pokemon.hp = 0;

  recalc(dex, pokemon);

  return pokemon;
}

export function applyPlatinumPcBoxes(
  state: GameState,
  save: Uint8Array,
  registries: Registries,
): GameState {
  const native = readPlatinumPcBoxes(save);
  const dex = dexOf(registries);

  const boxes = native.boxes.map((box) => ({
    name: decodePlatinumName(box.nameCodes),
    wallpaper: box.wallpaper,
    slots: box.slots.map((slot) =>
      slot === null
        ? null
        : convertPlatinumBoxPokemon(
            parsePlatinumBoxPokemon(slot),
            dex,
          ),
    ),
  }));

  return {
    ...state,
    boxes,
    currentBox: native.currentBox,
    wallpapersUnlocked:
      native.unlockedWallpapers,
  };
}