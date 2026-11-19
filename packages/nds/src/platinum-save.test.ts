
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  crc16Ccitt,
  PLATINUM_GENERAL_BLOCK,
  PLATINUM_SAVE_COPY_OFFSETS,
  PLATINUM_SAVE_FOOTER_SIZE,
  PLATINUM_SAVE_SIGNATURE,
  PLATINUM_SAVE_SIZE,
  PLATINUM_STORAGE_BLOCK,
  readPlatinumSaveFooter,
  selectPlatinumSaveBlocks,
  validatePlatinumSaveBlock,
  validatePlatinumSaveSize,
} from './platinum-save.ts';

function makeBlock(
  size: number,
  blockId: number,
  saveCounter = 4,
  blockCounter = 7,
): Uint8Array {
  const bytes = new Uint8Array(size);

  for (let i = 0; i < size - PLATINUM_SAVE_FOOTER_SIZE; i++) {
    bytes[i] = (i * 17 + 3) & 0xff;
  }

  const footerOffset = size - PLATINUM_SAVE_FOOTER_SIZE;
  const view = new DataView(bytes.buffer);

  view.setUint32(footerOffset, saveCounter, true);
  view.setUint32(footerOffset + 4, blockCounter, true);
  view.setUint32(footerOffset + 8, size, true);
  view.setUint32(footerOffset + 12, PLATINUM_SAVE_SIGNATURE, true);
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

describe('Platinum save blocks', () => {
  it('reads and validates a block footer', () => {
    const bytes = makeBlock(0x80, 0);

    expect(validatePlatinumSaveBlock(bytes, 0, bytes.length, 0)).toEqual({
      saveCounter: 4,
      blockCounter: 7,
      size: 0x80,
      signature: PLATINUM_SAVE_SIGNATURE,
      blockId: 0,
      checksum: readPlatinumSaveFooter(bytes, 0x80 - 0x14).checksum,
    });
  });

  it('rejects a changed byte', () => {
    const bytes = makeBlock(0x80, 0);
    bytes[5] ^= 1;

    expect(() =>
      validatePlatinumSaveBlock(bytes, 0, bytes.length, 0),
    ).toThrow(/checksum/i);
  });

  it('rejects a non-Platinum save size', () => {
    expect(() => validatePlatinumSaveSize(new Uint8Array(123))).toThrow(
      /expected 524288/,
    );
  });
  it('selects the newest valid general and storage copies', () => {
  const save = new Uint8Array(PLATINUM_SAVE_SIZE);
  const [primary, backup] = PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 8, 10);
  writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 8, 11);

  writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 8, 10);
  writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 7, 99);

  const selected = selectPlatinumSaveBlocks(save);

  expect(selected.general.offset).toBe(
    backup + PLATINUM_GENERAL_BLOCK.offset,
  );

  expect(selected.storage.offset).toBe(
    primary + PLATINUM_STORAGE_BLOCK.offset,
  );
});

it('uses the other copy when one block is corrupt', () => {
  const save = new Uint8Array(PLATINUM_SAVE_SIZE);
  const [primary, backup] = PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 5, 2);
  writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 5, 1);
  writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 5, 2);
  writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 5, 1);

  save[primary + 20] ^= 1;

  const selected = selectPlatinumSaveBlocks(save);

  expect(selected.general.offset).toBe(
    backup + PLATINUM_GENERAL_BLOCK.offset,
  );
});

it('rejects general and storage blocks from different full saves', () => {
  const save = new Uint8Array(PLATINUM_SAVE_SIZE);
  const [primary, backup] = PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 9, 1);
  writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 8, 1);
  writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 7, 1);
  writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 6, 1);

  expect(() => selectPlatinumSaveBlocks(save)).toThrow(
    /counters disagree/,
  );
});


it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
  'validates and selects the blocks of a real Platinum save',
  () => {
    const path = process.env.OPENSINNOH_NDS_SAV!;
    const bytes = new Uint8Array(readFileSync(path));
    const selected = selectPlatinumSaveBlocks(bytes);

    expect(selected.general.footer.signature).toBe(
      PLATINUM_SAVE_SIGNATURE,
    );

    expect(selected.storage.footer.signature).toBe(
      PLATINUM_SAVE_SIGNATURE,
    );

    console.log(
      `general 0x${selected.general.offset.toString(16)}, ` +
        `storage 0x${selected.storage.offset.toString(16)}, ` +
        `save counter ${selected.general.footer.saveCounter}`,
    );
  },
);
});