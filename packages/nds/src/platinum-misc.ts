import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_MISC_DATA_OFFSET = 0x20c4;

/**
 * MiscSaveBlock layout:
 *
 * 0x000 BerryPatch[128], 128 × 14 = 0x700
 * 0x700 PersistedMapFeatures
 * 0x724 rivalName[8]
 * 0x734 tabletName[11]
 */
export const PLATINUM_MAP_FEATURES_OFFSET = 0x700;
export const PLATINUM_MAP_FEATURES_BUFFER_SIZE = 32;
export const PLATINUM_MISC_RIVAL_NAME_OFFSET = 0x724;
export const PLATINUM_TABLET_NAME_OFFSET = 0x734;
export const PLATINUM_TABLET_NAME_LENGTH = 11;

export interface PlatinumPersistedMapFeatures {
  id: number;
  buffer: Uint8Array;
}

export interface PlatinumMiscData {
  mapFeatures: PlatinumPersistedMapFeatures;
  tabletNameCodes: number[];
}

export function readPlatinumMiscData(
  save: Uint8Array,
): PlatinumMiscData {
  const { general } = selectPlatinumSaveBlocks(save);

  const base =
    general.offset + PLATINUM_MISC_DATA_OFFSET;

  const minimumEnd =
    base +
    PLATINUM_TABLET_NAME_OFFSET +
    PLATINUM_TABLET_NAME_LENGTH * 2;

  if (base < 0 || minimumEnd > save.length) {
    throw new Error(
      'Platinum MiscSaveBlock is outside the file',
    );
  }

  const view = new DataView(
    save.buffer,
    save.byteOffset,
    save.byteLength,
  );

  const featuresOffset =
    base + PLATINUM_MAP_FEATURES_OFFSET;

  const id = view.getInt32(featuresOffset, true);

  if (id < 0 || id > 10) {
    throw new Error(
      `Invalid Platinum dynamic map-features id ${id}`,
    );
  }

  return {
    mapFeatures: {
      id,
      buffer: save.slice(
        featuresOffset + 4,
        featuresOffset +
          4 +
          PLATINUM_MAP_FEATURES_BUFFER_SIZE,
      ),
    },

    tabletNameCodes: Array.from(
      { length: PLATINUM_TABLET_NAME_LENGTH },
      (_, index) =>
        view.getUint16(
          base +
            PLATINUM_TABLET_NAME_OFFSET +
            index * 2,
          true,
        ),
    ),
  };
}