import {
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

export const PLATINUM_PARTY_OFFSET = 0x98;
export const PLATINUM_PARTY_CAPACITY = 6;
export const PLATINUM_PARTY_POKEMON_OFFSET = 0xa0;
export const PLATINUM_PARTY_POKEMON_SIZE = 0xec;

export const PLATINUM_BOX_POKEMON_SIZE = 0x88;
export const PLATINUM_BOX_DATA_OFFSET = 0x08;
export const PLATINUM_BOX_DATA_SIZE = 0x80;
export const PLATINUM_DATA_BLOCK_SIZE = 0x20;

export const PLATINUM_PARTY_DATA_OFFSET = 0x88;
export const PLATINUM_PARTY_DATA_SIZE = 0x64;

const LCRNG_MULTIPLIER = 1103515245;
const LCRNG_INCREMENT = 24691;

/**
 * Physical block indexes for logical blocks A, B, C and D.
 * Selected using personality bits 13–17.
 */
const BLOCK_ORDERS: readonly (readonly [
  number,
  number,
  number,
  number,
])[] = [
  [0, 1, 2, 3],
  [0, 1, 3, 2],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
  [0, 2, 3, 1],
  [0, 3, 2, 1],
  [1, 0, 2, 3],
  [1, 0, 3, 2],
  [2, 0, 1, 3],
  [3, 0, 1, 2],
  [2, 0, 3, 1],
  [3, 0, 2, 1],
  [1, 2, 0, 3],
  [1, 3, 0, 2],
  [2, 1, 0, 3],
  [3, 1, 0, 2],
  [2, 3, 0, 1],
  [3, 2, 0, 1],
  [1, 2, 3, 0],
  [1, 3, 2, 0],
  [2, 1, 3, 0],
  [3, 1, 2, 0],
  [2, 3, 1, 0],
  [3, 2, 1, 0],
];

export interface DecodedPlatinumPartyPokemon {
  personality: number;
  /**
   * The two-byte Pokémon sanity field. Older callers that did not
   * preserve it may omit it, in which case encoding writes zero.
   */
  sanity?: number;
  /**
   * Checksum read from the encoded record. Encoding always
   * recalculates this value from the supplied logical blocks.
   */
  checksum: number;
  blocks: [
    Uint8Array,
    Uint8Array,
    Uint8Array,
    Uint8Array,
  ];
  partyData: Uint8Array;
}

export interface DecodedPlatinumParty {
  capacity: number;
  count: number;
  pokemon: DecodedPlatinumPartyPokemon[];
}

function validateInteger(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
): void {
  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `Invalid Platinum Pokémon ${name} ${value}`,
    );
  }
}

function copyRange(
  bytes: Uint8Array,
  offset: number,
  size: number,
): Uint8Array {
  if (offset < 0 || offset + size > bytes.length) {
    throw new Error(
      'Platinum Pokémon data is outside the file',
    );
  }

  return bytes.slice(offset, offset + size);
}

/**
 * Platinum's symmetric half-word cipher. Applying it twice with the
 * same seed restores the original bytes.
 */
export function cryptPlatinumPokemonData(
  bytes: Uint8Array,
  seed: number,
): Uint8Array {
  if (bytes.length % 2 !== 0) {
    throw new Error(
      'Platinum Pokémon encrypted data must have an even size',
    );
  }

  const output = bytes.slice();
  const view = new DataView(
    output.buffer,
    output.byteOffset,
    output.byteLength,
  );

  let state = seed >>> 0;

  for (
    let offset = 0;
    offset < output.length;
    offset += 2
  ) {
    state =
      (Math.imul(state, LCRNG_MULTIPLIER) +
        LCRNG_INCREMENT) >>>
      0;

    const key = state >>> 16;

    view.setUint16(
      offset,
      view.getUint16(offset, true) ^ key,
      true,
    );
  }

  return output;
}

