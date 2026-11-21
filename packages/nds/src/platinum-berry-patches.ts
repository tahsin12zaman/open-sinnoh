import {
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

/**
 * MiscSaveBlock begins here in Platinum's general save block.
 *
 * Its first member is:
 *   BerryPatch berryPatches[MAX_BERRY_PATCHES]
 */
export const PLATINUM_BERRY_PATCHES_OFFSET = 0x20c4;

/** Native MAX_BERRY_PATCHES storage capacity. */
export const PLATINUM_BERRY_PATCH_CAPACITY = 128;

/**
 * Number of actual berry-soil objects represented by Platinum's berry
 * initialization table. The remaining native storage slots are unused
 * capacity and are not guaranteed to contain initialized data.
 */
export const PLATINUM_BERRY_PATCH_COUNT = 118;

/**
 * Native sizeof(BerryPatch).
 *
 * Layout:
 *   0x00 u8  berryID
 *   0x01 u8  growthStage
 *   0x02 u16 stageMinutesRemaining
 *   0x04 u16 moistureMinutesRemaining
 *   0x06 u8  replantCount
 *   0x07 u8  padding
 *   0x08 u16 yield
 *   0x0a u8  moistureRating
 *   0x0b u8  yieldRating
 *   0x0c u8  mulchType
 *   0x0d u8  isGrowing
 */
export const PLATINUM_BERRY_PATCH_SIZE = 0x0e;

export interface PlatinumBerryPatch {
  berryId: number;
  growthStage: number;
  stageMinutesRemaining: number;
  moistureMinutesRemaining: number;
  replantCount: number;
  yield: number;
  moistureRating: number;
  yieldRating: number;
  mulchType: number;
  isGrowing: boolean;
}

function validateInteger(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
  index: number,
): void {
  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `Invalid Platinum ${name} ${value} in patch ${index}`,
    );
  }
}

function validatePatch(
  patch: PlatinumBerryPatch,
  index: number,
): void {
  validateInteger(
    'berry id',
    patch.berryId,
    0,
    64,
    index,
  );
  validateInteger(
    'berry growth stage',
    patch.growthStage,
    0,
    5,
    index,
  );
  validateInteger(
    'stage minutes remaining',
    patch.stageMinutesRemaining,
    0,
    0xffff,
    index,
  );
  validateInteger(
    'moisture minutes remaining',
    patch.moistureMinutesRemaining,
    0,
    0xffff,
    index,
  );
  validateInteger(
    'replant count',
    patch.replantCount,
    0,
    0xff,
    index,
  );
  validateInteger(
    'berry yield',
    patch.yield,
    0,
    0xffff,
    index,
  );
  validateInteger(
    'moisture rating',
    patch.moistureRating,
    0,
    0xff,
    index,
  );
  validateInteger(
    'yield rating',
    patch.yieldRating,
    0,
    0xff,
    index,
  );
  validateInteger(
    'mulch type',
    patch.mulchType,
    0,
    4,
    index,
  );

  if (
    typeof patch.isGrowing !==
    'boolean'
  ) {
    throw new Error(
      `Invalid Platinum growing flag in patch ${index}`,
    );
  }
}

export function readPlatinumBerryPatches(
  bytes: Uint8Array,
): PlatinumBerryPatch[] {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const start =
    general.offset +
    PLATINUM_BERRY_PATCHES_OFFSET;

  const end =
    start +
    PLATINUM_BERRY_PATCH_COUNT *
      PLATINUM_BERRY_PATCH_SIZE;

  if (
    start < 0 ||
    end > bytes.length
  ) {
    throw new Error(
      'Platinum berry-patch data is outside the file',
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  return Array.from(
    {
      length:
        PLATINUM_BERRY_PATCH_COUNT,
    },
    (_, index): PlatinumBerryPatch => {
      const offset =
        start +
        index *
          PLATINUM_BERRY_PATCH_SIZE;

      const berryId =
        view.getUint8(offset);
      const growthStage =
        view.getUint8(offset + 1);
      const mulchType =
        view.getUint8(
          offset + 0x0c,
        );
      const growingValue =
        view.getUint8(
          offset + 0x0d,
        );

      if (berryId > 64) {
        throw new Error(
          `Invalid Platinum berry id ${berryId} in patch ${index}`,
        );
      }

      if (growthStage > 5) {
        throw new Error(
          `Invalid Platinum berry growth stage ${growthStage} in patch ${index}`,
        );
      }

      if (mulchType > 4) {
        throw new Error(
          `Invalid Platinum mulch type ${mulchType} in patch ${index}`,
        );
      }

      if (growingValue > 1) {
        throw new Error(
          `Invalid Platinum growing flag ${growingValue} in patch ${index}`,
        );
      }

      return {
        berryId,
        growthStage,
        stageMinutesRemaining:
          view.getUint16(
            offset + 2,
            true,
          ),
        moistureMinutesRemaining:
          view.getUint16(
            offset + 4,
            true,
          ),
        replantCount:
          view.getUint8(
            offset + 6,
          ),
        yield: view.getUint16(
          offset + 8,
          true,
        ),
        moistureRating:
          view.getUint8(
            offset + 0x0a,
          ),
        yieldRating:
          view.getUint8(
            offset + 0x0b,
          ),
        mulchType,
        isGrowing:
          growingValue === 1,
      };
    },
  );
}

export function writePlatinumBerryPatches(
  bytes: Uint8Array,
  patches: PlatinumBerryPatch[],
): Uint8Array {
  if (
    patches.length !==
    PLATINUM_BERRY_PATCH_COUNT
  ) {
    throw new Error(
      `Invalid Platinum berry-patch count ${patches.length}`,
    );
  }

  patches.forEach(
    validatePatch,
  );

  return writePlatinumSave(
    bytes,
    ({ general }) => {
      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );

      patches.forEach(
        (patch, index) => {
          const offset =
            PLATINUM_BERRY_PATCHES_OFFSET +
            index *
              PLATINUM_BERRY_PATCH_SIZE;

          view.setUint8(
            offset,
            patch.berryId,
          );
          view.setUint8(
            offset + 1,
            patch.growthStage,
          );
          view.setUint16(
            offset + 2,
            patch.stageMinutesRemaining,
            true,
          );
          view.setUint16(
            offset + 4,
            patch.moistureMinutesRemaining,
            true,
          );
          view.setUint8(
            offset + 6,
            patch.replantCount,
          );

          // Byte 0x07 is native padding and is preserved.

          view.setUint16(
            offset + 8,
            patch.yield,
            true,
          );
          view.setUint8(
            offset + 0x0a,
            patch.moistureRating,
          );
          view.setUint8(
            offset + 0x0b,
            patch.yieldRating,
          );
          view.setUint8(
            offset + 0x0c,
            patch.mulchType,
          );
          view.setUint8(
            offset + 0x0d,
            patch.isGrowing
              ? 1
              : 0,
          );
        },
      );
    },
  );
}
