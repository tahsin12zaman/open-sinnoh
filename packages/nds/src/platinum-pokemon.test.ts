import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  crc16Ccitt,
  PLATINUM_GENERAL_BLOCK,
  PLATINUM_SAVE_COPY_OFFSETS,
  PLATINUM_SAVE_FOOTER_SIZE,
  PLATINUM_SAVE_SIGNATURE,
  PLATINUM_SAVE_SIZE,
  PLATINUM_STORAGE_BLOCK,
  selectPlatinumSaveBlocks,
} from './platinum-save.ts';
import {
  cryptPlatinumPokemonData,
  decodePlatinumPartyPokemon,
  encodePlatinumPartyPokemon,
  PLATINUM_BOX_DATA_OFFSET,
  PLATINUM_BOX_DATA_SIZE,
  PLATINUM_DATA_BLOCK_SIZE,
  PLATINUM_PARTY_CAPACITY,
  PLATINUM_PARTY_DATA_OFFSET,
  PLATINUM_PARTY_DATA_SIZE,
  PLATINUM_PARTY_POKEMON_OFFSET,
  PLATINUM_PARTY_POKEMON_SIZE,
  platinumPokemonBlockOrder,
  platinumPokemonChecksum,
  readPlatinumParty,
  writePlatinumParty,
  type DecodedPlatinumPartyPokemon,
} from './platinum-pokemon.ts';

function makeSequence(
  size: number,
  start: number,
): Uint8Array {
  return Uint8Array.from(
    { length: size },
    (_, index) =>
      (start + index * 7) & 0xff,
  );
}

function makeDecodedPokemon(
  personality: number,
  start = 0x10,
): DecodedPlatinumPartyPokemon {
  return {
    personality,
    sanity: 0x1234,
    checksum: 0,
    blocks: [
      makeSequence(
        PLATINUM_DATA_BLOCK_SIZE,
        start,
      ),
      makeSequence(
        PLATINUM_DATA_BLOCK_SIZE,
        start + 0x30,
      ),
      makeSequence(
        PLATINUM_DATA_BLOCK_SIZE,
        start + 0x60,
      ),
      makeSequence(
        PLATINUM_DATA_BLOCK_SIZE,
        start + 0x90,
      ),
    ],
    partyData: makeSequence(
      PLATINUM_PARTY_DATA_SIZE,
      start + 0xc0,
    ),
  };
}

function makeEncryptedPokemon(
  personality: number,
): {
  record: Uint8Array;
  logicalBlocks: Uint8Array[];
  partyData: Uint8Array;
} {
  const record = new Uint8Array(
    PLATINUM_PARTY_POKEMON_SIZE,
  );

  const logicalBlocks = [
    makeSequence(
      PLATINUM_DATA_BLOCK_SIZE,
      0x10,
    ),
    makeSequence(
      PLATINUM_DATA_BLOCK_SIZE,
      0x40,
    ),
    makeSequence(
      PLATINUM_DATA_BLOCK_SIZE,
      0x70,
    ),
    makeSequence(
      PLATINUM_DATA_BLOCK_SIZE,
      0xa0,
    ),
  ];

  const physicalBlocks =
    new Uint8Array(
      PLATINUM_BOX_DATA_SIZE,
    );

  const order =
    platinumPokemonBlockOrder(
      personality,
    );

  logicalBlocks.forEach(
    (block, logicalIndex) => {
      const physicalIndex =
        order[logicalIndex]!;

      physicalBlocks.set(
        block,
        physicalIndex *
          PLATINUM_DATA_BLOCK_SIZE,
      );
    },
  );

  const checksum =
    platinumPokemonChecksum(
      physicalBlocks,
    );

  const encryptedBlocks =
    cryptPlatinumPokemonData(
      physicalBlocks,
      checksum,
    );

  const partyData = makeSequence(
    PLATINUM_PARTY_DATA_SIZE,
    0xd0,
  );

  const encryptedPartyData =
    cryptPlatinumPokemonData(
      partyData,
      personality,
    );

  const view = new DataView(
    record.buffer,
  );

  view.setUint32(
    0,
    personality,
    true,
  );
  view.setUint16(
    4,
    0x4321,
    true,
  );
  view.setUint16(
    6,
    checksum,
    true,
  );

  record.set(
    encryptedBlocks,
    PLATINUM_BOX_DATA_OFFSET,
  );
  record.set(
    encryptedPartyData,
    PLATINUM_PARTY_DATA_OFFSET,
  );

  return {
    record,
    logicalBlocks,
    partyData,
  };
}

