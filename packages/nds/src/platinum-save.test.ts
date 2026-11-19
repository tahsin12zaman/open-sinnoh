import { describe, expect, it } from 'vitest';
import {
  crc16Ccitt,
  PLATINUM_SAVE_FOOTER_SIZE,
  PLATINUM_SAVE_SIGNATURE,
  readPlatinumSaveFooter,
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
});