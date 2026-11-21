import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parsePlatinumPartyPokemon,
  writePlatinumPartyPokemonData,
} from './platinum-pokemon-data.ts';
import {
  readPlatinumParty,
  type DecodedPlatinumPartyPokemon,
} from './platinum-pokemon.ts';

function makeDecodedPokemon(): DecodedPlatinumPartyPokemon {
  const blocks = [
    new Uint8Array(0x20),
    new Uint8Array(0x20),
    new Uint8Array(0x20),
    new Uint8Array(0x20),
  ] as [
    Uint8Array,
    Uint8Array,
    Uint8Array,
    Uint8Array,
  ];

  const partyData = new Uint8Array(0x64);

  const blockA = new DataView(blocks[0].buffer);
  const blockB = new DataView(blocks[1].buffer);
  const blockC = new DataView(blocks[2].buffer);
  const blockD = new DataView(blocks[3].buffer);
  const party = new DataView(partyData.buffer);

  blockA.setUint16(0, 387, true);
  blockA.setUint16(2, 1, true);
  blockA.setUint32(4, 0x12345678, true);
  blockA.setUint32(8, 12345, true);
  blockA.setUint8(0x0c, 70);
  blockA.setUint8(0x0d, 65);
  blockA.setUint8(0x0e, 3);
  blockA.setUint8(0x0f, 2);

  [1, 2, 3, 4, 5, 6].forEach((value, index) => {
    blockA.setUint8(0x10 + index, value);
  });

  [10, 20, 30, 40, 50, 60].forEach(
    (value, index) => {
      blockA.setUint8(0x16 + index, value);
    },
  );

  blockA.setUint32(0x1c, 0x10203040, true);

  blockB.setUint16(0, 33, true);
  blockB.setUint16(2, 45, true);
  blockB.setUint16(4, 0, true);
  blockB.setUint16(6, 0, true);
  blockB.setUint8(8, 30);
  blockB.setUint8(9, 20);
  blockB.setUint8(0x0c, 1);
  blockB.setUint8(0x0d, 2);

  const ivWord =
    31 |
    (30 << 5) |
    (29 << 10) |
    (28 << 15) |
    (27 << 20) |
    (26 << 25) |
    (1 << 31);

  blockB.setUint32(0x10, ivWord >>> 0, true);
  blockB.setUint32(0x14, 0x11223344, true);
  blockB.setUint8(0x18, 1 | (2 << 1) | (3 << 3));
  blockB.setUint16(0x1c, 100, true);
  blockB.setUint16(0x1e, 200, true);

  [
    318,
    329,
    343,
    344,
    0xffff,
    0,
    0,
    0,
    0,
    0,
    0,
  ].forEach((code, index) => {
    blockC.setUint16(index * 2, code, true);
  });

  blockC.setUint8(0x17, 10);
  blockC.setBigUint64(
    0x18,
    0x0102030405060708n,
    true,
  );

  [
    318,
    325,
    332,
    343,
    333,
    338,
    0xffff,
    0,
  ].forEach((code, index) => {
    blockD.setUint16(index * 2, code, true);
  });

  blockD.setUint8(0x10, 22);
  blockD.setUint8(0x11, 1);
  blockD.setUint8(0x12, 2);
  blockD.setUint8(0x13, 23);
  blockD.setUint8(0x14, 3);
  blockD.setUint8(0x15, 4);
  blockD.setUint8(0x1a, 0x32);
  blockD.setUint8(0x1b, 4);
  blockD.setUint8(0x1c, 14 | 0x80);

  party.setUint32(0, 0x10, true);
  party.setUint8(4, 14);
  party.setUint8(5, 2);
  party.setUint16(6, 35, true);
  party.setUint16(8, 40, true);
  party.setUint16(0x0a, 21, true);
  party.setUint16(0x0c, 22, true);
  party.setUint16(0x0e, 23, true);
  party.setUint16(0x10, 24, true);
  party.setUint16(0x12, 25, true);

  return {
    personality: 0xabcdef01,
    checksum: 0,
    blocks,
    partyData,
  };
}

