export const PLATINUM_SAVE_SIZE = 0x80000;
export const PLATINUM_SAVE_SIGNATURE = 0x20060623;
export const PLATINUM_SAVE_FOOTER_SIZE = 0x14;

export interface PlatinumSaveFooter {
  saveCounter: number;
  blockCounter: number;
  size: number;
  signature: number;
  blockId: number;
  checksum: number;
}

export function crc16Ccitt(
  bytes: Uint8Array,
  start = 0,
  end = bytes.length,
): number {
  let crc = 0xffff;

  for (let i = start; i < end; i++) {
    crc ^= bytes[i]! << 8;

    for (let bit = 0; bit < 8; bit++) {
      crc =
        crc & 0x8000
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
  }

  return crc;
}

export function readPlatinumSaveFooter(
  bytes: Uint8Array,
  footerOffset: number,
): PlatinumSaveFooter {
  if (
    footerOffset < 0 ||
    footerOffset + PLATINUM_SAVE_FOOTER_SIZE > bytes.length
  ) {
    throw new Error(`Platinum save footer at 0x${footerOffset.toString(16)} is outside the file`);
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  return {
    saveCounter: view.getUint32(footerOffset, true),
    blockCounter: view.getUint32(footerOffset + 4, true),
    size: view.getUint32(footerOffset + 8, true),
    signature: view.getUint32(footerOffset + 12, true),
    blockId: view.getUint8(footerOffset + 16),
    checksum: view.getUint16(footerOffset + 18, true),
  };
}

export function validatePlatinumSaveBlock(
  bytes: Uint8Array,
  blockOffset: number,
  blockSize: number,
  expectedBlockId: number,
): PlatinumSaveFooter {
  const blockEnd = blockOffset + blockSize;

  if (blockOffset < 0 || blockEnd > bytes.length) {
    throw new Error('Platinum save block is outside the file');
  }

  const footerOffset = blockEnd - PLATINUM_SAVE_FOOTER_SIZE;
  const footer = readPlatinumSaveFooter(bytes, footerOffset);

  if (footer.signature !== PLATINUM_SAVE_SIGNATURE) {
    throw new Error(
      `Invalid Platinum save signature 0x${footer.signature.toString(16)}`,
    );
  }

  if (footer.size !== blockSize) {
    throw new Error(
      `Platinum save block says size 0x${footer.size.toString(16)}, expected 0x${blockSize.toString(16)}`,
    );
  }

  if (footer.blockId !== expectedBlockId) {
    throw new Error(
      `Platinum save block id ${footer.blockId}, expected ${expectedBlockId}`,
    );
  }

  const checksum = crc16Ccitt(bytes, blockOffset, footerOffset);

  if (checksum !== footer.checksum) {
    throw new Error(
      `Invalid Platinum save checksum 0x${footer.checksum.toString(16)}, expected 0x${checksum.toString(16)}`,
    );
  }

  return footer;
}

export function validatePlatinumSaveSize(bytes: Uint8Array): void {
  if (bytes.length !== PLATINUM_SAVE_SIZE) {
    throw new Error(
      `Platinum save is ${bytes.length} bytes, expected ${PLATINUM_SAVE_SIZE}`,
    );
  }
}