export function platinumPokemonChecksum(
  bytes: Uint8Array,
): number {
  if (bytes.length % 2 !== 0) {
    throw new Error(
      'Platinum Pokémon checksum data must have an even size',
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  let checksum = 0;

  for (
    let offset = 0;
    offset < bytes.length;
    offset += 2
  ) {
    checksum =
      (checksum +
        view.getUint16(offset, true)) &
      0xffff;
  }

  return checksum;
}

export function platinumPokemonBlockOrder(
  personality: number,
): readonly [number, number, number, number] {
  let index =
    (personality & 0x3e000) >>> 13;

  if (index >= 24) {
    index -= 24;
  }

  return BLOCK_ORDERS[index]!;
}

function validatePokemon(
  pokemon: DecodedPlatinumPartyPokemon,
): void {
  validateInteger(
    'personality',
    pokemon.personality,
    0,
    0xffffffff,
  );

  validateInteger(
    'sanity',
    pokemon.sanity ?? 0,
    0,
    0xffff,
  );

  if (pokemon.blocks.length !== 4) {
    throw new Error(
      `Invalid Platinum Pokémon block count ${pokemon.blocks.length}`,
    );
  }

  pokemon.blocks.forEach(
    (block, index) => {
      if (
        !(block instanceof Uint8Array) ||
        block.length !==
          PLATINUM_DATA_BLOCK_SIZE
      ) {
        throw new Error(
          `Invalid Platinum Pokémon block ${index} size ${block.length}`,
        );
      }
    },
  );

  if (
    !(pokemon.partyData instanceof Uint8Array) ||
    pokemon.partyData.length !==
      PLATINUM_PARTY_DATA_SIZE
  ) {
    throw new Error(
      `Invalid Platinum Pokémon party-data size ${pokemon.partyData.length}`,
    );
  }
}

export function decodePlatinumPartyPokemon(
  bytes: Uint8Array,
  offset = 0,
): DecodedPlatinumPartyPokemon {
  const record = copyRange(
    bytes,
    offset,
    PLATINUM_PARTY_POKEMON_SIZE,
  );

  const view = new DataView(
    record.buffer,
    record.byteOffset,
    record.byteLength,
  );

  const personality =
    view.getUint32(0, true);
  const sanity =
    view.getUint16(4, true);
  const checksum =
    view.getUint16(6, true);

  const encryptedBlocks = record.slice(
    PLATINUM_BOX_DATA_OFFSET,
    PLATINUM_BOX_DATA_OFFSET +
      PLATINUM_BOX_DATA_SIZE,
  );

  const decryptedBlocks =
    cryptPlatinumPokemonData(
      encryptedBlocks,
      checksum,
    );

  const actualChecksum =
    platinumPokemonChecksum(decryptedBlocks);

  if (actualChecksum !== checksum) {
    throw new Error(
      `Invalid Platinum Pokémon checksum 0x${checksum.toString(16)}, expected 0x${actualChecksum.toString(16)}`,
    );
  }

  const encryptedPartyData = record.slice(
    PLATINUM_PARTY_DATA_OFFSET,
    PLATINUM_PARTY_DATA_OFFSET +
      PLATINUM_PARTY_DATA_SIZE,
  );

  const partyData =
    cryptPlatinumPokemonData(
      encryptedPartyData,
      personality,
    );

  const order =
    platinumPokemonBlockOrder(personality);

  const blocks = order.map(
    (physicalIndex) =>
      decryptedBlocks.slice(
        physicalIndex *
          PLATINUM_DATA_BLOCK_SIZE,
        (physicalIndex + 1) *
          PLATINUM_DATA_BLOCK_SIZE,
      ),
  ) as [
    Uint8Array,
    Uint8Array,
    Uint8Array,
    Uint8Array,
  ];

  return {
    personality,
    sanity,
    checksum,
    blocks,
    partyData,
  };
}

export function encodePlatinumPartyPokemon(
  pokemon: DecodedPlatinumPartyPokemon,
): Uint8Array {
  validatePokemon(pokemon);

  const physicalBlocks =
    new Uint8Array(
      PLATINUM_BOX_DATA_SIZE,
    );

  const order =
    platinumPokemonBlockOrder(
      pokemon.personality,
    );

  pokemon.blocks.forEach(
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
    platinumPokemonChecksum(physicalBlocks);

  const encryptedBlocks =
    cryptPlatinumPokemonData(
      physicalBlocks,
      checksum,
    );

  const encryptedPartyData =
    cryptPlatinumPokemonData(
      pokemon.partyData,
      pokemon.personality,
    );

  const record = new Uint8Array(
    PLATINUM_PARTY_POKEMON_SIZE,
  );

  const view = new DataView(
    record.buffer,
    record.byteOffset,
    record.byteLength,
  );

  view.setUint32(
    0,
    pokemon.personality,
    true,
  );
  view.setUint16(
    4,
    pokemon.sanity ?? 0,
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

  return record;
}

export function readPlatinumParty(
  bytes: Uint8Array,
): DecodedPlatinumParty {
  const { general } =
    selectPlatinumSaveBlocks(bytes);
  const base = general.offset;

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const capacity = view.getInt32(
    base + PLATINUM_PARTY_OFFSET,
    true,
  );

  const count = view.getInt32(
    base + PLATINUM_PARTY_OFFSET + 4,
    true,
  );

  if (
    capacity !== PLATINUM_PARTY_CAPACITY
  ) {
    throw new Error(
      `Invalid Platinum party capacity ${capacity}`,
    );
  }

  if (count < 0 || count > capacity) {
    throw new Error(
      `Invalid Platinum party count ${count}`,
    );
  }

  const pokemon = Array.from(
    { length: count },
    (_, index) =>
      decodePlatinumPartyPokemon(
        bytes,
        base +
          PLATINUM_PARTY_POKEMON_OFFSET +
          index *
            PLATINUM_PARTY_POKEMON_SIZE,
      ),
  );

  return {
    capacity,
    count,
    pokemon,
  };
}

export function writePlatinumParty(
  bytes: Uint8Array,
  party: DecodedPlatinumParty,
): Uint8Array {
  if (
    party.capacity !==
    PLATINUM_PARTY_CAPACITY
  ) {
    throw new Error(
      `Invalid Platinum party capacity ${party.capacity}`,
    );
  }

  if (
    !Number.isInteger(party.count) ||
    party.count < 0 ||
    party.count > party.capacity
  ) {
    throw new Error(
      `Invalid Platinum party count ${party.count}`,
    );
  }

  if (party.pokemon.length !== party.count) {
    throw new Error(
      `Platinum party count ${party.count} does not match ${party.pokemon.length} Pokémon`,
    );
  }

  const records = party.pokemon.map(
    encodePlatinumPartyPokemon,
  );

  return writePlatinumSave(
    bytes,
    ({ general }) => {
      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );

      view.setInt32(
        PLATINUM_PARTY_OFFSET,
        PLATINUM_PARTY_CAPACITY,
        true,
      );
      view.setInt32(
        PLATINUM_PARTY_OFFSET + 4,
        party.count,
        true,
      );

      const recordsStart =
        PLATINUM_PARTY_POKEMON_OFFSET;
      const recordsEnd =
        recordsStart +
        PLATINUM_PARTY_CAPACITY *
          PLATINUM_PARTY_POKEMON_SIZE;

      general.fill(
        0,
        recordsStart,
        recordsEnd,
      );

      records.forEach(
        (record, index) => {
          general.set(
            record,
            recordsStart +
              index *
                PLATINUM_PARTY_POKEMON_SIZE,
          );
        },
      );
    },
  );
}
