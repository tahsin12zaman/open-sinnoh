import {
  cryptPlatinumPokemonData,
  platinumPokemonBlockOrder,
  platinumPokemonChecksum,
  PLATINUM_BOX_DATA_OFFSET,
  PLATINUM_BOX_DATA_SIZE,
  PLATINUM_BOX_POKEMON_SIZE,
  PLATINUM_DATA_BLOCK_SIZE,
} from './platinum-pokemon.ts';
import {
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

export const PLATINUM_PC_BOX_COUNT = 18;
export const PLATINUM_PC_BOX_SLOTS = 30;
export const PLATINUM_PC_BOX_NAME_CODE_COUNT = 20;

export const PLATINUM_PC_CURRENT_BOX_OFFSET = 0x00;
export const PLATINUM_PC_POKEMON_OFFSET = 0x04;

export const PLATINUM_PC_POKEMON_COUNT =
  PLATINUM_PC_BOX_COUNT *
  PLATINUM_PC_BOX_SLOTS;

export const PLATINUM_PC_NAMES_OFFSET =
  PLATINUM_PC_POKEMON_OFFSET +
  PLATINUM_PC_POKEMON_COUNT *
    PLATINUM_BOX_POKEMON_SIZE;

export const PLATINUM_PC_WALLPAPERS_OFFSET =
  PLATINUM_PC_NAMES_OFFSET +
  PLATINUM_PC_BOX_COUNT *
    PLATINUM_PC_BOX_NAME_CODE_COUNT *
    2;

export const PLATINUM_PC_UNLOCKED_WALLPAPERS_OFFSET =
  PLATINUM_PC_WALLPAPERS_OFFSET +
  PLATINUM_PC_BOX_COUNT;

export const PLATINUM_PC_DATA_SIZE =
  PLATINUM_PC_UNLOCKED_WALLPAPERS_OFFSET + 1;

export interface DecodedPlatinumBoxPokemon {
  personality: number;
  /** Preserved two-byte Pokémon sanity field. */
  sanity?: number;
  /**
   * Checksum read from the record. Encoding recalculates it from
   * the supplied logical blocks.
   */
  checksum: number;
  blocks: [
    Uint8Array,
    Uint8Array,
    Uint8Array,
    Uint8Array,
  ];
}

export interface PlatinumPcBox {
  nameCodes: number[];
  wallpaper: number;
  slots: (
    DecodedPlatinumBoxPokemon |
    null
  )[];
}

export interface PlatinumPcBoxes {
  currentBox: number;
  unlockedWallpapers: number;
  boxes: PlatinumPcBox[];
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
      `Invalid Platinum ${name} ${value}`,
    );
  }
}

function copyRange(
  bytes: Uint8Array,
  offset: number,
  size: number,
): Uint8Array {
  if (
    offset < 0 ||
    offset + size > bytes.length
  ) {
    throw new Error(
      'Platinum boxed Pokémon data is outside the file',
    );
  }

  return bytes.slice(
    offset,
    offset + size,
  );
}

function validateBoxPokemon(
  pokemon: DecodedPlatinumBoxPokemon,
): void {
  validateInteger(
    'boxed Pokémon personality',
    pokemon.personality,
    0,
    0xffffffff,
  );
  validateInteger(
    'boxed Pokémon sanity',
    pokemon.sanity ?? 0,
    0,
    0xffff,
  );

  if (pokemon.blocks.length !== 4) {
    throw new Error(
      `Invalid Platinum boxed Pokémon block count ${pokemon.blocks.length}`,
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
          `Invalid Platinum boxed Pokémon block ${index} size ${block.length}`,
        );
      }
    },
  );
}

