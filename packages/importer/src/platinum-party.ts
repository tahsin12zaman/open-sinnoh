import type { GameState } from '@opensinnoh/contracts';
import type {
  Pokemon,
  StatusCondition,
} from '@opensinnoh/core';
import {
  parsePlatinumPartyPokemon,
  readPlatinumParty,
  type PlatinumPartyPokemonData,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with { type: 'json' };
import {
  Names,
  type NamesFile,
} from './names.ts';
import { decodePlatinumName } from './platinum-save.ts';

const NAMES = new Names(namesFile as NamesFile);

function decodeOptionalName(
  codes: readonly number[],
  present: boolean,
): string | null {
  return present ? decodePlatinumName(codes) : null;
}

export function platinumStatus(
  status: number,
): StatusCondition {
  if (status & 0x80) return 'toxic';
  if (status & 0x07) return 'sleep';
  if (status & 0x08) return 'poison';
  if (status & 0x10) return 'burn';
  if (status & 0x20) return 'freeze';
  if (status & 0x40) return 'paralysis';

  return 'none';
}

function platinumDate(
  year: number,
  month: number,
  day: number,
): string | null {
  if (year === 0 && month === 0 && day === 0) {
    return null;
  }

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return [
    (2000 + year).toString().padStart(4, '0'),
    month.toString().padStart(2, '0'),
    day.toString().padStart(2, '0'),
  ].join('-');
}

/**
 * Converts Platinum's three stored ribbon bitfields to indexes in
 * generated/ribbons.txt, which is also the order used by
 * OpenSinnoh's NewGame.ribbons table.
 *
 * gba:
 *   Ribbon IDs 0–31.
 *
 * ds1 bit 0:
 *   Ribbon ID 32, the Sinnoh Champion Ribbon.
 *
 * ds2 bits 0–19:
 *   Ribbon IDs 33–52, the Sinnoh Contest Ribbons.
 *
 * ds1 bits 1–27:
 *   Ribbon IDs 53–79, the remaining Sinnoh and special Ribbons.
 *
 * Other bits are unused native padding.
 */
export function platinumRibbons(
  ribbons: PlatinumPartyPokemonData['ribbons'],
): number[] {
  const result: number[] = [];

  for (let bit = 0; bit < 32; bit++) {
    if (((ribbons.gba >>> bit) & 1) !== 0) {
      result.push(bit);
    }
  }

  if ((ribbons.ds1 & 1) !== 0) {
    result.push(32);
  }

  for (let bit = 0; bit < 20; bit++) {
    if (
      ((ribbons.ds2 >> BigInt(bit)) & 1n) !==
      0n
    ) {
      result.push(33 + bit);
    }
  }

  for (let bit = 1; bit <= 27; bit++) {
    if (((ribbons.ds1 >>> bit) & 1) !== 0) {
      result.push(52 + bit);
    }
  }

  return result.sort((a, b) => a - b);
}

export function convertPlatinumPartyPokemon(
  data: PlatinumPartyPokemonData,
): Pokemon {
  const moves = data.moves.map((move) =>
    NAMES.move(move),
  );

  return {
    species: NAMES.species(data.species),
    form: data.form,
    nickname: decodeOptionalName(
      data.nicknameCodes,
      data.hasNickname,
    ),
    isEgg: data.isEgg,
    pid: data.personality,
    otId: data.otId,
    otName: decodePlatinumName(data.otNameCodes),
    otGender: data.otGender === 0 ? 'male' : 'female',
    language: data.language,
    level: data.level,
    exp: data.exp,
    ivs: {
      ...data.ivs,
    },
    evs: {
      ...data.evs,
    },
    ability:
      data.ability === 0
        ? null
        : NAMES.ability(data.ability),
    moves,
    pp: [...data.pp],
    ppUps: [...data.ppUps],
    heldItem:
      data.heldItem === 0
        ? null
        : NAMES.item(data.heldItem),
    stats: {
      ...data.stats,
    },
    hp: data.hp,
    status: platinumStatus(data.status),
    friendship: data.friendship,
    pokerus: data.pokerus,
    ball: NAMES.item(data.pokeball),
    met: {
      zone: null,
      level: data.metLevel,
      date: platinumDate(
        data.metDate.year,
        data.metDate.month,
        data.metDate.day,
      ),
      ...(data.eggLocation !== 0
        ? {
            egg: {
              zone: null,
              date: platinumDate(
                data.eggDate.year,
                data.eggDate.month,
                data.eggDate.day,
              ),
            },
          }
        : {}),
    },
    markings: data.markings,
    ribbons: platinumRibbons(data.ribbons),

    ...(data.fatefulEncounter
      ? { fatefulEncounter: true as const }
      : {}),

    condition: {
      ...data.condition,
    },
  };
}

export function importPlatinumParty(
  save: Uint8Array,
): Pokemon[] {
  return readPlatinumParty(save).pokemon.map(
    (pokemon) =>
      convertPlatinumPartyPokemon(
        parsePlatinumPartyPokemon(pokemon),
      ),
  );
}

export function applyPlatinumParty(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    party: importPlatinumParty(save),
  };
}