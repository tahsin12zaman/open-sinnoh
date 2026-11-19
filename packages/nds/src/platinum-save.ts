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
    throw new Error(
      `Platinum save footer at 0x${footerOffset.toString(16)} is outside the file`,
    );
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

  const footerOffset =
    blockEnd - PLATINUM_SAVE_FOOTER_SIZE;

  const footer = readPlatinumSaveFooter(
    bytes,
    footerOffset,
  );

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

  const checksum = crc16Ccitt(
    bytes,
    blockOffset,
    footerOffset,
  );

  if (checksum !== footer.checksum) {
    throw new Error(
      `Invalid Platinum save checksum 0x${footer.checksum.toString(16)}, expected 0x${checksum.toString(16)}`,
    );
  }

  return footer;
}

export function validatePlatinumSaveSize(
  bytes: Uint8Array,
): void {
  if (bytes.length !== PLATINUM_SAVE_SIZE) {
    throw new Error(
      `Platinum save is ${bytes.length} bytes, expected ${PLATINUM_SAVE_SIZE}`,
    );
  }
}

export const PLATINUM_SAVE_COPY_OFFSETS = [
  0x00000,
  0x40000,
] as const;

export const PLATINUM_GENERAL_BLOCK = {
  offset: 0,
  size: 0xcf2c,
  blockId: 0,
} as const;

export const PLATINUM_STORAGE_BLOCK = {
  offset: 0xcf2c,
  size: 0x121e4,
  blockId: 1,
} as const;

export interface PlatinumSaveBlock {
  offset: number;
  footer: PlatinumSaveFooter;
}

export interface PlatinumSaveBlocks {
  general: PlatinumSaveBlock;
  storage: PlatinumSaveBlock;
}

function counterIsNewer(
  candidate: number,
  current: number,
): boolean {
  const difference = (candidate - current) >>> 0;

  return difference !== 0 && difference < 0x80000000;
}

function blockIsNewer(
  candidate: PlatinumSaveBlock,
  current: PlatinumSaveBlock,
): boolean {
  if (
    candidate.footer.saveCounter !==
    current.footer.saveCounter
  ) {
    return counterIsNewer(
      candidate.footer.saveCounter,
      current.footer.saveCounter,
    );
  }

  return counterIsNewer(
    candidate.footer.blockCounter,
    current.footer.blockCounter,
  );
}

function newestBlock(
  blocks: PlatinumSaveBlock[],
): PlatinumSaveBlock {
  if (blocks.length === 0) {
    throw new Error('No valid Platinum save block copies');
  }

  return blocks.slice(1).reduce(
    (current, candidate) =>
      blockIsNewer(candidate, current)
        ? candidate
        : current,
    blocks[0]!,
  );
}

function validBlockCopies(
  bytes: Uint8Array,
  specification: {
    offset: number;
    size: number;
    blockId: number;
  },
): PlatinumSaveBlock[] {
  const blocks: PlatinumSaveBlock[] = [];

  for (const copyOffset of PLATINUM_SAVE_COPY_OFFSETS) {
    const offset = copyOffset + specification.offset;

    try {
      blocks.push({
        offset,
        footer: validatePlatinumSaveBlock(
          bytes,
          offset,
          specification.size,
          specification.blockId,
        ),
      });
    } catch {
      // The other duplicated copy may still be valid.
    }
  }

  return blocks;
}

export function selectPlatinumSaveBlocks(
  bytes: Uint8Array,
): PlatinumSaveBlocks {
  validatePlatinumSaveSize(bytes);

  const general = newestBlock(
    validBlockCopies(bytes, PLATINUM_GENERAL_BLOCK),
  );

  const storage = newestBlock(
    validBlockCopies(bytes, PLATINUM_STORAGE_BLOCK),
  );

  if (
    general.footer.saveCounter !==
    storage.footer.saveCounter
  ) {
    throw new Error(
      `Platinum general/storage save counters disagree: ${general.footer.saveCounter} and ${storage.footer.saveCounter}`,
    );
  }

  return { general, storage };
}

export interface PlatinumTrainerData {
  nameCodes: number[];
  trainerId: number;
  secretId: number;
  money: number;
  gender: number;
  badges: number;
  coins: number;
  playTime: {
    hours: number;
    minutes: number;
    seconds: number;
  };
}

export function readPlatinumTrainerData(
  bytes: Uint8Array,
): PlatinumTrainerData {
  const { general } = selectPlatinumSaveBlocks(bytes);
  const base = general.offset;

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const nameCodes = Array.from(
    { length: 8 },
    (_, index) =>
      view.getUint16(base + 0x68 + index * 2, true),
  );

  const combinedId = view.getUint32(base + 0x78, true);

  return {
    nameCodes,
    trainerId: combinedId & 0xffff,
    secretId: combinedId >>> 16,
    money: view.getUint32(base + 0x7c, true),
    gender: view.getUint8(base + 0x80),
    badges: view.getUint8(base + 0x82),
    coins: view.getUint16(base + 0x88, true),
    playTime: {
      hours: view.getUint16(base + 0x8a, true),
      minutes: view.getUint8(base + 0x8c),
      seconds: view.getUint8(base + 0x8d),
    },
  };
}

export const PLATINUM_FIELD_STATE_OFFSET = 0x1294;

export interface PlatinumLocation {
  mapHeaderId: number;
  warpId: number;
  x: number;
  z: number;
  faceDirection: number;
}

export function readPlatinumPlayerLocation(
  bytes: Uint8Array,
): PlatinumLocation {
  const { general } = selectPlatinumSaveBlocks(bytes);
  const offset =
    general.offset + PLATINUM_FIELD_STATE_OFFSET;

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const location: PlatinumLocation = {
    mapHeaderId: view.getInt32(offset, true),
    warpId: view.getInt32(offset + 4, true),
    x: view.getInt32(offset + 8, true),
    z: view.getInt32(offset + 12, true),
    faceDirection: view.getInt32(offset + 16, true),
  };

  if (location.mapHeaderId < 0) {
    throw new Error(
      `Invalid Platinum map header ${location.mapHeaderId}`,
    );
  }

  if (
    location.faceDirection < 0 ||
    location.faceDirection > 3
  ) {
    throw new Error(
      `Invalid Platinum facing direction ${location.faceDirection}`,
    );
  }

  return location;
}