function makeBlock(
  size: number,
  blockId: number,
  saveCounter: number,
  blockCounter: number,
): Uint8Array {
  const bytes = new Uint8Array(size);
  const footerOffset =
    size - PLATINUM_SAVE_FOOTER_SIZE;
  const view = new DataView(
    bytes.buffer,
  );

  view.setUint32(
    footerOffset,
    saveCounter,
    true,
  );
  view.setUint32(
    footerOffset + 4,
    blockCounter,
    true,
  );
  view.setUint32(
    footerOffset + 8,
    size,
    true,
  );
  view.setUint32(
    footerOffset + 12,
    PLATINUM_SAVE_SIGNATURE,
    true,
  );
  view.setUint8(
    footerOffset + 16,
    blockId,
  );
  view.setUint16(
    footerOffset + 18,
    crc16Ccitt(
      bytes,
      0,
      footerOffset,
    ),
    true,
  );

  return bytes;
}

function writeBlock(
  save: Uint8Array,
  copyOffset: number,
  specification: {
    offset: number;
    size: number;
    blockId: number;
  },
  saveCounter: number,
  blockCounter: number,
): void {
  save.set(
    makeBlock(
      specification.size,
      specification.blockId,
      saveCounter,
      blockCounter,
    ),
    copyOffset +
      specification.offset,
  );
}

function makeSave(): Uint8Array {
  const save = new Uint8Array(
    PLATINUM_SAVE_SIZE,
  );
  const [primary, backup] =
    PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(
    save,
    primary,
    PLATINUM_GENERAL_BLOCK,
    60,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_GENERAL_BLOCK,
    60,
    2,
  );
  writeBlock(
    save,
    primary,
    PLATINUM_STORAGE_BLOCK,
    60,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_STORAGE_BLOCK,
    60,
    2,
  );

  return save;
}

function expectPokemonEqual(
  actual: DecodedPlatinumPartyPokemon,
  expected: DecodedPlatinumPartyPokemon,
): void {
  expect(actual.personality).toBe(
    expected.personality,
  );
  expect(actual.sanity).toBe(
    expected.sanity ?? 0,
  );
  expect(actual.blocks).toEqual(
    expected.blocks,
  );
  expect(actual.partyData).toEqual(
    expected.partyData,
  );
  expect(actual.checksum).toBe(
    platinumPokemonChecksum(
      physicalBlocks(expected),
    ),
  );
}

function physicalBlocks(
  pokemon: DecodedPlatinumPartyPokemon,
): Uint8Array {
  const bytes = new Uint8Array(
    PLATINUM_BOX_DATA_SIZE,
  );
  const order =
    platinumPokemonBlockOrder(
      pokemon.personality,
    );

  pokemon.blocks.forEach(
    (block, logicalIndex) => {
      bytes.set(
        block,
        order[logicalIndex]! *
          PLATINUM_DATA_BLOCK_SIZE,
      );
    },
  );

  return bytes;
}

