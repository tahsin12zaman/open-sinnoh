import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parsePlatinumBoxPokemon,
  writePlatinumBoxPokemonData,
  type PlatinumBoxPokemonData,
} from './platinum-box-pokemon-data.ts';
import { readPlatinumPcBoxes } from './platinum-pc-boxes.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum boxed Pokémon fields', () => {
  it.skipIf(!savePath)(
    'parses every occupied slot in a real save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const pc = readPlatinumPcBoxes(save);

      const pokemon = pc.boxes.flatMap(
        (box, boxIndex) =>
          box.slots.flatMap((slot, slotIndex) =>
            slot === null
              ? []
              : [
                  {
                    box: boxIndex,
                    slot: slotIndex,
                    data:
                      parsePlatinumBoxPokemon(
                        slot,
                      ),
                  },
                ],
          ),
      );

      expect(pokemon).toHaveLength(5);

      expect(
        pokemon.map((entry) => entry.data.species),
      ).toEqual([387, 393, 390, 399, 456]);

      for (const entry of pokemon) {
        expect(entry.data.exp).toBeGreaterThan(0);
        expect(entry.data.moves.length).toBeGreaterThan(
          0,
        );
      }

      console.log(
        'boxed pokemon:',
        pokemon.map(({ box, slot, data }) => ({
          box,
          slot,
          species: data.species,
          exp: data.exp,
          moves: data.moves,
          form: data.form,
          isEgg: data.isEgg,
        })),
      );
    },
  );
});

const BOX_DATA: PlatinumBoxPokemonData = {
  personality: 0x12345678,
  species: 25,
  heldItem: 1,
  otId: 0x87654321,
  exp: 125000,
  friendship: 200,
  ability: 9,
  markings: 0x15,
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
  moves: [85, 98, 231, 0x1a0],
  pp: [15, 30, 15, 5],
  ppUps: [0, 1, 2, 3],
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
  gender: 1,
  form: 0,
  nicknameCodes: [
    0x012b,
    0x0132,
    0x0134,
    0xffff,
    0xffff,
    0xffff,
    0xffff,
    0xffff,
    0xffff,
    0xffff,
    0xffff,
  ],
  otNameCodes: [
    0x012b,
    0x0136,
    0x012a,
    0x0132,
    0xffff,
    0xffff,
    0xffff,
    0xffff,
  ],
  originGame: 12,
  pokerus: 0x32,
  pokeball: 4,
  metLevel: 50,
  otGender: 0,
  eggLocation: 0,
  metLocation: 200,
  eggDate: {
    year: 0,
    month: 0,
    day: 0,
  },
  metDate: {
    year: 26,
    month: 11,
    day: 21,
  },
  ribbons: {
    gba: 0x10203040,
    ds1: 0x50607080,
    ds2: 0x0102030405060708n,
  },
};

describe('Platinum boxed Pokémon field writing', () => {
  it('round-trips semantic boxed Pokémon data', () => {
    const written =
      writePlatinumBoxPokemonData(
        BOX_DATA,
      );

    expect(
      parsePlatinumBoxPokemon(
        written,
      ),
    ).toEqual(BOX_DATA);
  });

  it('preserves unmodeled boxed bytes', () => {
    const base =
      writePlatinumBoxPokemonData(
        BOX_DATA,
      );

    base.blocks[2][0x16] = 0xa5;

    const written =
      writePlatinumBoxPokemonData(
        {
          ...BOX_DATA,
          friendship: 201,
        },
        base,
      );

    expect(
      written.blocks[2][0x16],
    ).toBe(0xa5);

    expect(
      parsePlatinumBoxPokemon(
        written,
      ).friendship,
    ).toBe(201);
  });
});
