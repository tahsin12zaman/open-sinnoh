import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePlatinumName } from '../../importer/src/platinum-save.ts';
import {
  cryptPlatinumPokemonData,
  platinumPokemonBlockOrder,
  platinumPokemonChecksum,
  PLATINUM_BOX_DATA_SIZE,
  PLATINUM_BOX_POKEMON_SIZE,
  PLATINUM_DATA_BLOCK_SIZE,
} from './platinum-pokemon.ts';
import {
  decodePlatinumBoxPokemon,
  encodeEmptyPlatinumBoxPokemon,
  encodePlatinumBoxPokemon,
  PLATINUM_PC_BOX_COUNT,
  PLATINUM_PC_BOX_NAME_CODE_COUNT,
  PLATINUM_PC_BOX_SLOTS,
  readPlatinumPcBoxes,
  writePlatinumPcBoxes,
  type DecodedPlatinumBoxPokemon,
  type PlatinumPcBoxes,
} from './platinum-pc-boxes.ts';
import {
  crc16Ccitt,
  PLATINUM_GENERAL_BLOCK,
  PLATINUM_SAVE_COPY_OFFSETS,
  PLATINUM_SAVE_FOOTER_SIZE,
  PLATINUM_SAVE_SIGNATURE,
  PLATINUM_SAVE_SIZE,
  PLATINUM_STORAGE_BLOCK,
} from './platinum-save.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function makeSequence(
  size: number,
  start: number,
): Uint8Array {
  return Uint8Array.from(
    { length: size },
    (_, index) =>
      (start + index * 11) & 0xff,
  );
}

