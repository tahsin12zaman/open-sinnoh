import type {
  Id,
  Pokemon,
} from '@opensinnoh/core';
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  convertOpenSinnohPokemon,
  nativePlatinumRibbons,
  platinumMoveIndex,
  platinumSpeciesIndex,
} from './platinum-pokemon-export.ts';

const id = (value: string): Id =>
  value as Id;

function makePokemon(): Pokemon {
  return {
    species:
      id('platinum:SPECIES_TURTWIG'),
    form: 0,
    nickname: 'Twig',
    isEgg: false,
    pid: 0x12345678,
    otId: 0x87654321,
    otName: 'Test',
    otGender: 'female',
    language: 2,
    level: 15,
    exp: 3375,
    ivs: {
      hp: 31,
      attack: 30,
      defense: 29,
      speed: 28,
      spAttack: 27,
      spDefense: 26,
    },
    evs: {
      hp: 1,
      attack: 2,
      defense: 3,
      speed: 4,
      spAttack: 5,
      spDefense: 6,
    },
    ability:
      id('platinum:ABILITY_OVERGROW'),
    moves: [
      id('platinum:MOVE_TACKLE'),
    ],
    pp: [35],
    ppUps: [1],
    heldItem:
      id('platinum:ITEM_POTION'),
    stats: {
      hp: 45,
      attack: 25,
      defense: 24,
      speed: 20,
      spAttack: 22,
      spDefense: 23,
    },
    hp: 40,
    status: 'paralysis',
    friendship: 70,
    pokerus: 0x21,
    ball:
      id('platinum:ITEM_POKE_BALL'),
    met: {
      zone:
        id('platinum:MAP_HEADER_EVERYWHERE'),
      level: 5,
      date: '2025-08-20',
    },
    markings: 3,
    ribbons: [0, 31, 32, 33, 52, 53, 79],
    fatefulEncounter: true,
    condition: {
      cool: 10,
      beauty: 20,
      cute: 30,
      smart: 40,
      tough: 50,
      sheen: 60,
    },
  };
}

describe('Platinum Pokémon export', () => {
  it('converts modeled semantic Pokémon fields', () => {
    const pokemon = makePokemon();
    const converted =
      convertOpenSinnohPokemon(
        pokemon,
        127,
      );

    expect(converted).toMatchObject({
      personality: 0x12345678,
      species: platinumSpeciesIndex(
        pokemon.species,
      ),
      heldItem: 17,
      otId: 0x87654321,
      exp: 3375,
      friendship: 70,
      markings: 3,
      language: 2,
      moves: [
        platinumMoveIndex(
          id('platinum:MOVE_TACKLE'),
        ),
      ],
      pp: [35],
      ppUps: [1],
      isEgg: false,
      hasNickname: true,
      fatefulEncounter: true,
      form: 0,
      originGame: 12,
      pokerus: 0x21,
      pokeball: 4,
      metLevel: 5,
      otGender: 1,
      metLocation: 0,
      metDate: {
        year: 25,
        month: 8,
        day: 20,
      },
      status: 0x40,
      level: 15,
      hp: 40,
    });
  });

  it('encodes every native ribbon bitfield group', () => {
    expect(
      nativePlatinumRibbons([
        0,
        31,
        32,
        33,
        52,
        53,
        79,
      ]),
    ).toEqual({
      gba: 0x80000001,
      ds1: 0x08000003,
      ds2:
        (1n << 0n) |
        (1n << 19n),
    });
  });

  it('preserves native-only fields from an existing record', () => {
    const pokemon = makePokemon();
    pokemon.nickname = null;
    pokemon.met.zone = null;
    pokemon.met.date = null;

    const first =
      convertOpenSinnohPokemon(
        makePokemon(),
        127,
      );

    first.originGame = 10;
    first.metLocation = 321;
    first.nicknameCodes[0] = 123;

    const converted =
      convertOpenSinnohPokemon(
        pokemon,
        127,
        first,
      );

    expect(converted.originGame).toBe(10);
    expect(converted.metLocation).toBe(321);
    expect(converted.nicknameCodes[0]).toBe(
      123,
    );
    expect(converted.hasNickname).toBe(
      false,
    );
  });

  it('rejects invalid dates and mismatched move arrays', () => {
    const invalidDate = makePokemon();

    invalidDate.met.date = 'not-a-date';

    expect(() =>
      convertOpenSinnohPokemon(
        invalidDate,
        127,
      ),
    ).toThrow(/invalid Platinum date/i);

    const invalidMoves = makePokemon();
    invalidMoves.pp = [];

    expect(() =>
      convertOpenSinnohPokemon(
        invalidMoves,
        127,
      ),
    ).toThrow(/lengths do not match/i);
  });

  it('rejects IDs outside native Platinum tables', () => {
    const pokemon = makePokemon();

    pokemon.species =
      id('mod:SPECIES_UNKNOWN');

    expect(() =>
      convertOpenSinnohPokemon(
        pokemon,
        127,
      ),
    ).toThrow(/unknown Platinum species/i);
  });
});
