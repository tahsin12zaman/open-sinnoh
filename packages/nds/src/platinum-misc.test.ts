import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLATINUM_MAP_FEATURES_BUFFER_SIZE,
  PLATINUM_MISC_DATA_OFFSET,
  PLATINUM_MISC_RIVAL_NAME_OFFSET,
  PLATINUM_TABLET_NAME_LENGTH,
  readPlatinumMiscData,
  writePlatinumMiscData,
  type PlatinumMiscData,
} from './platinum-misc.ts';
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
    90,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_GENERAL_BLOCK,
    90,
    2,
  );
  writeBlock(
    save,
    primary,
    PLATINUM_STORAGE_BLOCK,
    90,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_STORAGE_BLOCK,
    90,
    2,
  );

  return save;
}

const misc: PlatinumMiscData = {
  mapFeatures: {
    id: 7,
    buffer: Uint8Array.from(
      {
        length:
          PLATINUM_MAP_FEATURES_BUFFER_SIZE,
      },
      (_, index) =>
        (index * 13 + 5) & 0xff,
    ),
  },
  tabletNameCodes: Array.from(
    {
      length:
        PLATINUM_TABLET_NAME_LENGTH,
    },
    (_, index) =>
      index < 6
        ? 0x012b + index
        : 0xffff,
  ),
};

describe('Platinum miscellaneous save data', () => {
  it('round-trips all modeled miscellaneous data', () => {
    const written =
      writePlatinumMiscData(
        makeSave(),
        misc,
      );

    expect(
      readPlatinumMiscData(written),
    ).toEqual(misc);
  });

  it('preserves the separately managed rival name', () => {
    const marked =
      writePlatinumSave(
        makeSave(),
        ({ general }) => {
          const rivalOffset =
            PLATINUM_MISC_DATA_OFFSET +
            PLATINUM_MISC_RIVAL_NAME_OFFSET;

          general.fill(
            0xa5,
            rivalOffset,
            rivalOffset + 16,
          );
        },
      );

    const written =
      writePlatinumMiscData(
        marked,
        misc,
      );

    const { general } =
      selectPlatinumSaveBlocks(
        written,
      );

    const rivalOffset =
      general.offset +
      PLATINUM_MISC_DATA_OFFSET +
      PLATINUM_MISC_RIVAL_NAME_OFFSET;

    expect(
      written.slice(
        rivalOffset,
        rivalOffset + 16,
      ),
    ).toEqual(
      new Uint8Array(16).fill(
        0xa5,
      ),
    );
  });

  it('rejects invalid miscellaneous data', () => {
    const save = makeSave();

    expect(() =>
      writePlatinumMiscData(
        save,
        {
          ...misc,
          mapFeatures: {
            ...misc.mapFeatures,
            id: 11,
          },
        },
      ),
    ).toThrow(/map-features id/i);

    expect(() =>
      writePlatinumMiscData(
        save,
        {
          ...misc,
          mapFeatures: {
            ...misc.mapFeatures,
            buffer:
              new Uint8Array(31),
          },
        },
      ),
    ).toThrow(/buffer size/i);

    expect(() =>
      writePlatinumMiscData(
        save,
        {
          ...misc,
          tabletNameCodes: [1],
        },
      ),
    ).toThrow(/tablet-name length/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum MiscSaveBlock',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const realMisc =
        readPlatinumMiscData(save);

      expect(
        realMisc.mapFeatures.id,
      ).toBeGreaterThanOrEqual(0);
      expect(
        realMisc.mapFeatures.id,
      ).toBeLessThanOrEqual(10);
      expect(
        realMisc.mapFeatures.buffer,
      ).toHaveLength(32);
      expect(
        realMisc.tabletNameCodes,
      ).toHaveLength(11);

      console.log('misc data:', {
        mapFeaturesId:
          realMisc.mapFeatures.id,
        mapFeaturesBuffer:
          Buffer.from(
            realMisc.mapFeatures
              .buffer,
          ).toString('hex'),
        tabletNameCodes:
          realMisc.tabletNameCodes.map(
            (code) =>
              `0x${code
                .toString(16)
                .padStart(4, '0')}`,
          ),
      });
    },
  );
});
