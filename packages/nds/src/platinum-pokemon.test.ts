import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cryptPlatinumPokemonData,
  decodePlatinumPartyPokemon,
  PLATINUM_BOX_DATA_OFFSET,
  PLATINUM_BOX_DATA_SIZE,
  PLATINUM_DATA_BLOCK_SIZE,
  PLATINUM_PARTY_DATA_OFFSET,
  PLATINUM_PARTY_DATA_SIZE,
  PLATINUM_PARTY_POKEMON_SIZE,
  platinumPokemonBlockOrder,
  platinumPokemonChecksum,
  readPlatinumParty,
} from './platinum-pokemon.ts';

function makeSequence(size: number, start: number): Uint8Array {
  return Uint8Array.from(
    { length: size },
    (_, index) => (start + index * 7) & 0xff,
  );
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
    makeSequence(PLATINUM_DATA_BLOCK_SIZE, 0x10),
    makeSequence(PLATINUM_DATA_BLOCK_SIZE, 0x40),
    makeSequence(PLATINUM_DATA_BLOCK_SIZE, 0x70),
    makeSequence(PLATINUM_DATA_BLOCK_SIZE, 0xa0),
  ];

  const physicalBlocks = new Uint8Array(
    PLATINUM_BOX_DATA_SIZE,
  );

  const order = platinumPokemonBlockOrder(personality);

  logicalBlocks.forEach((block, logicalIndex) => {
    const physicalIndex = order[logicalIndex]!;

    physicalBlocks.set(
      block,
      physicalIndex * PLATINUM_DATA_BLOCK_SIZE,
    );
  });

  const checksum = platinumPokemonChecksum(physicalBlocks);
  const encryptedBlocks = cryptPlatinumPokemonData(
    physicalBlocks,
    checksum,
  );

  const partyData = makeSequence(
    PLATINUM_PARTY_DATA_SIZE,
    0xd0,
  );

  const encryptedPartyData = cryptPlatinumPokemonData(
    partyData,
    personality,
  );

  const view = new DataView(record.buffer);

  view.setUint32(0, personality, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, checksum, true);

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

describe('Platinum Pokémon codec', () => {
  it('applies a symmetric half-word cipher', () => {
    const original = makeSequence(0x80, 3);

    const encrypted = cryptPlatinumPokemonData(
      original,
      0x12345678,
    );

    expect(encrypted).not.toEqual(original);

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
        platinumPokemonBlockOrder(index << 13).join(''),
    );

    expect(new Set(orders).size).toBe(24);

    for (let index = 24; index < 32; index++) {
      expect(
        platinumPokemonBlockOrder(index << 13),
      ).toEqual(
        platinumPokemonBlockOrder((index - 24) << 13),
      );
    }
  });

  it('decrypts and unshuffles a party Pokémon', () => {
    const personality = 13 << 13;
    const {
      record,
      logicalBlocks,
      partyData,
    } = makeEncryptedPokemon(personality);

    const decoded = decodePlatinumPartyPokemon(record);

    expect(decoded.personality).toBe(personality);
    expect(decoded.blocks).toEqual(logicalBlocks);
    expect(decoded.partyData).toEqual(partyData);
  });

  it('rejects a Pokémon with a bad checksum', () => {
    const { record } = makeEncryptedPokemon(5 << 13);

    record[PLATINUM_BOX_DATA_OFFSET] =
      record[PLATINUM_BOX_DATA_OFFSET]! ^ 1;

    expect(() =>
      decodePlatinumPartyPokemon(record),
    ).toThrow(/checksum/i);
  });

  it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
    'decrypts the party from a real Platinum save',
    () => {
      const bytes = new Uint8Array(
        readFileSync(process.env.OPENSINNOH_NDS_SAV!),
      );

      const party = readPlatinumParty(bytes);

      const summary = party.pokemon.map(
        (pokemon, slot) => {
          const blockA = new DataView(
            pokemon.blocks[0].buffer,
            pokemon.blocks[0].byteOffset,
            pokemon.blocks[0].byteLength,
          );

          const partyData = new DataView(
            pokemon.partyData.buffer,
            pokemon.partyData.byteOffset,
            pokemon.partyData.byteLength,
          );

          return {
            slot,
            species: blockA.getUint16(0, true),
            level: partyData.getUint8(4),
            personality: pokemon.personality,
          };
        },
      );

      console.log('party:', summary);

      expect(party.capacity).toBe(6);
      expect(party.count).toBeGreaterThan(0);
      expect(party.pokemon).toHaveLength(party.count);

      for (const pokemon of summary) {
        expect(pokemon.species).toBeGreaterThan(0);
        expect(pokemon.species).toBeLessThan(494);
        expect(pokemon.level).toBeGreaterThan(0);
        expect(pokemon.level).toBeLessThanOrEqual(100);
      }
    },
  );
});