describe('Platinum Pokémon fields', () => {
  it('parses decrypted boxed and party fields', () => {
    const pokemon = parsePlatinumPartyPokemon(
      makeDecodedPokemon(),
    );

    expect(pokemon).toMatchObject({
      personality: 0xabcdef01,
      species: 387,
      heldItem: 1,
      otId: 0x12345678,
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
      gender: 2,
      form: 3,
      originGame: 10,
      pokerus: 0x32,
      pokeball: 4,
      metLevel: 14,
      otGender: 1,
      eggLocation: 100,
      metLocation: 200,
      status: 0x10,
      level: 14,
      capsuleId: 2,
      hp: 35,
      stats: {
        hp: 40,
        attack: 21,
        defense: 22,
        speed: 23,
        spAttack: 24,
        spDefense: 25,
      },
    });

    expect(pokemon.ribbons).toEqual({
      ds1: 0x10203040,
      gba: 0x11223344,
      ds2: 0x0102030405060708n,
    });
  });

  it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
    'parses every Pokémon in a real party',
    () => {
      const bytes = new Uint8Array(
        readFileSync(process.env.OPENSINNOH_NDS_SAV!),
      );

      const parsed = readPlatinumParty(bytes).pokemon.map(
        parsePlatinumPartyPokemon,
      );

      console.log(
        'parsed party:',
        parsed.map((pokemon) => ({
          species: pokemon.species,
          level: pokemon.level,
          moves: pokemon.moves,
          hp: `${pokemon.hp}/${pokemon.stats.hp}`,
          ability: pokemon.ability,
          form: pokemon.form,
        })),
      );

      expect(parsed.length).toBeGreaterThan(0);

      for (const pokemon of parsed) {
        expect(pokemon.species).toBeGreaterThan(0);
        expect(pokemon.species).toBeLessThan(494);
        expect(pokemon.level).toBeGreaterThan(0);
        expect(pokemon.level).toBeLessThanOrEqual(100);
        expect(pokemon.moves.length).toBeLessThanOrEqual(4);
        expect(pokemon.hp).toBeLessThanOrEqual(
          pokemon.stats.hp,
        );
      }
    },
  );
});

describe('Platinum Pokémon field writing', () => {
  it('round-trips every semantic Pokémon field', () => {
    const base = makeDecodedPokemon();
    const parsed =
      parsePlatinumPartyPokemon(base);

    const written =
      writePlatinumPartyPokemonData(
        parsed,
        base,
      );

    expect(
      parsePlatinumPartyPokemon(
        written,
      ),
    ).toEqual(parsed);

    expect(
      written.personality,
    ).toBe(parsed.personality);
  });

  it('preserves unmodeled decrypted bytes', () => {
    const base = makeDecodedPokemon();

    base.blocks[2][0x16] = 0xa5;
    base.blocks[3][0x1d] = 0x6b;
    base.partyData[0x20] = 0x5a;

    const parsed =
      parsePlatinumPartyPokemon(base);

    const written =
      writePlatinumPartyPokemonData(
        parsed,
        base,
      );

    expect(
      written.blocks[2][0x16],
    ).toBe(0xa5);
    expect(
      written.blocks[3][0x1d],
    ).toBe(0x6b);
    expect(
      written.partyData[0x20],
    ).toBe(0x5a);
  });

  it('creates valid blocks without a base record', () => {
    const parsed =
      parsePlatinumPartyPokemon(
        makeDecodedPokemon(),
      );

    const written =
      writePlatinumPartyPokemonData(
        parsed,
      );

    expect(
      parsePlatinumPartyPokemon(
        written,
      ),
    ).toEqual(parsed);

    expect(written.sanity).toBe(0);
  });

  it('preserves legacy location storage', () => {
    const base = makeDecodedPokemon();

    const blockB = new DataView(
      base.blocks[1].buffer,
      base.blocks[1].byteOffset,
      base.blocks[1].byteLength,
    );

    const blockD = new DataView(
      base.blocks[3].buffer,
      base.blocks[3].byteOffset,
      base.blocks[3].byteLength,
    );

    blockB.setUint16(
      0x1c,
      0,
      true,
    );
    blockD.setUint16(
      0x16,
      300,
      true,
    );

    const parsed =
      parsePlatinumPartyPokemon(base);

    const written =
      writePlatinumPartyPokemonData(
        {
          ...parsed,
          eggLocation: 301,
        },
        base,
      );

    const writtenB = new DataView(
      written.blocks[1].buffer,
      written.blocks[1].byteOffset,
      written.blocks[1].byteLength,
    );

    const writtenD = new DataView(
      written.blocks[3].buffer,
      written.blocks[3].byteOffset,
      written.blocks[3].byteLength,
    );

    expect(
      writtenB.getUint16(
        0x1c,
        true,
      ),
    ).toBe(0);

    expect(
      writtenD.getUint16(
        0x16,
        true,
      ),
    ).toBe(301);
  });

  it('rejects invalid semantic Pokémon data', () => {
    const parsed =
      parsePlatinumPartyPokemon(
        makeDecodedPokemon(),
      );

    expect(() =>
      writePlatinumPartyPokemonData({
        ...parsed,
        species: 494,
      }),
    ).toThrow(/species/i);

    expect(() =>
      writePlatinumPartyPokemonData({
        ...parsed,
        moves: [
          1,
          2,
          3,
          4,
          5,
        ],
        pp: [
          1,
          1,
          1,
          1,
          1,
        ],
        ppUps: [
          0,
          0,
          0,
          0,
          0,
        ],
      }),
    ).toThrow(/move count/i);

    expect(() =>
      writePlatinumPartyPokemonData({
        ...parsed,
        nicknameCodes: [1],
      }),
    ).toThrow(/nickname length/i);

    expect(() =>
      writePlatinumPartyPokemonData({
        ...parsed,
        metDate: {
          year: 24,
          month: 0,
          day: 2,
        },
      }),
    ).toThrow(/met date/i);
  });
});