function makePokemon(
  personality: number,
  species: number,
  start: number,
): DecodedPlatinumBoxPokemon {
  const blockA = makeSequence(
    PLATINUM_DATA_BLOCK_SIZE,
    start,
  );

  new DataView(
    blockA.buffer,
    blockA.byteOffset,
    blockA.byteLength,
  ).setUint16(
    0,
    species,
    true,
  );

  return {
    personality,
    sanity: 0x2345,
    checksum: 0xffff,
    blocks: [
      blockA,
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
  };
}

function physicalBlocks(
  pokemon: DecodedPlatinumBoxPokemon,
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

function speciesOf(
  pokemon: DecodedPlatinumBoxPokemon,
): number {
  const block = pokemon.blocks[0];

  return new DataView(
    block.buffer,
    block.byteOffset,
    block.byteLength,
  ).getUint16(0, true);
}

function expectPokemonEqual(
  actual: DecodedPlatinumBoxPokemon,
  expected: DecodedPlatinumBoxPokemon,
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
  expect(actual.checksum).toBe(
    platinumPokemonChecksum(
      physicalBlocks(expected),
    ),
  );
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
    70,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_GENERAL_BLOCK,
    70,
    2,
  );
  writeBlock(
    save,
    primary,
    PLATINUM_STORAGE_BLOCK,
    70,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_STORAGE_BLOCK,
    70,
    2,
  );

  return save;
}

function makePc(): PlatinumPcBoxes {
  const boxes = Array.from(
    {
      length:
        PLATINUM_PC_BOX_COUNT,
    },
    (_, boxIndex) => ({
      nameCodes: Array.from(
        {
          length:
            PLATINUM_PC_BOX_NAME_CODE_COUNT,
        },
        (_, index) =>
          index === 0
            ? 0x012b + boxIndex
            : 0xffff,
      ),
      wallpaper: boxIndex,
      slots: Array.from(
        {
          length:
            PLATINUM_PC_BOX_SLOTS,
        },
        () =>
          null as
            DecodedPlatinumBoxPokemon |
            null,
      ),
    }),
  );

  boxes[0]!.slots[0] =
    makePokemon(
      3 << 13,
      25,
      0x10,
    );

  boxes[5]!.slots[12] =
    makePokemon(
      17 << 13,
      150,
      0x20,
    );

  boxes[17]!.slots[29] =
    makePokemon(
      29 << 13,
      493,
      0x30,
    );

  return {
    currentBox: 17,
    unlockedWallpapers: 0x5a,
    boxes,
  };
}

describe('Platinum PC boxes', () => {
  it('encodes and decodes every block permutation', () => {
    for (
      let index = 0;
      index < 32;
      index++
    ) {
      const pokemon =
        makePokemon(
          (index << 13) |
            index * 101,
          index + 1,
          0x10 + index,
        );

      const encoded =
        encodePlatinumBoxPokemon(
          pokemon,
        );

      expect(encoded).toHaveLength(
        PLATINUM_BOX_POKEMON_SIZE,
      );

      const decoded =
        decodePlatinumBoxPokemon(
          encoded,
        );

      expectPokemonEqual(
        decoded,
        pokemon,
      );
    }
  });

  it('encodes a valid empty PC slot', () => {
    const encoded =
      encodeEmptyPlatinumBoxPokemon();

    expect(encoded).toHaveLength(
      PLATINUM_BOX_POKEMON_SIZE,
    );

    const decoded =
      decodePlatinumBoxPokemon(
        encoded,
      );

    expect(speciesOf(decoded)).toBe(0);
    expect(decoded.checksum).toBe(0);

    expect(
      cryptPlatinumPokemonData(
        encoded.slice(8),
        0,
      ),
    ).toHaveLength(
      PLATINUM_BOX_DATA_SIZE,
    );
  });

  it('round-trips all 18 boxes through the storage block', () => {
    const pc = makePc();

    const written =
      writePlatinumPcBoxes(
        makeSave(),
        pc,
      );

    const decoded =
      readPlatinumPcBoxes(written);

    expect(decoded.currentBox).toBe(
      pc.currentBox,
    );
    expect(
      decoded.unlockedWallpapers,
    ).toBe(
      pc.unlockedWallpapers,
    );
    expect(decoded.boxes).toHaveLength(
      PLATINUM_PC_BOX_COUNT,
    );

    decoded.boxes.forEach(
      (box, boxIndex) => {
        const expectedBox =
          pc.boxes[boxIndex]!;

        expect(box.nameCodes).toEqual(
          expectedBox.nameCodes,
        );
        expect(box.wallpaper).toBe(
          expectedBox.wallpaper,
        );
        expect(box.slots).toHaveLength(
          PLATINUM_PC_BOX_SLOTS,
        );

        box.slots.forEach(
          (pokemon, slotIndex) => {
            const expected =
              expectedBox.slots[
                slotIndex
              ];

            if (expected === null) {
              expect(pokemon).toBeNull();
            } else {
              expect(pokemon).not.toBeNull();
              expectPokemonEqual(
                pokemon!,
                expected!,
              );
            }
          },
        );
      },
    );
  });

  it('replaces occupied slots with valid empty records', () => {
    const pc = makePc();

    const first =
      writePlatinumPcBoxes(
        makeSave(),
        pc,
      );

    pc.boxes[0]!.slots[0] = null;
    pc.boxes[5]!.slots[12] = null;
    pc.boxes[17]!.slots[29] = null;

    const second =
      writePlatinumPcBoxes(
        first,
        pc,
      );

    const decoded =
      readPlatinumPcBoxes(second);

    expect(
      decoded.boxes.flatMap(
        (box) =>
          box.slots.filter(
            (pokemon) =>
              pokemon !== null,
          ),
      ),
    ).toHaveLength(0);
  });

  it('rejects invalid box metadata and records', () => {
    const pc = makePc();

    expect(() =>
      writePlatinumPcBoxes(
        makeSave(),
        {
          ...pc,
          currentBox:
            PLATINUM_PC_BOX_COUNT,
        },
      ),
    ).toThrow(/current PC box/i);

    expect(() =>
      writePlatinumPcBoxes(
        makeSave(),
        {
          ...pc,
          boxes: pc.boxes.slice(
            0,
            -1,
          ),
        },
      ),
    ).toThrow(/box count/i);

    expect(() =>
      writePlatinumPcBoxes(
        makeSave(),
        {
          ...pc,
          boxes: pc.boxes.map(
            (box, index) =>
              index === 0
                ? {
                    ...box,
                    slots:
                      box.slots.slice(
                        0,
                        -1,
                      ),
                  }
                : box,
          ),
        },
      ),
    ).toThrow(/slot count/i);
  });

  it.skipIf(!savePath)(
    'reads every box from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const pc =
        readPlatinumPcBoxes(save);

      expect(pc.boxes).toHaveLength(
        PLATINUM_PC_BOX_COUNT,
      );

      for (const box of pc.boxes) {
        expect(box.slots).toHaveLength(
          PLATINUM_PC_BOX_SLOTS,
        );
      }

      const occupied =
        pc.boxes.flatMap(
          (box, boxIndex) =>
            box.slots.flatMap(
              (pokemon, slot) =>
                pokemon === null
                  ? []
                  : [
                      {
                        box: boxIndex,
                        slot,
                        species:
                          speciesOf(
                            pokemon,
                          ),
                      },
                    ],
            ),
        );

      console.log('pc boxes:', {
        currentBox:
          pc.currentBox,
        unlockedWallpapers:
          pc.unlockedWallpapers,
        occupiedCount:
          occupied.length,
        names: pc.boxes.map(
          (box) =>
            decodePlatinumName(
              box.nameCodes,
            ),
        ),
        wallpapers:
          pc.boxes.map(
            (box) =>
              box.wallpaper,
          ),
        occupied,
      });
    },
  );
});
