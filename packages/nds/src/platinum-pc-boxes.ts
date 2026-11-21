import {
  cryptPlatinumPokemonData,
  platinumPokemonBlockOrder,
  platinumPokemonChecksum,
  PLATINUM_BOX_DATA_OFFSET,
  PLATINUM_BOX_DATA_SIZE,
  PLATINUM_BOX_POKEMON_SIZE,
  PLATINUM_DATA_BLOCK_SIZE,
} from './platinum-pokemon.ts';
import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_PC_BOX_COUNT = 18;
export const PLATINUM_PC_BOX_SLOTS = 30;
export const PLATINUM_PC_BOX_NAME_CODE_COUNT = 20;

export const PLATINUM_PC_CURRENT_BOX_OFFSET = 0x00;
export const PLATINUM_PC_POKEMON_OFFSET = 0x04;

export const PLATINUM_PC_POKEMON_COUNT =
  PLATINUM_PC_BOX_COUNT * PLATINUM_PC_BOX_SLOTS;

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

export interface DecodedPlatinumBoxPokemon {
  personality: number;
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
  slots: (DecodedPlatinumBoxPokemon | null)[];
}

export interface PlatinumPcBoxes {
  currentBox: number;
  unlockedWallpapers: number;
  boxes: PlatinumPcBox[];
}

function copyRange(
  bytes: Uint8Array,
  offset: number,
  size: number,
): Uint8Array {
  if (offset < 0 || offset + size > bytes.length) {
    throw new Error(
      'Platinum boxed Pokémon data is outside the file',
    );
  }

  return bytes.slice(offset, offset + size);
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

  const personality = view.getUint32(0, true);
  const checksum = view.getUint16(6, true);

  const encryptedBlocks = record.slice(
    PLATINUM_BOX_DATA_OFFSET,
    PLATINUM_BOX_DATA_OFFSET +
      PLATINUM_BOX_DATA_SIZE,
  );

  const decryptedBlocks = cryptPlatinumPokemonData(
    encryptedBlocks,
    checksum,
  );

  const actualChecksum =
    platinumPokemonChecksum(decryptedBlocks);

  if (actualChecksum !== checksum) {
    throw new Error(
      `Invalid Platinum boxed Pokémon checksum 0x${checksum.toString(16)}, expected 0x${actualChecksum.toString(16)}`,
    );
  }

  const order = platinumPokemonBlockOrder(personality);

  const blocks = order.map((physicalIndex) =>
    decryptedBlocks.slice(
      physicalIndex * PLATINUM_DATA_BLOCK_SIZE,
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
    checksum,
    blocks,
  };
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
  const { storage } = selectPlatinumSaveBlocks(save);
  const base = storage.offset;

  const minimumEnd =
    base +
    PLATINUM_PC_UNLOCKED_WALLPAPERS_OFFSET +
    1;

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
    base + PLATINUM_PC_CURRENT_BOX_OFFSET,
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
    { length: PLATINUM_PC_BOX_COUNT },
    (_, boxIndex): PlatinumPcBox => {
      const slots = Array.from(
        { length: PLATINUM_PC_BOX_SLOTS },
        (_, slotIndex) => {
          const globalSlot =
            boxIndex * PLATINUM_PC_BOX_SLOTS +
            slotIndex;

          const pokemon = decodePlatinumBoxPokemon(
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
            nameOffset + index * 2,
            true,
          ),
      );

      const wallpaper = view.getUint8(
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
    unlockedWallpapers: view.getUint8(
      base +
        PLATINUM_PC_UNLOCKED_WALLPAPERS_OFFSET,
    ),
  };
}