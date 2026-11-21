import type { Id } from '@opensinnoh/core';
import {
  genderOf,
  type Pokemon,
  type StatusCondition,
} from '@opensinnoh/core';
import type {
  PlatinumBoxPokemonData,
  PlatinumPartyPokemonData,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with {
  type: 'json',
};
import {
  Names,
  type NamesFile,
} from './names.ts';
import {
  encodePlatinumName,
} from './platinum-save.ts';

const NAMES = new Names(
  namesFile as NamesFile,
);

function nativeIndex(
  id: Id,
  values: readonly (string | null)[],
  convert: (index: number) => Id,
  kind: string,
): number {
  for (
    let index = 0;
    index < values.length;
    index++
  ) {
    if (convert(index) === id) {
      return index;
    }
  }

  throw new Error(
    `Cannot export unknown Platinum ${kind} ${id}`,
  );
}

export function platinumSpeciesIndex(
  species: Id,
): number {
  return nativeIndex(
    species,
    NAMES.file.species,
    (index) => NAMES.species(index),
    'species',
  );
}

export function platinumMoveIndex(
  move: Id,
): number {
  return nativeIndex(
    move,
    NAMES.file.moves,
    (index) => NAMES.move(index),
    'move',
  );
}

export function platinumAbilityIndex(
  ability: Id,
): number {
  return nativeIndex(
    ability,
    NAMES.file.abilities,
    (index) => NAMES.ability(index),
    'ability',
  );
}

export function platinumPokemonItemIndex(
  item: Id,
): number {
  return nativeIndex(
    item,
    NAMES.file.items,
    (index) => NAMES.item(index),
    'item',
  );
}

function nativeStatus(
  status: StatusCondition,
  baseStatus: number,
): number {
  switch (status) {
    case 'none':
      return 0;
    case 'sleep':
      return baseStatus & 0x07
        ? baseStatus & 0x07
        : 1;
    case 'poison':
      return 0x08;
    case 'burn':
      return 0x10;
    case 'freeze':
      return 0x20;
    case 'paralysis':
      return 0x40;
    case 'toxic':
      return 0x80;
  }
}

function nativeGender(
  genderRatio: number,
  personality: number,
): number {
  const gender = genderOf(
    genderRatio,
    personality,
  );

  if (gender === 'male') {
    return 0;
  }

  if (gender === 'female') {
    return 1;
  }

  return 2;
}

function nativeDate(
  value: string | null,
): {
  year: number;
  month: number;
  day: number;
} {
  if (value === null) {
    return {
      year: 0,
      month: 0,
      day: 0,
    };
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (match === null) {
    throw new Error(
      `Cannot export invalid Platinum date ${value}`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    year < 2000 ||
    year > 2255 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(
      `Cannot export invalid Platinum date ${value}`,
    );
  }

  return {
    year: year - 2000,
    month,
    day,
  };
}

function zoneLocation(
  zone: Id | null,
  fallback: number,
): number {
  if (zone === null) {
    return fallback;
  }

  for (
    let index = 0;
    index < NAMES.file.zones.length;
    index++
  ) {
    if (NAMES.zone(index) === zone) {
      return index;
    }
  }

  throw new Error(
    `Cannot export unknown Platinum met location ${zone}`,
  );
}

export function nativePlatinumRibbons(
  ribbons: readonly number[],
): PlatinumPartyPokemonData['ribbons'] {
  let gba = 0;
  let ds1 = 0;
  let ds2 = 0n;

  for (const ribbon of new Set(ribbons)) {
    if (
      !Number.isInteger(ribbon) ||
      ribbon < 0 ||
      ribbon > 79
    ) {
      throw new Error(
        `Cannot export Platinum ribbon ${ribbon}`,
      );
    }

    if (ribbon <= 31) {
      gba = (
        gba |
        (1 << ribbon)
      ) >>> 0;
    } else if (ribbon === 32) {
      ds1 = (ds1 | 1) >>> 0;
    } else if (ribbon <= 52) {
      ds2 |=
        1n << BigInt(ribbon - 33);
    } else {
      ds1 = (
        ds1 |
        (1 << (ribbon - 52))
      ) >>> 0;
    }
  }

  return {
    gba,
    ds1,
    ds2,
  };
}

function emptyBase(
  pokemon: Pokemon,
): PlatinumPartyPokemonData {
  return {
    personality: pokemon.pid,
    species: 1,
    heldItem: 0,
    otId: pokemon.otId,
    exp: pokemon.exp,
    friendship: pokemon.friendship,
    ability: 0,
    markings: pokemon.markings,
    language: pokemon.language ?? 2,
    evs: { ...pokemon.evs },
    condition: { ...pokemon.condition },
    moves: [],
    pp: [],
    ppUps: [],
    ivs: { ...pokemon.ivs },
    isEgg: pokemon.isEgg,
    hasNickname: false,
    fatefulEncounter: false,
    gender: 2,
    form: pokemon.form,
    nicknameCodes:
      encodePlatinumName('', 11),
    otNameCodes:
      encodePlatinumName(
        pokemon.otName,
        8,
      ),
    originGame: 12,
    pokerus: pokemon.pokerus,
    pokeball: 4,
    metLevel: pokemon.met.level,
    otGender:
      pokemon.otGender === 'male'
        ? 0
        : 1,
    eggLocation: 0,
    metLocation: 0,
    eggDate: {
      year: 0,
      month: 0,
      day: 0,
    },
    metDate: {
      year: 0,
      month: 0,
      day: 0,
    },
    status: 0,
    level: pokemon.level,
    capsuleId: 0,
    hp: pokemon.hp,
    stats: { ...pokemon.stats },
    ribbons: {
      gba: 0,
      ds1: 0,
      ds2: 0n,
    },
  };
}

export function convertOpenSinnohPokemon(
  pokemon: Pokemon,
  genderRatio: number,
  existing?:
    | PlatinumPartyPokemonData
    | PlatinumBoxPokemonData,
): PlatinumPartyPokemonData {
  const defaults = emptyBase(pokemon);

  const base: PlatinumPartyPokemonData =
    existing === undefined
      ? defaults
      : {
          ...defaults,
          ...existing,
        };

  const moves = pokemon.moves.map(
    platinumMoveIndex,
  );

  if (
    pokemon.pp.length !== moves.length ||
    pokemon.ppUps.length !== moves.length
  ) {
    throw new Error(
      'OpenSinnoh Pokémon moves, PP and PP Ups lengths do not match',
    );
  }

  return {
    ...base,
    personality: pokemon.pid,
    species: platinumSpeciesIndex(
      pokemon.species,
    ),
    heldItem:
      pokemon.heldItem === null
        ? 0
        : platinumPokemonItemIndex(
            pokemon.heldItem,
          ),
    otId: pokemon.otId,
    exp: pokemon.exp,
    friendship: pokemon.friendship,
    ability:
      pokemon.ability === null
        ? 0
        : platinumAbilityIndex(
            pokemon.ability,
          ),
    markings: pokemon.markings,
    language: pokemon.language ?? 2,
    evs: { ...pokemon.evs },
    condition: { ...pokemon.condition },
    moves,
    pp: [...pokemon.pp],
    ppUps: [...pokemon.ppUps],
    ivs: { ...pokemon.ivs },
    isEgg: pokemon.isEgg,
    hasNickname:
      pokemon.nickname !== null,
    fatefulEncounter:
      pokemon.fatefulEncounter === true,
    gender: nativeGender(
      genderRatio,
      pokemon.pid,
    ),
    form: pokemon.form,
    nicknameCodes:
      pokemon.nickname === null
        ? base.nicknameCodes
        : encodePlatinumName(
            pokemon.nickname,
            11,
          ),
    otNameCodes: encodePlatinumName(
      pokemon.otName,
      8,
    ),
    pokerus: pokemon.pokerus,
    pokeball: platinumPokemonItemIndex(
      pokemon.ball,
    ),
    metLevel: pokemon.met.level,
    otGender:
      pokemon.otGender === 'male'
        ? 0
        : 1,
    eggLocation:
      pokemon.met.egg === undefined
        ? 0
        : zoneLocation(
            pokemon.met.egg.zone,
            base.eggLocation,
          ),
    metLocation: zoneLocation(
      pokemon.met.zone,
      base.metLocation,
    ),
    eggDate: nativeDate(
      pokemon.met.egg?.date ?? null,
    ),
    metDate: nativeDate(
      pokemon.met.date,
    ),
    status: nativeStatus(
      pokemon.status,
      base.status,
    ),
    level: pokemon.level,
    capsuleId:
      pokemon.capsule?.id ?? 0,
    hp: pokemon.hp,
    stats: { ...pokemon.stats },
    ribbons: nativePlatinumRibbons(
      pokemon.ribbons,
    ),
  };
}
