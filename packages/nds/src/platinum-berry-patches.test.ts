import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLATINUM_BERRY_PATCH_CAPACITY,
  PLATINUM_BERRY_PATCH_COUNT,
  PLATINUM_BERRY_PATCH_SIZE,
  PLATINUM_BERRY_PATCHES_OFFSET,
  readPlatinumBerryPatches,
  writePlatinumBerryPatches,
  type PlatinumBerryPatch,
} from './platinum-berry-patches.ts';
import {
  crc16Ccitt,
  PLATINUM_GENERAL_BLOCK,
  PLATINUM_SAVE_COPY_OFFSETS,
  PLATINUM_SAVE_FOOTER_SIZE,
  PLATINUM_SAVE_SIGNATURE,
  PLATINUM_SAVE_SIZE,
  PLATINUM_STORAGE_BLOCK,
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

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
    100,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_GENERAL_BLOCK,
    100,
    2,
  );
  writeBlock(
    save,
    primary,
    PLATINUM_STORAGE_BLOCK,
    100,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_STORAGE_BLOCK,
    100,
    2,
  );

  return save;
}

function emptyPatch(): PlatinumBerryPatch {
  return {
    berryId: 0,
    growthStage: 0,
    stageMinutesRemaining: 0,
    moistureMinutesRemaining: 0,
    replantCount: 0,
    yield: 0,
    moistureRating: 0,
    yieldRating: 0,
    mulchType: 0,
    isGrowing: false,
  };
}

function makePatches(): PlatinumBerryPatch[] {
  const patches = Array.from(
    {
      length:
        PLATINUM_BERRY_PATCH_COUNT,
    },
    emptyPatch,
  );

  patches[0] = {
    berryId: 1,
    growthStage: 1,
    stageMinutesRemaining: 45,
    moistureMinutesRemaining: 90,
    replantCount: 2,
    yield: 5,
    moistureRating: 100,
    yieldRating: 80,
    mulchType: 1,
    isGrowing: true,
  };

  patches[57] = {
    berryId: 32,
    growthStage: 5,
    stageMinutesRemaining: 65535,
    moistureMinutesRemaining: 1234,
    replantCount: 255,
    yield: 65535,
    moistureRating: 255,
    yieldRating: 255,
    mulchType: 4,
    isGrowing: false,
  };

  patches[
    PLATINUM_BERRY_PATCH_COUNT - 1
  ] = {
    berryId: 64,
    growthStage: 3,
    stageMinutesRemaining: 12,
    moistureMinutesRemaining: 34,
    replantCount: 6,
    yield: 8,
    moistureRating: 10,
    yieldRating: 11,
    mulchType: 2,
    isGrowing: true,
  };

  return patches;
}

describe('Platinum berry patches', () => {
  it('round-trips all 118 berry patches', () => {
    const patches = makePatches();

    const written =
      writePlatinumBerryPatches(
        makeSave(),
        patches,
      );

    expect(
      readPlatinumBerryPatches(
        written,
      ),
    ).toEqual(patches);
  });

  it('preserves native padding and unused capacity', () => {
    const marked =
      writePlatinumSave(
        makeSave(),
        ({ general }) => {
          for (
            let index = 0;
            index <
            PLATINUM_BERRY_PATCH_COUNT;
            index++
          ) {
            general[
              PLATINUM_BERRY_PATCHES_OFFSET +
                index *
                  PLATINUM_BERRY_PATCH_SIZE +
                7
            ] = 0xa5;
          }

          const unusedStart =
            PLATINUM_BERRY_PATCHES_OFFSET +
            PLATINUM_BERRY_PATCH_COUNT *
              PLATINUM_BERRY_PATCH_SIZE;

          const unusedEnd =
            PLATINUM_BERRY_PATCHES_OFFSET +
            PLATINUM_BERRY_PATCH_CAPACITY *
              PLATINUM_BERRY_PATCH_SIZE;

          general.fill(
            0x5a,
            unusedStart,
            unusedEnd,
          );
        },
      );

    const written =
      writePlatinumBerryPatches(
        marked,
        makePatches(),
      );

    const { general } =
      selectPlatinumSaveBlocks(
        written,
      );

    for (
      let index = 0;
      index <
      PLATINUM_BERRY_PATCH_COUNT;
      index++
    ) {
      expect(
        written[
          general.offset +
            PLATINUM_BERRY_PATCHES_OFFSET +
            index *
              PLATINUM_BERRY_PATCH_SIZE +
            7
        ],
      ).toBe(0xa5);
    }

    const unusedStart =
      general.offset +
      PLATINUM_BERRY_PATCHES_OFFSET +
      PLATINUM_BERRY_PATCH_COUNT *
        PLATINUM_BERRY_PATCH_SIZE;

    const unusedSize =
      (
        PLATINUM_BERRY_PATCH_CAPACITY -
        PLATINUM_BERRY_PATCH_COUNT
      ) *
      PLATINUM_BERRY_PATCH_SIZE;

    expect(
      written.slice(
        unusedStart,
        unusedStart + unusedSize,
      ),
    ).toEqual(
      new Uint8Array(
        unusedSize,
      ).fill(0x5a),
    );
  });

  it('rejects invalid patch counts and values', () => {
    const patches = makePatches();

    expect(() =>
      writePlatinumBerryPatches(
        makeSave(),
        patches.slice(0, -1),
      ),
    ).toThrow(/patch count/i);

    expect(() =>
      writePlatinumBerryPatches(
        makeSave(),
        patches.map(
          (patch, index) =>
            index === 0
              ? {
                  ...patch,
                  berryId: 65,
                }
              : patch,
        ),
      ),
    ).toThrow(/berry id/i);

    expect(() =>
      writePlatinumBerryPatches(
        makeSave(),
        patches.map(
          (patch, index) =>
            index === 0
              ? {
                  ...patch,
                  mulchType: 5,
                }
              : patch,
        ),
      ),
    ).toThrow(/mulch type/i);
  });

  it.skipIf(!savePath)(
    'reads every patch from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const patches =
        readPlatinumBerryPatches(
          save,
        );

      expect(patches).toHaveLength(
        PLATINUM_BERRY_PATCH_COUNT,
      );

      const occupied =
        patches.flatMap(
          (patch, index) =>
            patch.berryId === 0
              ? []
              : [
                  {
                    index,
                    ...patch,
                  },
                ],
        );

      console.log(
        'berry patches:',
        {
          total:
            patches.length,
          occupiedCount:
            occupied.length,
          occupied,
        },
      );
    },
  );
});