describe('Platinum Pokémon codec', () => {
  it('applies a symmetric half-word cipher', () => {
    const original = makeSequence(
      0x80,
      3,
    );

    const encrypted =
      cryptPlatinumPokemonData(
        original,
        0x12345678,
      );

    expect(encrypted).not.toEqual(
      original,
    );

    expect(
      cryptPlatinumPokemonData(
        encrypted,
        0x12345678,
      ),
    ).toEqual(original);
  });

  it('uses every personality block permutation', () => {
    const orders = Array.from(
      { length: 24 },
      (_, index) =>
        platinumPokemonBlockOrder(
          index << 13,
        ).join(''),
    );

    expect(
      new Set(orders).size,
    ).toBe(24);

    for (
      let index = 24;
      index < 32;
      index++
    ) {
      expect(
        platinumPokemonBlockOrder(
          index << 13,
        ),
      ).toEqual(
        platinumPokemonBlockOrder(
          (index - 24) << 13,
        ),
      );
    }
  });

  it('decrypts and unshuffles a party Pokémon', () => {
    const personality = 13 << 13;
    const {
      record,
      logicalBlocks,
      partyData,
    } = makeEncryptedPokemon(
      personality,
    );

    const decoded =
      decodePlatinumPartyPokemon(
        record,
      );

    expect(decoded.personality).toBe(
      personality,
    );
    expect(decoded.sanity).toBe(
      0x4321,
    );
    expect(decoded.blocks).toEqual(
      logicalBlocks,
    );
    expect(decoded.partyData).toEqual(
      partyData,
    );
  });

  it('encodes and decodes all block permutations', () => {
    for (
      let index = 0;
      index < 32;
      index++
    ) {
      const pokemon =
        makeDecodedPokemon(
          (index << 13) |
            (index * 103),
          0x10 + index,
        );

      const encoded =
        encodePlatinumPartyPokemon(
          pokemon,
        );

      const decoded =
        decodePlatinumPartyPokemon(
          encoded,
        );

      expectPokemonEqual(
        decoded,
        pokemon,
      );
    }
  });

  it('recalculates stale Pokémon checksums', () => {
    const pokemon =
      makeDecodedPokemon(
        0x12345678,
      );

    pokemon.checksum = 0xffff;

    const encoded =
      encodePlatinumPartyPokemon(
        pokemon,
      );

    const decoded =
      decodePlatinumPartyPokemon(
        encoded,
      );

    expect(decoded.checksum).not.toBe(
      0xffff,
    );

    expectPokemonEqual(
      decoded,
      pokemon,
    );
  });

  it('rejects a Pokémon with a bad checksum', () => {
    const { record } =
      makeEncryptedPokemon(5 << 13);

    record[
      PLATINUM_BOX_DATA_OFFSET
    ] =
      record[
        PLATINUM_BOX_DATA_OFFSET
      ]! ^ 1;

    expect(() =>
      decodePlatinumPartyPokemon(
        record,
      ),
    ).toThrow(/checksum/i);
  });

  it('round-trips a complete party through a save', () => {
    const pokemon = [
      makeDecodedPokemon(
        3 << 13,
        0x10,
      ),
      makeDecodedPokemon(
        19 << 13,
        0x20,
      ),
    ];

    const written =
      writePlatinumParty(
        makeSave(),
        {
          capacity:
            PLATINUM_PARTY_CAPACITY,
          count: pokemon.length,
          pokemon,
        },
      );

    const decoded =
      readPlatinumParty(written);

    expect(decoded.capacity).toBe(
      PLATINUM_PARTY_CAPACITY,
    );
    expect(decoded.count).toBe(2);

    decoded.pokemon.forEach(
      (actual, index) => {
        expectPokemonEqual(
          actual,
          pokemon[index]!,
        );
      },
    );
  });

  it('clears unused party records', () => {
    const firstParty = [
      makeDecodedPokemon(
        1 << 13,
        0x10,
      ),
      makeDecodedPokemon(
        2 << 13,
        0x20,
      ),
    ];

    const first =
      writePlatinumParty(
        makeSave(),
        {
          capacity:
            PLATINUM_PARTY_CAPACITY,
          count: 2,
          pokemon: firstParty,
        },
      );

    const second =
      writePlatinumParty(
        first,
        {
          capacity:
            PLATINUM_PARTY_CAPACITY,
          count: 1,
          pokemon: [
            firstParty[0]!,
          ],
        },
      );

    const { general } =
      selectPlatinumSaveBlocks(
        second,
      );

    const unusedStart =
      general.offset +
      PLATINUM_PARTY_POKEMON_OFFSET +
      PLATINUM_PARTY_POKEMON_SIZE;

    expect(
      second.slice(
        unusedStart,
        unusedStart +
          PLATINUM_PARTY_POKEMON_SIZE,
      ),
    ).toEqual(
      new Uint8Array(
        PLATINUM_PARTY_POKEMON_SIZE,
      ),
    );
  });

  it('rejects invalid records and party counts', () => {
    const pokemon =
      makeDecodedPokemon(
        0x12345678,
      );

    expect(() =>
      encodePlatinumPartyPokemon({
        ...pokemon,
        blocks: [
          new Uint8Array(1),
          pokemon.blocks[1],
          pokemon.blocks[2],
          pokemon.blocks[3],
        ],
      }),
    ).toThrow(/block 0 size/i);

    expect(() =>
      writePlatinumParty(
        makeSave(),
        {
          capacity:
            PLATINUM_PARTY_CAPACITY,
          count: 2,
          pokemon: [pokemon],
        },
      ),
    ).toThrow(/does not match/i);
  });

  it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
    'decrypts the party from a real Platinum save',
    () => {
      const bytes = new Uint8Array(
        readFileSync(
          process.env.OPENSINNOH_NDS_SAV!,
        ),
      );

      const party =
        readPlatinumParty(bytes);

      const summary =
        party.pokemon.map(
          (pokemon, slot) => {
            const blockA =
              new DataView(
                pokemon.blocks[0].buffer,
                pokemon.blocks[0]
                  .byteOffset,
                pokemon.blocks[0]
                  .byteLength,
              );

            const partyData =
              new DataView(
                pokemon.partyData.buffer,
                pokemon.partyData
                  .byteOffset,
                pokemon.partyData
                  .byteLength,
              );

            return {
              slot,
              species:
                blockA.getUint16(
                  0,
                  true,
                ),
              level:
                partyData.getUint8(4),
              personality:
                pokemon.personality,
            };
          },
        );

      console.log(
        'party:',
        summary,
      );

      expect(party.capacity).toBe(6);
      expect(
        party.count,
      ).toBeGreaterThan(0);
      expect(
        party.pokemon,
      ).toHaveLength(party.count);

      for (
        const pokemon of summary
      ) {
        expect(
          pokemon.species,
        ).toBeGreaterThan(0);
        expect(
          pokemon.species,
        ).toBeLessThan(494);
        expect(
          pokemon.level,
        ).toBeGreaterThan(0);
        expect(
          pokemon.level,
        ).toBeLessThanOrEqual(100);
      }
    },
  );
});
