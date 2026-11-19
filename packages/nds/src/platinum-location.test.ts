import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  crc16Ccitt,
  PLATINUM_FIELD_STATE_OFFSET,
  PLATINUM_GENERAL_BLOCK,
  PLATINUM_SAVE_COPY_OFFSETS,
  PLATINUM_SAVE_FOOTER_SIZE,
  PLATINUM_SAVE_SIGNATURE,
  PLATINUM_SAVE_SIZE,
  PLATINUM_STORAGE_BLOCK,
  readPlatinumPlayerLocation,
} from './platinum-save.ts';

function makeBlock(
  size: number,
  blockId: number,
  saveCounter: number,
  blockCounter: number,
): Uint8Array {
  const bytes = new Uint8Array(size);
  const footerOffset = size - PLATINUM_SAVE_FOOTER_SIZE;
  const view = new DataView(bytes.buffer);

  view.setUint32(footerOffset, saveCounter, true);
  view.setUint32(footerOffset + 4, blockCounter, true);
  view.setUint32(footerOffset + 8, size, true);
  view.setUint32(
    footerOffset + 12,
    PLATINUM_SAVE_SIGNATURE,
    true,
  );
  view.setUint8(footerOffset + 16, blockId);
  view.setUint8(footerOffset + 17, 0);
  view.setUint16(
    footerOffset + 18,
    crc16Ccitt(bytes, 0, footerOffset),
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
    copyOffset + specification.offset,
  );
}

function refreshBlockChecksum(
  save: Uint8Array,
  blockOffset: number,
  blockSize: number,
): void {
  const footerOffset =
    blockOffset + blockSize - PLATINUM_SAVE_FOOTER_SIZE;

  const view = new DataView(
    save.buffer,
    save.byteOffset,
    save.byteLength,
  );

  view.setUint16(
    footerOffset + 18,
    crc16Ccitt(save, blockOffset, footerOffset),
    true,
  );
}

describe('Platinum player location', () => {
  it('reads the location from the selected general block', () => {
    const save = new Uint8Array(PLATINUM_SAVE_SIZE);
    const [primary, backup] = PLATINUM_SAVE_COPY_OFFSETS;

    writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 15, 1);
    writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 15, 2);
    writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 15, 1);
    writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 15, 2);

    const locationOffset =
      backup +
      PLATINUM_GENERAL_BLOCK.offset +
      PLATINUM_FIELD_STATE_OFFSET;

    const view = new DataView(save.buffer);

    view.setInt32(locationOffset, 123, true);
    view.setInt32(locationOffset + 4, -1, true);
    view.setInt32(locationOffset + 8, 17, true);
    view.setInt32(locationOffset + 12, 29, true);
    view.setInt32(locationOffset + 16, 2, true);

    refreshBlockChecksum(
      save,
      backup + PLATINUM_GENERAL_BLOCK.offset,
      PLATINUM_GENERAL_BLOCK.size,
    );

    expect(readPlatinumPlayerLocation(save)).toEqual({
      mapHeaderId: 123,
      warpId: -1,
      x: 17,
      z: 29,
      faceDirection: 2,
    });
  });

  it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
    'reads the location from a real Platinum save',
    () => {
      const bytes = new Uint8Array(
        readFileSync(process.env.OPENSINNOH_NDS_SAV!),
      );

      const location = readPlatinumPlayerLocation(bytes);

      console.log('player location:', location);

      expect(location.mapHeaderId).toBeGreaterThanOrEqual(0);
      expect(location.faceDirection).toBeGreaterThanOrEqual(0);
      expect(location.faceDirection).toBeLessThanOrEqual(3);
    },
  );
});