import { readFileSync } from 'node:fs';
import type { PlatinumPartyPokemonData } from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  convertPlatinumPartyPokemon,
  importPlatinumParty,
  platinumRibbons,
  platinumStatus,
} from './platinum-party.ts';

const TEST_NAME_CODES = [
  318, // T
  329, // e
  343, // s
  344, // t
  0xffff,
  0,
  0,
  0,
  0,
  0,
  0,
];

const TEST_OT_CODES = [
  318, // T
  329, // e
  343, // s
  344, // t
  0xffff,
  0,
  0,
  0,
];

function makePokemonData(): PlatinumPartyPokemonData {
  return {
    personality: 0x12345678,
    species: 387,
    heldItem: 1,
    otId: 0x87654321,
    exp: 12345,
    friendship: 70,
    ability: 65,
    markings: 3,
    language: 2,

    evs: {
      hp: 1,
      attack: 2,
      defense: 3,
      speed: 4,
      spAttack: 5,
      spDefense: 6,
    },

    condition: {
      cool: 10,
      beauty: 20,
      cute: 30,
      smart: 40,
      tough: 50,
      sheen: 60,
    },

    moves: [33, 45],
    pp: [30, 20],
    ppUps: [1, 2],

    ivs: {
      hp: 31,
      attack: 30,
      defense: 29,
      speed: 28,
      spAttack: 27,
      spDefense: 26,
    },

    isEgg: false,
    hasNickname: true,
    fatefulEncounter: true,
    gender: 0,
    form: 0,
    nicknameCodes: TEST_NAME_CODES,
    otNameCodes: TEST_OT_CODES,
    originGame: 10,
    pokerus: 0x32,
    pokeball: 4,
    metLevel: 5,
    otGender: 1,
    eggLocation: 0,
    metLocation: 1,

    eggDate: {
      year: 0,
      month: 0,
      day: 0,
    },

    metDate: {
      year: 26,
      month: 11,
      day: 19,
    },

    status: 0x10,
    level: 14,
    capsuleId: 0,
    hp: 35,

    stats: {
      hp: 40,
      attack: 21,
      defense: 22,
      speed: 23,
      spAttack: 24,
      spDefense: 25,
    },

    ribbons: {
      gba: 0,
      ds1: 0,
      ds2: 0n,
    },
  };
}

describe('Platinum party import', () => {
  it.each([
    [0x00, 'none'],
    [0x01, 'sleep'],
    [0x08, 'poison'],
    [0x10, 'burn'],
    [0x20, 'freeze'],
    [0x40, 'paralysis'],
    [0x80, 'toxic'],
  ] as const)(
    'converts native status 0x%s to %s',
    (native, expected) => {
      expect(platinumStatus(native)).toBe(expected);
    },
  );

  it('maps all three native ribbon bitfields', () => {
    expect(
      platinumRibbons({
        // GBA ribbon IDs 0 and 31.
        gba: 0x80000001,

        // Bit 0: ribbon 32.
        // Bit 1: ribbon 53.
        // Bit 27: ribbon 79.
        // Bit 28: unused and must be ignored.
        ds1: 0x18000003,

        // Bits 0 and 19: ribbons 33 and 52.
        // Bit 20: unused and must be ignored.
        ds2:
          (1n << 0n) |
          (1n << 19n) |
          (1n << 20n),
      }),
    ).toEqual([
      0,
      31,
      32,
      33,
      52,
      53,
      79,
    ]);
  });

  it('returns no ribbons for empty bitfields', () => {
    expect(
      platinumRibbons({
        gba: 0,
        ds1: 0,
        ds2: 0n,
      }),
    ).toEqual([]);
  });

  it('converts native Pokémon fields to OpenSinnoh IDs', () => {
    const converted = convertPlatinumPartyPokemon(
      makePokemonData(),
    );

    expect(converted).toMatchObject({
      species: 'platinum:SPECIES_TURTWIG',
      form: 0,
      nickname: 'Test',
      isEgg: false,
      pid: 0x12345678,
      otId: 0x87654321,
      otName: 'Test',
      otGender: 'female',
      language: 2,
      level: 14,
      exp: 12345,
      ability: 'platinum:ABILITY_OVERGROW',
      moves: [
        'platinum:MOVE_TACKLE',
        'platinum:MOVE_GROWL',
      ],
      pp: [30, 20],
      ppUps: [1, 2],
      heldItem: 'platinum:ITEM_MASTER_BALL',
      hp: 35,
      status: 'burn',
      friendship: 70,
      pokerus: 0x32,
      ball: 'platinum:ITEM_POKE_BALL',
      markings: 3,
      ribbons: [],
      fatefulEncounter: true,
      met: {
        zone: null,
        level: 5,
        date: '2026-11-19',
      },
    });

    expect(converted.ivs).toEqual({
      hp: 31,
      attack: 30,
      defense: 29,
      speed: 28,
      spAttack: 27,
      spDefense: 26,
    });

    expect(converted.stats).toEqual({
      hp: 40,
      attack: 21,
      defense: 22,
      speed: 23,
      spAttack: 24,
      spDefense: 25,
    });
  });

  it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
    'converts every member of a real Platinum party',
    () => {
      const bytes = new Uint8Array(
        readFileSync(process.env.OPENSINNOH_NDS_SAV!),
      );

      const party = importPlatinumParty(bytes);

      console.log(
        'converted party:',
        party.map((pokemon) => ({
          species: pokemon.species,
          level: pokemon.level,
          moves: pokemon.moves,
          ability: pokemon.ability,
          ribbons: pokemon.ribbons,
          hp: `${pokemon.hp}/${pokemon.stats.hp}`,
        })),
      );

      expect(party).toHaveLength(5);

      for (const pokemon of party) {
        expect(pokemon.species).toMatch(
          /^platinum:SPECIES_/,
        );
        expect(pokemon.moves.length).toBeLessThanOrEqual(4);
        expect(pokemon.hp).toBeLessThanOrEqual(
          pokemon.stats.hp,
        );

        for (const ribbon of pokemon.ribbons) {
          expect(ribbon).toBeGreaterThanOrEqual(0);
          expect(ribbon).toBeLessThan(80);
        }
      }
    },
  );
});