export function decodePlatinumBoxPokemon(
  bytes: Uint8Array,
  offset = 0,
): DecodedPlatinumBoxPokemon {
  const record = copyRange(
    bytes,
    offset,
    PLATINUM_BOX_POKEMON_SIZE,
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

  const encryptedBlocks =
    record.slice(
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
    platinumPokemonChecksum(
      decryptedBlocks,
    );

  if (actualChecksum !== checksum) {
    throw new Error(
      `Invalid Platinum boxed Pokémon checksum 0x${checksum.toString(16)}, expected 0x${actualChecksum.toString(16)}`,
    );
  }

  const order =
    platinumPokemonBlockOrder(
      personality,
    );

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
  };
}

export function encodePlatinumBoxPokemon(
  pokemon: DecodedPlatinumBoxPokemon,
): Uint8Array {
  validateBoxPokemon(pokemon);

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
      physicalBlocks.set(
        block,
        order[logicalIndex]! *
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

  const record = new Uint8Array(
    PLATINUM_BOX_POKEMON_SIZE,
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

  return record;
}

export function encodeEmptyPlatinumBoxPokemon(): Uint8Array {
  const emptyBlock = () =>
    new Uint8Array(
      PLATINUM_DATA_BLOCK_SIZE,
    );

  return encodePlatinumBoxPokemon({
    personality: 0,
    sanity: 0,
    checksum: 0,
    blocks: [
      emptyBlock(),
      emptyBlock(),
      emptyBlock(),
      emptyBlock(),
    ],
  });
}

function boxedSpecies(
  pokemon: DecodedPlatinumBoxPokemon,
): number {
  const blockA = pokemon.blocks[0];

  return new DataView(
    blockA.buffer,
    blockA.byteOffset,
    blockA.byteLength,
  ).getUint16(0, true);
}

export function readPlatinumPcBoxes(
  save: Uint8Array,
): PlatinumPcBoxes {
  const { storage } =
    selectPlatinumSaveBlocks(save);
  const base = storage.offset;

  const minimumEnd =
    base + PLATINUM_PC_DATA_SIZE;

  if (minimumEnd > save.length) {
    throw new Error(
      'Platinum PC box data is truncated',
    );
  }

  const view = new DataView(
    save.buffer,
    save.byteOffset,
    save.byteLength,
  );

  const currentBox = view.getUint32(
    base +
      PLATINUM_PC_CURRENT_BOX_OFFSET,
    true,
  );

  if (
    currentBox < 0 ||
    currentBox >= PLATINUM_PC_BOX_COUNT
  ) {
    throw new Error(
      `Invalid Platinum current PC box ${currentBox}`,
    );
  }

  const boxes = Array.from(
    {
      length:
        PLATINUM_PC_BOX_COUNT,
    },
    (_, boxIndex): PlatinumPcBox => {
      const slots = Array.from(
        {
          length:
            PLATINUM_PC_BOX_SLOTS,
        },
        (_, slotIndex) => {
          const globalSlot =
            boxIndex *
              PLATINUM_PC_BOX_SLOTS +
            slotIndex;

          const pokemon =
            decodePlatinumBoxPokemon(
              save,
              base +
                PLATINUM_PC_POKEMON_OFFSET +
                globalSlot *
                  PLATINUM_BOX_POKEMON_SIZE,
            );

          return boxedSpecies(pokemon) === 0
            ? null
            : pokemon;
        },
      );

      const nameOffset =
        base +
        PLATINUM_PC_NAMES_OFFSET +
        boxIndex *
          PLATINUM_PC_BOX_NAME_CODE_COUNT *
          2;

      const nameCodes = Array.from(
        {
          length:
            PLATINUM_PC_BOX_NAME_CODE_COUNT,
        },
        (_, index) =>
          view.getUint16(
            nameOffset +
              index * 2,
            true,
          ),
      );

      const wallpaper =
        view.getUint8(
          base +
            PLATINUM_PC_WALLPAPERS_OFFSET +
            boxIndex,
        );

      return {
        nameCodes,
        wallpaper,
        slots,
      };
    },
  );

  return {
    currentBox,
    boxes,
    unlockedWallpapers:
      view.getUint8(
        base +
          PLATINUM_PC_UNLOCKED_WALLPAPERS_OFFSET,
      ),
  };
}

export function writePlatinumPcBoxes(
  save: Uint8Array,
  pc: PlatinumPcBoxes,
): Uint8Array {
  validateInteger(
    'current PC box',
    pc.currentBox,
    0,
    PLATINUM_PC_BOX_COUNT - 1,
  );
  validateInteger(
    'unlocked PC wallpapers',
    pc.unlockedWallpapers,
    0,
    0xff,
  );

  if (
    pc.boxes.length !==
    PLATINUM_PC_BOX_COUNT
  ) {
    throw new Error(
      `Invalid Platinum PC box count ${pc.boxes.length}`,
    );
  }

  const records: Uint8Array[] = [];
  const names: number[][] = [];
  const wallpapers: number[] = [];

  pc.boxes.forEach(
    (box, boxIndex) => {
      if (
        box.slots.length !==
        PLATINUM_PC_BOX_SLOTS
      ) {
        throw new Error(
          `Invalid Platinum PC box ${boxIndex} slot count ${box.slots.length}`,
        );
      }

      if (
        box.nameCodes.length !==
        PLATINUM_PC_BOX_NAME_CODE_COUNT
      ) {
        throw new Error(
          `Invalid Platinum PC box ${boxIndex} name length ${box.nameCodes.length}`,
        );
      }

      const nameCodes =
        box.nameCodes.map(
          (code, index) => {
            validateInteger(
              `PC box ${boxIndex} name code ${index}`,
              code,
              0,
              0xffff,
            );

            return code;
          },
        );

      validateInteger(
        `PC box ${boxIndex} wallpaper`,
        box.wallpaper,
        0,
        0xff,
      );

      names.push(nameCodes);
      wallpapers.push(
        box.wallpaper,
      );

      box.slots.forEach(
        (pokemon) => {
          records.push(
            pokemon === null
              ? encodeEmptyPlatinumBoxPokemon()
              : encodePlatinumBoxPokemon(
                  pokemon,
                ),
          );
        },
      );
    },
  );

  return writePlatinumSave(
    save,
    ({ storage }) => {
      const view = new DataView(
        storage.buffer,
        storage.byteOffset,
        storage.byteLength,
      );

      view.setUint32(
        PLATINUM_PC_CURRENT_BOX_OFFSET,
        pc.currentBox,
        true,
      );

      records.forEach(
        (record, index) => {
          storage.set(
            record,
            PLATINUM_PC_POKEMON_OFFSET +
              index *
                PLATINUM_BOX_POKEMON_SIZE,
          );
        },
      );

      names.forEach(
        (nameCodes, boxIndex) => {
          const nameOffset =
            PLATINUM_PC_NAMES_OFFSET +
            boxIndex *
              PLATINUM_PC_BOX_NAME_CODE_COUNT *
              2;

          nameCodes.forEach(
            (code, index) => {
              view.setUint16(
                nameOffset +
                  index * 2,
                code,
                true,
              );
            },
          );
        },
      );

      wallpapers.forEach(
        (wallpaper, boxIndex) => {
          view.setUint8(
            PLATINUM_PC_WALLPAPERS_OFFSET +
              boxIndex,
            wallpaper,
          );
        },
      );

      view.setUint8(
        PLATINUM_PC_UNLOCKED_WALLPAPERS_OFFSET,
        pc.unlockedWallpapers,
      );
    },
  );
}
